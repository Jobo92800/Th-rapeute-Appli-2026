import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Fingerprint,
  Ruler,
  RefreshCw,
  User,
  FileSignature,
  MessageSquare,
  Pill,
  Pin,
  Wallet,
  Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCentre, useSession } from '../lib/session';
import ChoisirUnCentre from '../components/ChoisirUnCentre';
import { supabase } from '../lib/supabase';
import { lireCliente } from '../services/clientes';
import { bilansDeLaCliente, notesDeLaCliente } from '../services/metier';
import OngletCoordonnees from '../components/fiche/OngletCoordonnees';
import OngletBioPortrait from '../components/fiche/OngletBioPortrait';
import OngletProgramme from '../components/fiche/OngletProgramme';
import OngletSeances from '../components/fiche/OngletSeances';
import OngletMensurations from '../components/fiche/OngletMensurations';
import OngletComplements from '../components/fiche/OngletComplements';
import CarteParrainage from '../components/fiche/CarteParrainage';
import ExceptionCure from '../components/fiche/ExceptionCure';
import Notes from '../components/fiche/Notes';
import OngletDocuments from '../components/fiche/OngletDocuments';
import type { AxeProfil } from '../domain/bioportrait';

type Onglet =
  | 'coordonnees'
  | 'bioportrait'
  | 'programme'
  | 'seances'
  | 'mensurations'
  | 'complements'
  | 'documents'
  | 'notes';

const ONGLETS: { id: Onglet; libelle: string; icone: typeof User }[] = [
  { id: 'coordonnees', libelle: 'Coordonnées', icone: User },
  { id: 'bioportrait', libelle: 'BioPortrait', icone: Fingerprint },
  { id: 'programme', libelle: 'Cure & règlement', icone: Wallet },
  { id: 'seances', libelle: 'Séances', icone: Zap },
  { id: 'mensurations', libelle: 'Mensurations', icone: Ruler },
  { id: 'complements', libelle: 'Compléments', icone: Pill },
  { id: 'documents', libelle: 'Contrat', icone: FileSignature },
  { id: 'notes', libelle: 'Notes', icone: MessageSquare },
];

