import { useMemo, useState } from 'react';
import { Check, ChevronLeft, Loader2, Minus, Plus } from 'lucide-react';
import {
  LIBELLES_TECHNOLOGIE,
  calculerMontant,
  construireEcheancier,
  formaterEuros,
  prixUnitaireParDefaut,
  tauxAffichealma10x,
  type GrilleTarifaire,
  type ModeReglement,
  type Technologie,
} from '../../domain/tarification';

/** Ce que la validation transmet à l'enregistrement. */
export interface Prescription {
  lignes: Array<{ technologie: Technologie; seances: number; prixUnitaire: number }>;
  electro: boolean;
  montantTotal: number;
  modeReglement: ModeReglement;
  frais: number;
  echeances: Array<{ rang: number; montant: number }>;
}

interface Contact {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  code_postal: string;
  ville: string;
  age: string;
}

interface Props {
  grille: GrilleTarifaire;
  prenom: string;
  priorite: string;
  complement: { nom: string; raison: string } | null;
  profil: string;
  terrain: string;
  contact: Contact;
  onContact: (c: Contact) => void;
  enregistrement: boolean;
  onRetour: () => void;
  onBilanSeul: () => void;
  onValider: (p: Prescription) => void;
}

/** Le Dôme reste optionnel : il n'apparaît que si on le déplie. */
const TECHNOS_PRINCIPALES: Technologie[] = ['luxo', 'ishape', 'presso'];

const MODES: { valeur: ModeReglement; libelle: string; detail: string }[] = [
  { valeur: '4x_maison', libelle: '4 fois sans frais', detail: 'Échéancier interne' },
  { valeur: '10x_alma', libelle: '10 fois', detail: 'Financement Alma, frais inclus' },
  { valeur: 'comptant', libelle: 'Comptant', detail: 'Règlement en une fois' },
];

