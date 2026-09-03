import { useEffect, useMemo, useState } from 'react';
import { Check, Gift, Minus, Plus } from 'lucide-react';
import {
  ECHEANCES_ALMA,
  ECHEANCES_CENTRE,
  dureeCureEnMois,
  echeancesCentrePossibles,
  FRAIS_ALMA,
  LIBELLES_TECHNOLOGIE,
  calculerMontant,
  construireEcheancierCure,
  formaterEuros,
  prixUnitaireParDefaut,
  type GrilleTarifaire,
  type ModeReglement,
  type Technologie,
} from '../../domain/tarification';

/** Ce qu'une composition validée transmet à l'enregistrement. */
export interface Prescription {
  lignes: Array<{ technologie: Technologie; seances: number; prixUnitaire: number }>;
  /** La prescription contient de l'I-Shape. */
  electro: boolean;
  /** La tenue est facturée. Décochée si la cliente en a déjà une. */
  tenue: boolean;
  /** Le guide est facturé. Décoché si la cliente l'a déjà. */
  guide: boolean;
  /** Séances gagnées par parrainage, posées sur une technologie. Jamais facturées. */
  offertes: { technologie: Technologie; seances: number } | null;
  montantTotal: number;
  modeReglement: ModeReglement;
  frais: number;
  echeances: Array<{ rang: number; montant: number }>;
}

interface Props {
  grille: GrilleTarifaire;
  /** Complément orienté par le terrain, affiché dans ce qui est inclus. */
  complement?: { nom: string; raison: string } | null;
  /** Séances de départ. 16 séances de luxothérapie par défaut. */
  seancesInitiales?: Partial<Record<Technologie, number>>;
  /**
   * Laisse décocher le guide et la tenue. À activer pour les cures
   * suivantes : la cliente les a déjà, on ne les lui revend pas.
   */
  optionsModifiables?: boolean;
  /**
   * Séances gagnées par parrainage et pas encore posées. Elles s'ajoutent au
   * décompte sans rien changer au montant : la cure en cours était déjà
   * signée quand elles ont été gagnées.
   */
  seancesOffertes?: number;
  onChange: (p: Prescription, totalSeances: number) => void;
}

/*
  Les soins proposés à la composition d'une cure. Le Dôme en est retiré : le
  nouveau bilan ne le prescrit plus. Le socle le connaît encore — tarif,
  libellé, colonne en base — pour qu'il suffise de le remettre dans cette
  liste s'il revient au catalogue.
*/
const TECHNOS_PRINCIPALES: Technologie[] = ['luxo', 'relax', 'ishape', 'presso'];

/*
  Les deux façons de régler, identiques à celles du bilan. Un seul calcul
  dans toute l'application : une cliente qui revient signer sa deuxième cure
  doit trouver les mêmes conditions que la première fois.
*/
const METHODES = [
  { id: 'centre' as const, libelle: 'Au centre', detail: 'Par chèques, sans frais' },
  { id: 'alma' as const, libelle: 'Alma', detail: 'Par carte, frais à la charge de la cliente' },
];

/**
 * La composition d'une cure : les séances par technologie, le montant qui en
 * découle, et l'échéancier. Sert au devis d'un bilan comme à la création
 * d'une cure suivante — les deux doivent calculer exactement pareil.
 */
