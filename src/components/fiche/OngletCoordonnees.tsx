import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Archive, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { differenceInYears } from 'date-fns';
import { useSession } from '../../lib/session';
import {
  archiverCliente,
  chercherHomonymes,
  creerCliente,
  listerTherapeutes,
  modifierCliente,
} from '../../services/clientes';
import ModaleSuppression from './ModaleSuppression';
import type { Cliente, ClienteSaisie } from '../../types/db';

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
  civilite: 'Mme',
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

interface Props {
  centreId: string;
  cliente: Cliente | null;
}

export default function OngletCoordonnees({ centreId, cliente }: Props) {
  const creation = !cliente;
  const { therapeute: moi, role } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [saisie, setSaisie] = useState<ClienteSaisie>(VIDE);
  const [homonymes, setHomonymes] = useState<Cliente[]>([]);
  const [suppression, setSuppression] = useState(false);

  const { data: therapeutes = [] } = useQuery({
    queryKey: ['therapeutes', centreId],
    queryFn: () => listerTherapeutes(centreId),
  });

  // À la création, la thérapeute connectée est cochée d'office.
  useEffect(() => {
    if (!creation || !moi || moi.role === 'direction') return;
    setSaisie((s) => (s.therapeutes.length === 0 ? { ...s, therapeutes: [moi.prenom] } : s));
  }, [creation, moi]);

  useEffect(() => {
    if (!cliente) return;
    setSaisie({
      civilite: cliente.civilite ?? 'Mme',
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

  // L'âge se déduit de la date de naissance : jamais saisi deux fois.
  const age = useMemo(() => {
    if (!saisie.date_naissance) return saisie.age;
    const d = new Date(saisie.date_naissance);
    return Number.isNaN(d.getTime()) ? saisie.age : differenceInYears(new Date(), d);
  }, [saisie.date_naissance, saisie.age]);

  const enregistrer = useMutation({
    mutationFn: async () => {
      const donnees = { ...saisie, age };
      return creation ? creerCliente(centreId, donnees) : modifierCliente(cliente!.id, donnees);
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['clientes', centreId] });
      qc.invalidateQueries({ queryKey: ['cliente', c.id] });
      toast.success(creation ? 'Fiche créée' : 'Fiche enregistrée');
      if (creation) navigate(`/clientes/${c.id}`, { replace: true });
    },
    onError: () => toast.error("La fiche n'a pas pu être enregistrée. Réessayez."),
  });

  const archiver = useMutation({
    mutationFn: () => archiverCliente(cliente!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes', centreId] });
      toast.success('Fiche archivée');
      navigate('/clientes');
    },
    onError: () => toast.error("La fiche n'a pas pu être archivée."),
  });

  async function verifierHomonymes() {
    if (!creation) return;
    try {
      setHomonymes(await chercherHomonymes(centreId, saisie.prenom, saisie.nom));
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

  return (
    <div className="space-y-5">
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
            <div>
              <label className="etiquette" htmlFor="civilite">
                Civilité
              </label>
              <div className="flex gap-2">
                {(['Mme', 'M.'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    id={c === 'Mme' ? 'civilite' : undefined}
                    onClick={() => setSaisie((s) => ({ ...s, civilite: c }))}
                    aria-pressed={saisie.civilite === c}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      saisie.civilite === c
                        ? 'border-marine-600 bg-marine-600 text-white'
                        : 'border-ardoise-300 bg-white text-ardoise-700 hover:border-marine-400'
                    }`}
                  >
                    {c === 'Mme' ? 'Madame' : 'Monsieur'}
                  </button>
                ))}
              </div>
            </div>
            <Champ id="nom" libelle="Nom" valeur={saisie.nom} onChange={(v) => setSaisie((s) => ({ ...s, nom: v }))} onBlur={verifierHomonymes} requis />
            <Champ id="prenom" libelle="Prénom" valeur={saisie.prenom} onChange={(v) => setSaisie((s) => ({ ...s, prenom: v }))} onBlur={verifierHomonymes} requis />
            <Champ id="telephone" libelle="Téléphone" type="tel" valeur={saisie.telephone ?? ''} onChange={(v) => setSaisie((s) => ({ ...s, telephone: v }))} />
            <Champ id="email" libelle="Email" type="email" valeur={saisie.email ?? ''} onChange={(v) => setSaisie((s) => ({ ...s, email: v }))} />

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
                <div className="champ chiffres w-24 shrink-0 bg-ardoise-50 text-center text-ardoise-600">
                  {age ?? '—'} {age ? 'ans' : ''}
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
              <Champ id="adresse" libelle="Adresse" valeur={saisie.adresse ?? ''} onChange={(v) => setSaisie((s) => ({ ...s, adresse: v }))} />
            </div>
            <Champ id="cp" libelle="Code postal" valeur={saisie.code_postal ?? ''} onChange={(v) => setSaisie((s) => ({ ...s, code_postal: v }))} />
            <Champ id="ville" libelle="Ville" valeur={saisie.ville ?? ''} onChange={(v) => setSaisie((s) => ({ ...s, ville: v }))} />
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
            {enregistrer.isPending ? 'Enregistrement…' : creation ? 'Créer la fiche' : 'Enregistrer'}
          </button>

          {!creation && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Archiver la fiche de ${cliente!.prenom} ${cliente!.nom} ?`)) {
                    archiver.mutate();
                  }
                }}
                title="Sort la fiche des listes sans rien perdre"
                className="bouton-discret text-ardoise-500"
              >
                <Archive className="h-4 w-4" />
                Archiver
              </button>

              {role === 'direction' && (
                <button
                  type="button"
                  onClick={() => setSuppression(true)}
                  title="Efface la fiche et tout son dossier, sans retour possible"
                  className="bouton border border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              )}
            </div>
          )}
        </div>
      </form>

      {suppression && cliente && (
        <ModaleSuppression
          cliente={cliente}
          onFerme={() => setSuppression(false)}
          onSupprimee={() => {
            qc.invalidateQueries({ queryKey: ['clientes', centreId] });
            toast.success('Fiche supprimée');
            navigate('/clientes');
          }}
        />
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