export default function Devis({
  grille,
  prenom,
  priorite,
  complement,
  profil,
  terrain,
  contact,
  onContact,
  enregistrement,
  onRetour,
  onBilanSeul,
  onValider,
}: Props) {
  const [seances, setSeances] = useState<Record<Technologie, number>>({
    luxo: 16,
    ishape: 0,
    presso: 0,
    dome: 0,
  });
  const [domeVisible, setDomeVisible] = useState(false);
  const [mode, setMode] = useState<ModeReglement>('4x_maison');

  // L'électrostimulation n'est pas une case à cocher : elle découle de la
  // prescription. Dès qu'il y a de l'I-Shape, la tenue à 60 € s'ajoute.
  const electro = seances.ishape > 0;

  const lignes = useMemo(
    () =>
      (['luxo', 'ishape', 'presso', 'dome'] as Technologie[]).map((t) => ({
        technologie: t,
        seances: seances[t],
        prixUnitaire: prixUnitaireParDefaut(t, grille),
      })),
    [seances, grille],
  );

  const detail = useMemo(
    () => calculerMontant(lignes, { electro }, grille),
    [lignes, electro, grille],
  );

  const echeancier = useMemo(
    () => construireEcheancier(detail.total, mode),
    [detail.total, mode],
  );

  const contactComplet = contact.prenom.trim() !== '' && contact.nom.trim() !== '';

  function ajuster(t: Technologie, delta: number) {
    setSeances((s) => ({ ...s, [t]: Math.max(0, s[t] + delta) }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="carte px-6 py-7 sm:px-8">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Son accompagnement
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ardoise-900">
          Le parcours pensé pour {prenom}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2.5 text-sm font-semibold">
          <span className="text-marine-700">{profil}</span>
          <span className="text-ardoise-300">×</span>
          <span className="text-rose-600">{terrain}</span>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ardoise-600">{priorite}</p>
      </header>

      {/* Prescription --------------------------------------------------- */}
      <section className="carte">
        <div className="border-b border-ardoise-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ardoise-900">Composition de la cure</h2>
          <p className="text-xs text-ardoise-500">
            Le total des séances détermine le montant. Ne présentez jamais le prix à la séance.
          </p>
        </div>

        <div className="divide-y divide-ardoise-100">
          {TECHNOS_PRINCIPALES.map((t) => (
            <LigneSeances
              key={t}
              libelle={LIBELLES_TECHNOLOGIE[t]}
              valeur={seances[t]}
              onMoins={() => ajuster(t, -1)}
              onPlus={() => ajuster(t, 1)}
            />
          ))}

          {domeVisible ? (
            <LigneSeances
              libelle={LIBELLES_TECHNOLOGIE.dome}
              valeur={seances.dome}
              onMoins={() => ajuster('dome', -1)}
              onPlus={() => ajuster('dome', 1)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setDomeVisible(true)}
              className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-medium text-ardoise-500 hover:bg-ardoise-50"
            >
              <Plus className="h-4 w-4" />
              Ajouter du Dôme
            </button>
          )}
        </div>

        <div className="space-y-1.5 border-t border-ardoise-100 bg-ardoise-50/60 px-5 py-4 text-sm">
          <Inclus>Guide de rééquilibrage alimentaire — 4 phases sur 4 semaines</Inclus>
          {electro && <Inclus>Sous-tenue I-Shape fournie</Inclus>}
          {complement && (
            <Inclus>
              <strong className="font-semibold">{complement.nom}</strong> — {complement.raison}
            </Inclus>
          )}
          <Inclus>Bilans mensuels sur balance médicale et suivi hebdomadaire nutrition</Inclus>
          <Inclus>Application podcasts et expérience ludique à chaque séance</Inclus>
        </div>
      </section>

      {/* Montant -------------------------------------------------------- */}
      <section className="overflow-hidden rounded-xl bg-marine-900 text-white shadow-carte">
        <div className="px-6 py-7 text-center">
          <p className="text-2xs font-semibold uppercase tracking-widest text-marine-300">
            Son accompagnement personnalisé
          </p>
          <p className="chiffres mt-2 text-5xl font-bold">{formaterEuros(detail.total)}</p>
          <p className="mt-2 text-sm text-marine-200">
            {detail.totalSeances} séance{detail.totalSeances > 1 ? 's' : ''} au programme
          </p>

          {echeancier.echeances.length > 1 && (
            <p className="mt-4 text-sm text-marine-100">
              {mode === '4x_maison' ? (
                <>
                  Réglable en <strong className="font-semibold">4 fois sans frais</strong>, soit{' '}
                  <strong className="font-semibold">
                    {formaterEuros(echeancier.echeances[1].montant, 2)}
                  </strong>{' '}
                  par mois
                </>
              ) : (
                <>
                  Réglable en <strong className="font-semibold">10 fois</strong>, soit{' '}
                  <strong className="font-semibold">
                    {formaterEuros(echeancier.echeances[1].montant, 2)}
                  </strong>{' '}
                  par mois
                </>
              )}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-px bg-marine-800 text-center text-xs">
          <Detail libelle="Séances" valeur={formaterEuros(detail.montantSeances)} />
          <Detail libelle="Guide" valeur={formaterEuros(detail.montantGuide)} />
          <Detail
            libelle="Tenue I-Shape"
            valeur={electro ? formaterEuros(detail.montantTenue) : '—'}
          />
        </div>
      </section>

      {/* Règlement ------------------------------------------------------ */}
      <section className="carte p-5">
        <h2 className="mb-3 text-sm font-semibold text-ardoise-900">Règlement</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => {
            const actif = mode === m.valeur;
            return (
              <button
                key={m.valeur}
                type="button"
                onClick={() => setMode(m.valeur)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  actif
                    ? 'border-marine-600 bg-marine-50'
                    : 'border-ardoise-200 bg-white hover:border-marine-400'
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${actif ? 'text-marine-900' : 'text-ardoise-800'}`}
                >
                  {m.libelle}
                </span>
                <span className="block text-xs text-ardoise-500">{m.detail}</span>
              </button>
            );
          })}
        </div>

        {mode === '10x_alma' && detail.total > 0 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Frais Alma de {(tauxAffichealma10x(detail.total) * 100).toLocaleString('fr-FR')} % —{' '}
            {formaterEuros(echeancier.frais, 2)} ajoutés au montant. Total réglé par la cliente :{' '}
            <strong className="font-semibold">
              {formaterEuros(echeancier.montantARegler, 2)}
            </strong>
            .
          </p>
        )}

        {echeancier.echeances.length > 1 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {echeancier.echeances.map((e) => (
              <div
                key={e.rang}
                className="rounded-lg border border-ardoise-200 bg-ardoise-50 px-3 py-2"
              >
                <div className="text-2xs font-semibold uppercase tracking-wide text-ardoise-400">
                  {e.rang}
                  {e.rang === 1 ? 'ère' : 'ème'}
                </div>
                <div className="chiffres text-sm font-bold text-ardoise-900">
                  {formaterEuros(e.montant, 2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Coordonnées ---------------------------------------------------- */}
      {!contactComplet && (
        <section className="carte border-amber-300 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Coordonnées manquantes</h2>
          <p className="mt-1 text-xs text-amber-800">
            Le nom et le prénom sont nécessaires pour créer la fiche de la cliente.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="d_nom" className="etiquette">
                Nom
              </label>
              <input
                id="d_nom"
                value={contact.nom}
                onChange={(e) => onContact({ ...contact, nom: e.target.value })}
                className="champ"
              />
            </div>
            <div>
              <label htmlFor="d_prenom" className="etiquette">
                Prénom
              </label>
              <input
                id="d_prenom"
                value={contact.prenom}
                onChange={(e) => onContact({ ...contact, prenom: e.target.value })}
                className="champ"
              />
            </div>
          </div>
        </section>
      )}

      {/* Actions -------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onRetour} className="bouton-discret" disabled={enregistrement}>
          <ChevronLeft className="h-4 w-4" />
          Revenir à l'Empreinte
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBilanSeul}
            disabled={enregistrement || !contactComplet}
            className="bouton-discret"
          >
            Bilan seul — {formaterEuros(grille.bilan)}
          </button>
          <button
            onClick={() =>
              onValider({
                lignes,
                electro,
                montantTotal: detail.total,
                modeReglement: mode,
                frais: echeancier.frais,
                echeances: echeancier.echeances,
              })
            }
            disabled={enregistrement || !contactComplet || detail.totalSeances === 0}
            className="bouton-fort"
          >
            {enregistrement ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Valider la cure
          </button>
        </div>
      </div>

      <p className="pb-4 text-center text-xs text-ardoise-400">
        Proposition établie ce jour, valable 15 jours.
      </p>
    </div>
  );
}

function LigneSeances({
  libelle,
  valeur,
  onMoins,
  onPlus,
}: {
  libelle: string;
  valeur: number;
  onMoins: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className={`text-sm ${valeur > 0 ? 'font-semibold text-ardoise-900' : 'text-ardoise-500'}`}>
        {libelle}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMoins}
          aria-label={`Retirer une séance de ${libelle}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-ardoise-300 text-ardoise-600 hover:bg-ardoise-50"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="chiffres w-10 text-center text-base font-bold text-ardoise-900">
          {valeur}
        </span>
        <button
          type="button"
          onClick={onPlus}
          aria-label={`Ajouter une séance de ${libelle}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-ardoise-300 text-ardoise-600 hover:bg-ardoise-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Inclus({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-ardoise-700">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-marine-600" strokeWidth={3} />
      <span>{children}</span>
    </p>
  );
}

function Detail({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="bg-marine-900 px-3 py-3">
      <div className="text-2xs uppercase tracking-widest text-marine-400">{libelle}</div>
      <div className="chiffres mt-0.5 font-semibold text-marine-50">{valeur}</div>
    </div>
  );
}
