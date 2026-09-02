import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Package,
  Phone,
  Pill,
  Sparkles,
  UserPlus,
  Wallet,
  Zap,
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { usePerimetre, useSession } from '../lib/session';
import { listerClientes } from '../services/clientes';
import { etatSynchro, oublierErreursSynchro, relancerSynchro } from '../services/metier';
import { aEncaisser, aRenouveler, seancesDuJour } from '../services/journee';
import { etatDuCentre } from '../services/stock';
import { libelleFinDeCure, niveauStock } from '../domain/stock';
import { formaterEuros } from '../domain/tarification';
import EtatSynchro from '../components/EtatSynchro';

/**
 * L'écran du matin.
 *
 * Il ne montre pas des chiffres, il montre ce qu'il y a à faire aujourd'hui :
 * qui rappeler pour un règlement, qui a fini sa boîte de compléments, ce
 * qu'il faut recommander. Les statistiques, elles, vivent dans le tableau
 * de bord — c'est une autre question, posée par quelqu'un d'autre.
 */
export default function Accueil() {
  const { centre, tousCentres } = useSession();
  const perimetre = usePerimetre();
  const [relance, setRelance] = useState(false);
  const [oubli, setOubli] = useState(false);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes', perimetre],
    queryFn: () => listerClientes(perimetre),
  });

  const { data: echeances = [] } = useQuery({
    queryKey: ['a-encaisser', perimetre],
    queryFn: () => aEncaisser(perimetre),
  });

  const { data: renouveler = [] } = useQuery({
    queryKey: ['a-renouveler', perimetre],
    queryFn: () => aRenouveler(perimetre),
  });

  const { data: seances = 0 } = useQuery({
    queryKey: ['seances-du-jour', perimetre],
    queryFn: () => seancesDuJour(perimetre),
  });

  const { data: rayon = [] } = useQuery({
    queryKey: ['stock', centre?.id],
    queryFn: () => etatDuCentre(centre!.id),
    enabled: Boolean(centre) && !tousCentres,
  });

  const { data: sync, refetch: relireSync } = useQuery({
    queryKey: ['sync-etat'],
    queryFn: etatSynchro,
    refetchInterval: 60_000,
  });

  const debutMois = startOfMonth(new Date());
  const ceMois = clientes.filter((c) => new Date(c.cree_le) >= debutMois).length;
  const duJour = echeances.reduce((n, e) => n + e.montant, 0);
  const alertesStock = rayon.filter(
    (l) => niveauStock(l.quantite, l.seuil_bas, l.seuil_critique) !== 'ok',
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ardoise-900">
            {tousCentres ? 'Tous les centres' : (centre?.nom ?? '')}
          </h1>
          <p className="mt-0.5 text-sm text-ardoise-500">
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
        </div>

        {tousCentres ? (
          <p className="max-w-xs text-xs text-ardoise-500">
            Vue d’ensemble des cinq centres. Pour créer une fiche ou démarrer un bilan,
            choisissez un centre en bas à gauche.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Link to="/clientes/nouvelle" className="bouton-discret">
              <UserPlus className="h-4 w-4" />
              Fiche seule
            </Link>
            <Link to="/bilan" className="bouton-fort">
              <Sparkles className="h-4 w-4" />
              Nouveau bilan
            </Link>
          </div>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile
          libelle="À encaisser"
          valeur={formaterEuros(duJour)}
          detail={
            echeances.length === 0
              ? 'Rien à réclamer aujourd’hui'
              : `${echeances.length} échéance${echeances.length > 1 ? 's' : ''} due${echeances.length > 1 ? 's' : ''}`
          }
          icone={Wallet}
          alerte={echeances.length > 0}
        />
        <Tuile
          libelle="Séances aujourd’hui"
          valeur={String(seances)}
          detail={seances === 0 ? 'Aucune séance clôturée' : 'clôturées depuis ce matin'}
          icone={Zap}
        />
        <Tuile
          libelle="Compléments à renouveler"
          valeur={String(renouveler.length)}
          detail={
            renouveler.length === 0 ? 'Aucune boîte à racheter' : 'boîtes finies ou presque'
          }
          icone={Pill}
        />
        <Tuile
          libelle="Clientes suivies"
          valeur={isLoading ? '—' : String(clientes.length)}
          detail={`${ceMois} créée${ceMois > 1 ? 's' : ''} ce mois-ci`}
          icone={UserPlus}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Les règlements ---------------------------------------------- */}
        <section className="carte">
          <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ardoise-900">À encaisser</h2>
            {echeances.length > 0 && (
              <span className="chiffres text-sm font-semibold text-rose-700">
                {formaterEuros(duJour)}
              </span>
            )}
          </div>

          {echeances.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ardoise-500">
              Aucune échéance à réclamer. Tout est à jour.
            </p>
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {echeances.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="min-w-0">
                    <Link
                      to={`/clientes/${e.cliente_id}`}
                      className="block truncate text-sm font-semibold text-ardoise-900 hover:text-marine-700"
                    >
                      {e.cliente}
                    </Link>
                    <span className="block text-xs text-ardoise-500">
                      {e.jours_de_retard <= 0
                        ? "échéance d'aujourd'hui"
                        : `${e.jours_de_retard} jour${e.jours_de_retard > 1 ? 's' : ''} de retard`}
                      {e.telephone && (
                        <a
                          href={`tel:${e.telephone}`}
                          className="ml-2 inline-flex items-center gap-1 text-marine-700 hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {e.telephone}
                        </a>
                      )}
                    </span>
                  </span>
                  <span
                    className={`chiffres shrink-0 text-sm font-semibold ${
                      e.jours_de_retard > 0 ? 'text-rose-700' : 'text-ardoise-900'
                    }`}
                  >
                    {formaterEuros(e.montant, 2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Les compléments --------------------------------------------- */}
        <section className="carte">
          <div className="border-b border-ardoise-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ardoise-900">Compléments à renouveler</h2>
          </div>

          {renouveler.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ardoise-500">
              Aucune boîte terminée cette semaine.
            </p>
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {renouveler.slice(0, 8).map((r) => (
                <li
                  key={`${r.cliente_id}-${r.produit}`}
                  className="flex items-center justify-between gap-3 px-5 py-2.5"
                >
                  <span className="min-w-0">
                    <Link
                      to={`/clientes/${r.cliente_id}`}
                      className="block truncate text-sm font-semibold text-ardoise-900 hover:text-marine-700"
                    >
                      {r.cliente}
                    </Link>
                    <span className="block text-xs text-ardoise-500">
                      {r.produit}
                      {r.telephone && (
                        <a
                          href={`tel:${r.telephone}`}
                          className="ml-2 inline-flex items-center gap-1 text-marine-700 hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {r.telephone}
                        </a>
                      )}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      r.fin.terminee
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {libelleFinDeCure(r.fin)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Le stock ----------------------------------------------------- */}
        {!tousCentres && (
          <section className="carte p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
              <Package className="h-4 w-4 text-ardoise-400" />
              Stock à recommander
            </h2>

            {alertesStock.length === 0 ? (
              <p className="mt-2 text-sm text-ardoise-500">Aucun produit sous son seuil.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {alertesStock.slice(0, 6).map((l) => (
                  <li key={l.produit_id} className="flex justify-between text-sm">
                    <span className="truncate text-ardoise-700">{l.nom}</span>
                    <span
                      className={`chiffres shrink-0 font-semibold ${
                        l.quantite <= l.seuil_critique ? 'text-rose-700' : 'text-amber-700'
                      }`}
                    >
                      {l.quantite}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Link
              to="/stock"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-marine-700 hover:text-marine-800"
            >
              Voir le stock
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        )}

        <EtatSynchro
          enAttente={sync?.enAttente ?? 0}
          enErreur={sync?.enErreur ?? 0}
          erreurs={sync?.dernieresErreurs ?? []}
          relanceEnCours={relance}
          oubliEnCours={oubli}
          onRelancer={async () => {
            setRelance(true);
            try {
              const r = await relancerSynchro();
              await relireSync();
              if (r.echecs > 0) {
                toast.error(
                  `${r.echecs} fiche${r.echecs > 1 ? 's' : ''} en échec — ${r.erreurs[0]?.message ?? ''}`.slice(0, 200),
                  { duration: 10_000 },
                );
              } else if (r.traitees > 0) {
                toast.success(
                  `${r.traitees} fiche${r.traitees > 1 ? 's' : ''} envoyée${r.traitees > 1 ? 's' : ''} à Airtable`,
                );
              } else {
                toast.success('Rien en attente, tout est à jour');
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'La relance a échoué.');
            } finally {
              setRelance(false);
            }
          }}
          onOublier={async () => {
            setOubli(true);
            try {
              const n = await oublierErreursSynchro();
              await relireSync();
              toast.success(
                n === 0
                  ? 'Aucune erreur à écarter'
                  : `${n} erreur${n > 1 ? 's' : ''} écartée${n > 1 ? 's' : ''}. La fiche repartira à sa prochaine modification.`,
                { duration: 6000 },
              );
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Les erreurs n'ont pas pu être écartées.");
            } finally {
              setOubli(false);
            }
          }}
        />

        {/* Les dernières fiches ---------------------------------------- */}
        <section className="carte lg:col-span-1">
          <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ardoise-900">Dernières fiches</h2>
            <Link
              to="/clientes"
              className="flex items-center gap-1 text-sm font-medium text-marine-700 hover:text-marine-800"
            >
              Toutes
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <p className="px-5 py-6 text-center text-sm text-ardoise-400">Chargement…</p>
          ) : clientes.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-ardoise-500">Aucune cliente pour l’instant.</p>
            </div>
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {clientes.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/clientes/${c.id}`}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-ardoise-50"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold text-ardoise-900">
                      {c.prenom} {c.nom}
                    </span>
                    <span className="shrink-0 text-xs text-ardoise-400">
                      {format(new Date(c.cree_le), 'd MMM', { locale: fr })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Tuile({
  libelle,
  valeur,
  detail,
  icone: Icone,
  alerte = false,
}: {
  libelle: string;
  valeur: string;
  detail: string;
  icone: typeof Wallet;
  alerte?: boolean;
}) {
  return (
    <div className={`carte px-5 py-4 ${alerte ? 'border-rose-200 bg-rose-50' : ''}`}>
      <div
        className={`flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest ${
          alerte ? 'text-rose-700' : 'text-ardoise-400'
        }`}
      >
        <Icone className="h-3.5 w-3.5" />
        {libelle}
      </div>
      <div
        className={`chiffres mt-1 text-3xl font-bold tracking-tight ${
          alerte ? 'text-rose-700' : 'text-ardoise-900'
        }`}
      >
        {valeur}
      </div>
      <div className={`mt-0.5 text-xs ${alerte ? 'text-rose-700' : 'text-ardoise-500'}`}>
        {detail}
      </div>
    </div>
  );
}
