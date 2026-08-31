import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, AlertTriangle, Archive, RefreshCw, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { differenceInYears, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCentre } from '../lib/session';
import { supabase } from '../lib/supabase';
import {
  archiverCliente,
  chercherHomonymes,
  creerCliente,
  lireCliente,
  listerTherapeutes,
  modifierCliente,
} from '../services/clientes';
import type { ClienteSaisie } from '../types/db';

const SOURCES = [
  'Bouche à oreille',
  'Facebook / Instagram',
  'Google',
  'Passage devant le centre',
  'Parrainage',
  'Presse / radio',
  'Autre',
];

const VIDE: ClienteSaisie = {
  prenom: '',
  nom: '',
  email: '',
  telephone: '',
  date_naissance: '',
  age: null,
  adresse: '',
  code_postal: '',
  ville: '',
  source: '',
  therapeutes: [],
};

export default function FicheCliente() {
  const { id } = useParams<{ id: string }>();
  const creation = !id;
  const centre = useCentre();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [saisie, setSaisie] = useState<ClienteSaisie>(VIDE);
  const [homonymes, setHomonymes] = useState<{ id: string; prenom: string; nom: string }[]>([]);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => lireCliente(id!),
    enabled: !creation,
  });

  const { data: therapeutes = [] } = useQuery({
    queryKey: ['therapeutes', centre.id],
    queryFn: () => listerTherapeutes(centre.id),
  });

  const { data: sync } = useQuery({
    queryKey: ['sync-cliente', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('airtable_sync')
        .select('statut, derniere_erreur, traite_le')
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

  useEffect(() => {
    if (!cliente) return;
    setSaisie({
      prenom: cliente.prenom,
      nom: cliente.nom,
      email: cliente.email ?? '',
      telephone: cliente.telephone ?? '',
      date_naissance: cliente.date_naissance ?? '',
      age: cliente.age,
      adresse: cliente.adresse ?? '',
      code_postal: cliente.code_postal ?? '',
      ville: cliente.ville ?? '',
      source: cliente.source ?? '',
      therapeutes: cliente.therapeutes,
    });
  }, [cliente]);

  // L'âge se déduit de la date de naissance, il n'est jamais saisi deux fois.
  const age = useMemo(() => {
    if (!saisie.date_naissance) return saisie.age;
    const d = new Date(saisie.date_naissance);
    if (Number.isNaN(d.getTime())) return saisie.age;
    return differenceInYears(new Date(), d);
  }, [saisie.date_naissance, saisie.age]);

  const enregistrer = useMutation({
    mutationFn: async () => {
      const donnees = { ...saisie, age };
      if (creation) return creerCliente(centre.id, donnees);
      return modifierCliente(id!, donnees);
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['clientes', centre.id] });
      qc.invalidateQueries({ queryKey: ['cliente', c.id] });
      toast.success(creation ? 'Fiche créée' : 'Fiche enregistrée');
      if (creation) navigate(`/clientes/${c.id}`, { replace: true });
    },
    onError: () => toast.error("La fiche n'a pas pu être enregistrée. Réessayez."),
  });

  const archiver = useMutation({
    mutationFn: () => archiverCliente(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes', centre.id] });
      toast.success('Fiche archivée');
      navigate('/clientes');
    },
    onError: () => toast.error("La fiche n'a pas pu être archivée."),
  });

  async function verifierHomonymes() {
    if (!creation) return;
    try {
      const trouves = await chercherHomonymes(centre.id, saisie.prenom, saisie.nom);
      setHomonymes(trouves);
    } catch {
      setHomonymes([]);
    }
  }

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!saisie.prenom.trim() || !saisie.nom.trim()) {
      toast.error('Le nom et le prénom sont nécessaires.');
      return;
    }
    enregistrer.mutate();
  }

  function basculerTherapeute(prenom: string) {
    setSaisie((s) => ({
      ...s,
      therapeutes: s.therapeutes.includes(prenom)
        ? s.therapeutes.filter((t) => t !== prenom)
        : [...s.therapeutes, prenom],
    }));
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
    <div className="space-y-6">
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
            {creation ? 'Nouvelle cliente' : `${cliente!.prenom} ${cliente!.nom}`}
          </h1>
          {!creation && (
            <p className="mt-0.5 text-sm text-ardoise-500">
              Fiche créée le {format(new Date(cliente!.cree_le), 'd MMMM yyyy', { locale: fr })}
            </p>
          )}
        </div>

        {!creation && <BadgeSynchro statut={sync?.statut} erreur={sync?.derniere_erreur} />}
      </header>

      {homonymes.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Une fiche porte déjà ce nom dans ce centre.</p>
            <p className="mt-1">
              {homonymes.map((h, i) => (
                <span key={h.id}>
                  {i > 0 && ' · '}
                  <Link to={`/clientes/${h.id}`} className="underline">
                    {h.prenom} {h.nom}
                  </Link>
                </span>
              ))}
              . Vérifiez qu'il ne s'agit pas de la même personne avant d'enregistrer.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={soumettre} className="space-y-5">
        <section className="carte p-5">
          <h2 className="mb-4 text-sm font-semibold text-ardoise-900">Coordonnées</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ
              id="nom"
              libelle="Nom"
              valeur={saisie.nom}
              onChange={(v) => setSaisie((s) => ({ ...s, nom: v }))}
              onBlur={verifierHomonymes}
              requis
            />
            <Champ
              id="prenom"
              libelle="Prénom"
              valeur={saisie.prenom}
              onChange={(v) => setSaisie((s) => ({ ...s, prenom: v }))}
              onBlur={verifierHomonymes}
              requis
            />
            <Champ
              id="telephone"
              libelle="Téléphone"
              type="tel"
              valeur={saisie.telephone ?? ''}
              onChange={(v) => setSaisie((s) => ({ ...s, telephone: v }))}
            />
            <Champ
              id="email"
              libelle="Email"
              type="email"
              valeur={saisie.email ?? ''}
              onChange={(v) => setSaisie((s) => ({ ...s, email: v }))}
            />
            <div>
              <label htmlFor="naissance" className="etiquette">
                Née le
              </label>
              <div className="flex gap-3">
                <input
                  id="naissance"
                  type="date"
                  value={saisie.date_naissance ?? ''}
                  onChange={(e) => setSaisie((s) => ({ ...s, date_naissance: e.target.value }))}
                  className="champ"
                />
                <div className="w-24 shrink-0">
                  <div className="champ bg-ardoise-50 text-center text-ardoise-600">
                    {age ?? '—'} {age ? 'ans' : ''}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="source" className="etiquette">
                Comment nous a-t-elle connus ?
              </label>
              <select
                id="source"
                value={saisie.source ?? ''}
                onChange={(e) => setSaisie((s) => ({ ...s, source: e.target.value }))}
                className="champ"
              >
                <option value="">—</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Champ
                id="adresse"
                libelle="Adresse"
                valeur={saisie.adresse ?? ''}
                onChange={(v) => setSaisie((s) => ({ ...s, adresse: v }))}
              />
            </div>
            <Champ
              id="cp"
              libelle="Code postal"
              valeur={saisie.code_postal ?? ''}
              onChange={(v) => setSaisie((s) => ({ ...s, code_postal: v }))}
            />
            <Champ
              id="ville"
              libelle="Ville"
              valeur={saisie.ville ?? ''}
              onChange={(v) => setSaisie((s) => ({ ...s, ville: v }))}
            />
          </div>
        </section>

        <section className="carte p-5">
          <h2 className="mb-1 text-sm font-semibold text-ardoise-900">Thérapeute</h2>
          <p className="mb-4 text-xs text-ardoise-500">
            Plusieurs choix possibles. Ces prénoms partent dans le champ Thérapeute d'Airtable.
          </p>
          {therapeutes.length === 0 ? (
            <p className="text-sm text-ardoise-400">Aucune thérapeute enregistrée pour ce centre.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {therapeutes.map((t) => {
                const choisie = saisie.therapeutes.includes(t.prenom);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => basculerTherapeute(t.prenom)}
                    aria-pressed={choisie}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      choisie
                        ? 'border-marine-600 bg-marine-600 text-white'
                        : 'border-ardoise-300 bg-white text-ardoise-700 hover:border-marine-400'
                    }`}
                  >
                    {t.prenom}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="submit" disabled={enregistrer.isPending} className="bouton-principal">
            <Save className="h-4 w-4" />
            {enregistrer.isPending
              ? 'Enregistrement…'
              : creation
                ? 'Créer la fiche'
                : 'Enregistrer'}
          </button>

          {!creation && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Archiver la fiche de ${cliente!.prenom} ${cliente!.nom} ?`)) {
                  archiver.mutate();
                }
              }}
              className="bouton-discret text-ardoise-500"
            >
              <Archive className="h-4 w-4" />
              Archiver
            </button>
          )}
        </div>
      </form>

      {!creation && (
        <p className="text-xs text-ardoise-400">
          Le bilan, le programme et le suivi des séances arrivent avec les prochains lots.
        </p>
      )}
    </div>
  );
}

function Champ({
  id,
  libelle,
  valeur,
  onChange,
  onBlur,
  type = 'text',
  requis = false,
}: {
  id: string;
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  requis?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="etiquette">
        {libelle}
        {requis && <span className="ml-1 text-rose-600">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={valeur}
        required={requis}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="champ"
      />
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
