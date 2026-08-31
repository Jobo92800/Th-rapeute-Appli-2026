import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { UserPlus, ArrowRight, Sparkles } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCentre } from '../lib/session';
import { listerClientes } from '../services/clientes';
import { etatSynchro, oublierErreursSynchro, relancerSynchro } from '../services/metier';
import EtatSynchro from '../components/EtatSynchro';

export default function Accueil() {
  const centre = useCentre();
  const [relance, setRelance] = useState(false);
  const [oubli, setOubli] = useState(false);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes', centre.id],
    queryFn: () => listerClientes(centre.id),
  });

  const { data: sync, refetch: relireSync } = useQuery({
    queryKey: ['sync-etat'],
    queryFn: etatSynchro,
    refetchInterval: 60_000,
  });

  const debutMois = startOfMonth(new Date());
  const ceMois = clientes.filter((c) => new Date(c.cree_le) >= debutMois).length;
  const dernieres = clientes.slice(0, 6);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ardoise-900">{centre.nom}</h1>
          <p className="mt-0.5 text-sm text-ardoise-500">
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
        </div>
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
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Indicateur libelle="Clientes suivies" valeur={isLoading ? '—' : String(clientes.length)} />
        <Indicateur libelle="Créées ce mois-ci" valeur={isLoading ? '—' : String(ceMois)} />
        <EtatSynchro
          enAttente={sync?.enAttente ?? 0}
          enErreur={sync?.enErreur ?? 0}
          erreurs={sync?.dernieresErreurs ?? []}
          relanceEnCours={relance}
          oubliEnCours={oubli}
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
        />
      </div>

      <section className="carte">
        <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ardoise-900">Dernières fiches créées</h2>
          <Link
            to="/clientes"
            className="flex items-center gap-1 text-sm font-medium text-marine-700 hover:text-marine-800"
          >
            Toutes les clientes
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-ardoise-400">Chargement…</p>
        ) : dernieres.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-ardoise-500">Aucune cliente dans ce centre pour l'instant.</p>
            <Link to="/bilan" className="bouton-fort mt-4">
              <Sparkles className="h-4 w-4" />
              Démarrer le premier bilan
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-ardoise-100">
            {dernieres.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/clientes/${c.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-ardoise-50"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ardoise-900">
                      {c.prenom} {c.nom}
                    </span>
                    <span className="block text-xs text-ardoise-500">
                      {c.telephone ?? c.email ?? 'Coordonnées à compléter'}
                    </span>
                  </span>
                  <span className="text-xs text-ardoise-400">
                    {format(new Date(c.cree_le), 'd MMM', { locale: fr })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-ardoise-400">
        Les bilans, les séances et les règlements arrivent avec les prochains lots. Cet écran se
        remplira au fur et à mesure.
      </p>
    </div>
  );
}

function Indicateur({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="carte px-5 py-4">
      <div className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
        {libelle}
      </div>
      <div className="chiffres mt-1 text-3xl font-bold tracking-tight text-ardoise-900">
        {valeur}
      </div>
    </div>
  );
}
