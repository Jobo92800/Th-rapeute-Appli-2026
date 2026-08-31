import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { UserPlus, ArrowRight, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCentre } from '../lib/session';
import { supabase } from '../lib/supabase';
import { listerClientes } from '../services/clientes';

export default function Accueil() {
  const centre = useCentre();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes', centre.id],
    queryFn: () => listerClientes(centre.id),
  });

  const { data: sync } = useQuery({
    queryKey: ['sync-etat'],
    queryFn: async () => {
      const { count: enAttente } = await supabase
        .from('airtable_sync')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'en_attente');
      const { count: enErreur } = await supabase
        .from('airtable_sync')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'erreur');
      return { enAttente: enAttente ?? 0, enErreur: enErreur ?? 0 };
    },
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
        <Link to="/clientes/nouvelle" className="bouton-fort">
          <UserPlus className="h-4 w-4" />
          Nouvelle cliente
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Indicateur libelle="Clientes suivies" valeur={isLoading ? '—' : String(clientes.length)} />
        <Indicateur libelle="Créées ce mois-ci" valeur={isLoading ? '—' : String(ceMois)} />
        <EtatSynchro enAttente={sync?.enAttente ?? 0} enErreur={sync?.enErreur ?? 0} />
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
            <Link to="/clientes/nouvelle" className="bouton-principal mt-4">
              <UserPlus className="h-4 w-4" />
              Créer la première fiche
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

function EtatSynchro({ enAttente, enErreur }: { enAttente: number; enErreur: number }) {
  const enPanne = enErreur > 0;
  const enCours = enAttente > 0;

  return (
    <div className="carte px-5 py-4">
      <div className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
        Synchronisation Airtable
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
    </div>
  );
}