export default function CompositionCure({
  grille,
  complement,
  seancesInitiales,
  optionsModifiables = false,
  seancesOffertes = 0,
  onChange,
}: Props) {
  const [seances, setSeances] = useState<Record<Technologie, number>>({
    luxo: seancesInitiales?.luxo ?? 16,
    relax: seancesInitiales?.relax ?? 0,
    ishape: seancesInitiales?.ishape ?? 0,
    presso: seancesInitiales?.presso ?? 0,
    dome: seancesInitiales?.dome ?? 0,
  });
  const [methode, setMethode] = useState<'centre' | 'alma'>('centre');
  const [nEcheances, setNEcheances] = useState(4);
  const [guide, setGuide] = useState(true);
  // Tant que la thérapeute n'a pas décidé elle-même, la tenue suit la
  // prescription : elle s'ajoute dès qu'il y a de l'I-Shape.
  const [tenueChoisie, setTenueChoisie] = useState<boolean | null>(null);

  // Les séances gagnées sont dues : on les pose d'emblée, sur la
  // luxothérapie, et la thérapeute déplace ou réduit si besoin.
  const [offertes, setOffertes] = useState(seancesOffertes);
  const [technoOfferte, setTechnoOfferte] = useState<Technologie>('luxo');

  const electro = seances.ishape > 0;
  const tenue = tenueChoisie ?? electro;

  const lignes = useMemo(
    () =>
      (['luxo', 'relax', 'ishape', 'presso'] as Technologie[]).map((t) => ({
        technologie: t,
        seances: seances[t],
        prixUnitaire: prixUnitaireParDefaut(t, grille),
      })),
    [seances, grille],
  );

  const detail = useMemo(
    () => calculerMontant(lignes, { tenue, guide }, grille),
    [lignes, tenue, guide, grille],
  );

  const offertesPosees = Math.min(offertes, seancesOffertes);

  /*
    Le même plafond qu'au bilan : la cure ne se règle pas plus longtemps
    qu'elle ne dure. La Relaxation ne compte pas parmi les soins principaux,
    elle s'ajoute à une venue existante.
  */
  const soinsPrincipaux = lignes.filter((l) => l.seances > 0 && l.technologie !== 'relax').length;
  const seancesDuPlusLong = lignes.reduce((n, l) => Math.max(n, l.seances), 0);
  const dureeMois = dureeCureEnMois(seancesDuPlusLong, soinsPrincipaux);
  const choixEcheances =
    methode === 'centre' ? echeancesCentrePossibles(dureeMois) : ECHEANCES_ALMA;
  const nRetenu = choixEcheances.includes(nEcheances)
    ? nEcheances
    : (choixEcheances[choixEcheances.length - 1] ?? 1);

  const echeancier = useMemo(
    () =>
      construireEcheancierCure({
        seances: detail.totalSeances,
        prixSeance: grille.seance,
        montantSeances: detail.montantSeances,
        options: detail.montantGuide + detail.montantTenue,
        methode,
        n: nRetenu,
      }),
    [detail, grille.seance, methode, nRetenu],
  );

  useEffect(() => {
    onChange(
      {
        lignes,
        electro,
        tenue,
        guide,
        offertes:
          offertesPosees > 0 ? { technologie: technoOfferte, seances: offertesPosees } : null,
        montantTotal: detail.total,
        modeReglement: echeancier.mode,
        frais: echeancier.frais,
        echeances: echeancier.echeances,
      },
      detail.totalSeances,
    );
    // onChange est recréée à chaque rendu du parent : on ne l'observe pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, electro, tenue, guide, detail, echeancier, offertesPosees, technoOfferte]);

  function ajuster(t: Technologie, delta: number) {
    setSeances((s) => ({ ...s, [t]: Math.max(0, s[t] + delta) }));
  }

  return (
    <div className="space-y-5">
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

        </div>

        <div className="space-y-1.5 border-t border-ardoise-100 bg-ardoise-50/60 px-5 py-4 text-sm">
          {optionsModifiables ? (
            <>
              <p className="mb-1 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                À facturer — décochez ce que la cliente a déjà
              </p>
              <Option
                coche={guide}
                onChange={setGuide}
                libelle="Guide de rééquilibrage alimentaire"
                prix={formaterEuros(grille.guide)}
              />
              <Option
                coche={tenue}
                onChange={(v) => setTenueChoisie(v)}
                libelle="Sous-tenue I-Shape"
                prix={formaterEuros(grille.tenue)}
                note={!electro ? 'Aucune électrostimulation prescrite' : undefined}
              />
              <div className="pt-1.5">
                <Inclus>Bilans mensuels sur balance médicale et suivi hebdomadaire</Inclus>
                <Inclus>Application podcasts et expérience ludique à chaque séance</Inclus>
              </div>
            </>
          ) : (
            <>
              <Inclus>Guide de rééquilibrage alimentaire — 4 phases sur 4 semaines</Inclus>
              {electro && <Inclus>Sous-tenue I-Shape fournie</Inclus>}
              {complement && (
                <Inclus>
                  <strong className="font-semibold">{complement.nom}</strong> — {complement.raison}
                </Inclus>
              )}
              <Inclus>Bilans mensuels sur balance médicale et suivi hebdomadaire nutrition</Inclus>
              <Inclus>Application podcasts et expérience ludique à chaque séance</Inclus>
            </>
          )}
        </div>
      </section>

      {seancesOffertes > 0 && (
        <section className="carte border-marine-200 bg-marine-50 p-5">
          <div className="flex items-start gap-3">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-marine-600" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-marine-900">
                {seancesOffertes} séance{seancesOffertes > 1 ? 's' : ''} offerte
                {seancesOffertes > 1 ? 's' : ''} par son parrainage
              </h2>
              <p className="mt-0.5 text-xs text-marine-800">
                Elles s’ajoutent au programme sans rien changer au montant. Posez-les sur le soin
                de votre choix.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="etiquette" htmlFor="offertes-nb">
                    À poser sur cette cure
                  </label>
                  <input
                    id="offertes-nb"
                    type="number"
                    min={0}
                    max={seancesOffertes}
                    className="champ"
                    value={offertes}
                    onChange={(e) =>
                      setOffertes(Math.min(seancesOffertes, Math.max(0, Number(e.target.value))))
                    }
                  />
                </div>
                <div>
                  <label className="etiquette" htmlFor="offertes-techno">
                    Sur quel soin
                  </label>
                  <select
                    id="offertes-techno"
                    className="champ"
                    value={technoOfferte}
                    onChange={(e) => setTechnoOfferte(e.target.value as Technologie)}
                  >
                    {(['luxo', 'relax', 'ishape', 'presso'] as Technologie[]).map((t) => (
                      <option key={t} value={t}>
                        {LIBELLES_TECHNOLOGIE[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {offertesPosees < seancesOffertes && (
                <p className="mt-2 text-xs text-marine-700">
                  {seancesOffertes - offertesPosees} séance
                  {seancesOffertes - offertesPosees > 1 ? 's' : ''} gardée
                  {seancesOffertes - offertesPosees > 1 ? 's' : ''} pour une cure suivante.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl bg-marine-900 text-white shadow-carte">
        <div className="px-6 py-7 text-center">
          <p className="text-2xs font-semibold uppercase tracking-widest text-marine-300">
            Son accompagnement personnalisé
          </p>
          <p className="chiffres mt-2 text-5xl font-bold">{formaterEuros(detail.total)}</p>
          <p className="mt-2 text-sm text-marine-200">
            {detail.totalSeances + offertesPosees} séance
            {detail.totalSeances + offertesPosees > 1 ? 's' : ''} au programme
            {offertesPosees > 0 && (
              <span className="text-marine-300"> — dont {offertesPosees} offertes</span>
            )}
          </p>

          {echeancier.echeances.length > 1 && (
            <p className="mt-4 text-sm text-marine-100">
              Réglable en{' '}
              <strong className="font-semibold">
                {echeancier.n} fois {methode === 'centre' ? 'sans frais' : 'chez Alma'}
              </strong>
              , soit{' '}
              <strong className="font-semibold">
                {formaterEuros(echeancier.echeances[1].montant, 2)}
              </strong>{' '}
              par mois
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-px bg-marine-800 text-center text-xs">
          <Detail libelle="Séances" valeur={formaterEuros(detail.montantSeances)} />
          <Detail libelle="Guide" valeur={guide ? formaterEuros(detail.montantGuide) : '—'} />
          <Detail
            libelle="Tenue I-Shape"
            valeur={tenue ? formaterEuros(detail.montantTenue) : '—'}
          />
        </div>
      </section>

      <section className="carte p-5">
        <h2 className="mb-3 text-sm font-semibold text-ardoise-900">Règlement</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {METHODES.map((m) => {
            const actif = methode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMethode(m.id);
                  setNEcheances(4);
                }}
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

        <div className="mt-3 flex flex-wrap gap-2">
          {choixEcheances.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNEcheances(n)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                echeancier.n === n
                  ? 'border-marine-600 bg-marine-600 text-white'
                  : 'border-ardoise-200 bg-white text-ardoise-700 hover:border-marine-400'
              }`}
            >
              {n === 1 ? 'Comptant' : `${n}\u00d7`}
            </button>
          ))}
        </div>

        {/*
          Sans cette phrase, la thérapeute croit à une panne : le 4× était là
          il y a dix secondes, et il a disparu quand elle a retiré des séances.
        */}
        {methode === 'centre' && choixEcheances.length < ECHEANCES_CENTRE.length && (
          <p className="mt-3 text-xs text-ardoise-500">
            Cette cure dure {dureeMois} mois : au-delà de {choixEcheances.length} chèques, le
            dernier serait encaissé après la dernière séance.
          </p>
        )}

        {methode === 'alma' && detail.total > 0 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Frais Alma de {String(FRAIS_ALMA[echeancier.n] ?? 0).replace('.', ',')} % —{' '}
            {formaterEuros(echeancier.frais, 2)} à la charge de la cliente. Total réglé :{' '}
            <strong className="font-semibold">{formaterEuros(echeancier.montantARegler, 2)}</strong>.
          </p>
        )}

        {methode === 'centre' && detail.montantGuide + detail.montantTenue > 0 && (
          <p className="mt-3 text-xs text-ardoise-500">
            Sans frais. Le guide et la tenue (
            {formaterEuros(detail.montantGuide + detail.montantTenue)}) sont portés par la première
            échéance.
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
      <span
        className={`text-sm ${valeur > 0 ? 'font-semibold text-ardoise-900' : 'text-ardoise-500'}`}
      >
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

function Option({
  coche,
  onChange,
  libelle,
  prix,
  note,
}: {
  coche: boolean;
  onChange: (v: boolean) => void;
  libelle: string;
  prix: string;
  note?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white px-3 py-2">
      <input
        type="checkbox"
        checked={coche}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-ardoise-300 text-marine-600 focus:ring-marine-500"
      />
      <span className="min-w-0 flex-1">
        <span className={coche ? 'text-ardoise-800' : 'text-ardoise-400 line-through'}>
          {libelle}
        </span>
        {note && <span className="block text-2xs text-ardoise-400">{note}</span>}
      </span>
      <span
        className={`chiffres shrink-0 text-sm font-semibold ${coche ? 'text-ardoise-900' : 'text-ardoise-300'}`}
      >
        {prix}
      </span>
    </label>
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