export default function FicheCliente() {
  const { id } = useParams<{ id: string }>();
  const creation = !id;
  const centre = useCentre();
  const { tousCentres } = useSession();
  const [onglet, setOnglet] = useState<Onglet>('coordonnees');

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => lireCliente(id!),
    enabled: !creation,
  });

  const { data: bilans = [] } = useQuery({
    queryKey: ['bilans', id],
    queryFn: () => bilansDeLaCliente(id!),
    enabled: !creation,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', id],
    queryFn: () => notesDeLaCliente(id!),
    enabled: !creation,
  });

  const { data: sync } = useQuery({
    queryKey: ['sync-cliente', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('airtable_sync')
        .select('statut, derniere_erreur')
        .eq('entite', 'cliente')
        .eq('entite_id', id!)
        .order('cree_le', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !creation,
    refetchInterval: 30_000,
  });

  const profilDominant =
    (bilans.find((b) => b.statut === 'termine')?.profil_dominant as AxeProfil | null) ?? null;

  // Créer une fiche demande de savoir dans quel centre. La consulter, non :
  // la direction peut ouvrir n'importe quelle fiche depuis la vue d'ensemble.
  if (creation && tousCentres) {
    return (
      <ChoisirUnCentre quoi="Une fiche cliente appartient à un centre : celui où elle est suivie." />
    );
  }

  if (!creation && isLoading) {
    return <p className="carte px-5 py-10 text-center text-sm text-ardoise-400">Chargement…</p>;
  }

  if (!creation && !cliente) {
    return (
      <div className="carte px-5 py-10 text-center">
        <p className="text-sm text-ardoise-600">Cette fiche est introuvable.</p>
        <Link to="/clientes" className="bouton-discret mt-4">
          Retour aux clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/clientes"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-ardoise-500 hover:text-ardoise-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Clientes
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-ardoise-900">
            {creation
              ? 'Nouvelle fiche'
              : `${cliente!.civilite === 'M.' ? 'M.' : 'Mme'} ${cliente!.prenom} ${cliente!.nom}`}
          </h1>
          {!creation && (
            <p className="mt-0.5 text-sm text-ardoise-500">
              Fiche créée le {format(new Date(cliente!.cree_le), 'd MMMM yyyy', { locale: fr })}
            </p>
          )}
        </div>
        {!creation && (
          <div className="flex flex-wrap items-center gap-3">
            <ExceptionCure cliente={cliente!} mode="bouton" />
            <BadgeSynchro statut={sync?.statut} erreur={sync?.derniere_erreur} />
          </div>
        )}
      </header>

      {/*
        L'exception reste sous les yeux quel que soit l'onglet ouvert : une
        pathologie ne se consulte pas, elle s'impose. Le bouton d'en-tête ne
        sert qu'à la créer quand il n'y en a pas.
      */}
      {!creation && cliente?.exception_cure?.trim() && (
        <ExceptionCure cliente={cliente} mode="bandeau" />
      )}

      {!creation && (
        <nav className="flex flex-wrap gap-1 border-b border-ardoise-200">
          {ONGLETS.map(({ id: o, libelle, icone: Icone }) => {
            const actif = onglet === o;
            return (
              <button
                key={o}
                onClick={() => setOnglet(o)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  actif
                    ? 'border-marine-600 text-marine-800'
                    : 'border-transparent text-ardoise-500 hover:text-ardoise-800'
                }`}
              >
                <Icone className="h-4 w-4" />
                {libelle}
                {o === 'notes' && notes.length > 0 && (
                  <span className="chiffres rounded-full bg-ardoise-200 px-1.5 text-2xs font-bold text-ardoise-700">
                    {notes.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {!creation &&
        notes
          .filter((n) => n.epinglee)
          .map((n) => (
            <div
              key={n.id}
              className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3"
            >
              <Pin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 text-sm text-amber-900">
                <p className="whitespace-pre-wrap leading-relaxed">{n.texte}</p>
                <p className="mt-1 text-xs text-amber-700">
                  {n.auteur || 'Thérapeute'} ·{' '}
                  {format(new Date(n.cree_le), 'd MMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>
          ))}

      {(creation || onglet === 'coordonnees') && (
        <OngletCoordonnees centreId={centre.id} cliente={cliente ?? null} />
      )}
      {!creation && onglet === 'coordonnees' && cliente && <CarteParrainage cliente={cliente} />}
      {!creation && onglet === 'bioportrait' && <OngletBioPortrait clienteId={id!} />}
      {!creation && onglet === 'programme' && (
        <OngletProgramme cliente={cliente!} centreId={centre.id} />
      )}
      {!creation && onglet === 'seances' && (
        <OngletSeances clienteId={id!} centreId={centre.id} profilDominant={profilDominant} />
      )}
      {!creation && onglet === 'mensurations' && (
        <OngletMensurations clienteId={id!} centreId={centre.id} />
      )}
      {!creation && onglet === 'complements' && (
        <OngletComplements clienteId={id!} centreId={centre.id} />
      )}
      {!creation && onglet === 'documents' && <OngletDocuments cliente={cliente!} />}
      {!creation && onglet === 'notes' && <Notes clienteId={id!} centreId={centre.id} />}
    </div>
  );
}

function BadgeSynchro({ statut, erreur }: { statut?: string; erreur?: string | null }) {
  if (!statut) return null;

  if (statut === 'erreur') {
    return (
      <span
        title={erreur ?? undefined}
        className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Airtable — échec d'envoi
      </span>
    );
  }

  if (statut === 'ok') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Synchronisée avec Airtable
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ardoise-300 bg-ardoise-50 px-3 py-1 text-xs font-semibold text-ardoise-600">
      <RefreshCw className="h-3.5 w-3.5" />
      Envoi vers Airtable en attente
    </span>
  );
}
