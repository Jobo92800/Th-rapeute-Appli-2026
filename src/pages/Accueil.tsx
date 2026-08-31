import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { UserPlus, ArrowRight, RefreshCw, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCentre } from '../lib/session';
import { listerClientes } from '../services/clientes';
import { declencherSynchro, etatSynchro } from '../services/metier';

export default function Accueil() {
  const centre = useCentre();

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
          onRelancer={async () => {
            declencherSynchro();
            setTimeout(() => relireSync(), 2500);
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

function EtatSynchro({
  enAttente,
  enErreur,
  erreurs,
  onRelancer,
}: {
  enAttente: number;
  enErreur: number;
  erreurs: Array<{ entite: string; message: string }>;
  onRelancer: () => void;
}) {
  const enPanne = enErreur > 0;
  const enCours = enAttente > 0;

  return (
    <div className="carte px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Synchronisation Airtable
        </span>
        {(enPanne || enCours) && (
          <button
            onClick={onRelancer}
            className="text-2xs font-semibold uppercase tracking-wide text-marine-700 hover:text-marine-900"
          >
            Relancer
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {enPanne ? (
          <>
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <span className="text-sm font-semibold text-rose-700">
              {enErreur} fiche{enErreur > 1 ? 's' : ''} en échec
            </span>
          </>
        ) : enCours ? (
          <>
            <RefreshCw className="h-5 w-5 text-marine-600" />
            <span className="text-sm font-semibold text-marine-800">
              {enAttente} en attente d'envoi
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">Tout est à jour</span>
          </>
        )}
      </div>

      {enPanne && erreurs.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-ardoise-100 pt-2">
          {erreurs.map((e, i) => (
            <li key={i} className="text-2xs leading-snug text-ardoise-500">
              <span className="font-semibold text-ardoise-700">{e.entite}</span> — {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
