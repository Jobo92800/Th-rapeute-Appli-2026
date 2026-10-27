import { useEffect, useMemo, useState } from 'react';
import { Check, Gift, Minus, Plus } from 'lucide-react';
import ChoixComplements from './ChoixComplements';
import {
  complementsChoisis,
  nombreDeBoites,
  type ComplementChoisi,
} from '../../domain/complements';
import type { EtatStock } from '../../types/db';
import {
  ajusterSeancesDuSoin,
  bilanAntiAgeFacturable,
  demandeUneVenue,
  psioDisponible,
  soinsAntiAgeDuCentre,
} from '../../domain/soins';
import {
  ECHEANCES_ALMA,
  dureeCureEnMois,
  pourquoiPasPlusDeCheques,
  echeancesCentrePossibles,
  tauxFraisAlma,
  LIBELLES_TECHNOLOGIE,
  calculerMontant,
  construireEcheancierCure,
  creneauxParDefaut,
  montantAcompte,
  formaterEuros,
  formaterEurosJuste,
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
  /** Les boîtes de compléments choisies avec la cure, comptées dans le montant. */
  complements: ComplementChoisi[];
  /**
   * Le bilan anti-âge facturé avec la cure, 89 €, ou zéro. Il compte dans le
   * montant et tombe sur la première échéance, comme le guide et la tenue.
   */
  prixBilan: number;
  montantTotal: number;
  modeReglement: ModeReglement;
  frais: number;
  echeances: Array<{ rang: number; montant: number }>;
}

interface Props {
  grille: GrilleTarifaire;
  /** Complément orienté par le terrain, affiché dans ce qui est inclus. */
  complement?: { nom: string; raison: string } | null;
  /**
   * Le rayon du centre, pour proposer les boîtes de compléments avec la
   * cure. Vide tant qu'il n'est pas chargé : le bloc n'apparaît pas.
   */
  catalogue?: EtatStock[];
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
  /**
   * Le centre de la cliente. Il décide des soins anti-âge proposés :
   * l'Advance Lift au Grau-du-Roi, la radiofréquence au Crès et à Sérignan,
   * rien ailleurs. Absent, on ne propose que la perte de poids.
   */
  centreId?: string;
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
  { id: 'alma' as const, libelle: 'Alma', detail: 'Par carte, frais à sa charge' },
];

/**
 * La composition d'une cure : les séances par technologie, le montant qui en
 * découle, et l'échéancier. Sert au devis d'un bilan comme à la création
 * d'une cure suivante — les deux doivent calculer exactement pareil.
 */
export default function CompositionCure({
  grille,
  complement,
  catalogue = [],
  seancesInitiales,
  optionsModifiables = false,
  seancesOffertes = 0,
  centreId,
  onChange,
}: Props) {
  /*
    Une cliente suivie en radiofréquence qui reprend une cure n'a pas à
    repasser son Profil Signature : la thérapeute compose, comme pour la
    perte de poids. Ce que le centre tient décide de ce qu'on propose.
  */
  const antiAge = soinsAntiAgeDuCentre(centreId);
  /*
    Le Psio, à Sérignan : un soin de plus, sans bilan, qu'on vend aussi à une
    cliente qui revient sans repasser son BioPortrait. Il se vend par
    formules — 6 ou 8 séances —, jamais à la séance.
  */
  const psio: Technologie[] = psioDisponible(centreId) ? ['psio'] : [];
  const [seances, setSeances] = useState<Record<Technologie, number>>({
    luxo: seancesInitiales?.luxo ?? 16,
    relax: seancesInitiales?.relax ?? 0,
    ishape: seancesInitiales?.ishape ?? 0,
    presso: seancesInitiales?.presso ?? 0,
    dome: seancesInitiales?.dome ?? 0,
    psio: seancesInitiales?.psio ?? 0,
    // Une cure suivante se compose parmi les soins de la perte de poids ;
    // les deux bilans anti-âge ont les leurs, et leurs cures naissent de là.
    advance_lift: seancesInitiales?.advance_lift ?? 0,
    radiofrequence: seancesInitiales?.radiofrequence ?? 0,
    hydroporation: seancesInitiales?.hydroporation ?? 0,
  });
  /*
    ALMA EST PROPOSÉ EN PREMIER (Jonathan, 27 octobre 2026).

    Le centre est payé tout de suite et ne porte pas le risque, alors que
    les chèques l'étalent sur plusieurs mois. Les chèques restent à un clic
    — le bouton est juste à côté —, et les deux calculs sont inchangés :
    seul l'ordre de la proposition change.
  */
  const [methode, setMethode] = useState<'centre' | 'alma'>('alma');
  const [nEcheances, setNEcheances] = useState(4);
  const [guide, setGuide] = useState(true);
  // Tant que la thérapeute n'a pas décidé elle-même, la tenue suit la
  // prescription : elle s'ajoute dès qu'il y a de l'I-Shape.
  const [tenueChoisie, setTenueChoisie] = useState<boolean | null>(null);
  // Les boîtes de compléments, code du produit → nombre. Rien par défaut.
  const [boites, setBoites] = useState<Record<string, number>>({});

  // Les séances gagnées sont dues : on les pose d'emblée, sur la
  // luxothérapie, et la thérapeute déplace ou réduit si besoin.
  const [offertes, setOffertes] = useState(seancesOffertes);
  const [technoOfferte, setTechnoOfferte] = useState<Technologie>('luxo');

  /*
    La radiofréquence a deux formats et deux prix : visage et cou en trente
    minutes, décolleté compris en une heure. Le décolleté ne s'impose jamais
    tout seul — c'est la thérapeute qui le propose.
  */
  const [avecDecollete, setAvecDecollete] = useState(false);

  /*
    LE BILAN ANTI-ÂGE, 89 € (Jonathan, 16 octobre 2026).

    Une cliente déjà suivie qui repart sur de l'anti-âge refait son bilan, et
    il se facture — c'est le premier rendez-vous du Profil Signature, le même
    tarif. Sur le devis du bilan ces 89 € sont déjà dans le total ; ici ils
    n'étaient comptés nulle part, et une cure d'anti-âge vendue par ce
    formulaire partait sans son bilan.

    La case ne s'affiche que là où ce bilan existe — le Crès et Sérignan. Au
    Grau-du-Roi, rien ne se facture à part : c'est la première séance
    d'Advance Lift qui se règle. Et elle ne se coche jamais toute seule :
    facturer 89 € sans que personne l'ait décidé serait pire que l'oublier.
  */
  const bilanProposable = bilanAntiAgeFacturable(centreId);
  const [bilanAntiAge, setBilanAntiAge] = useState(false);
  const bilanRetenu = bilanProposable && bilanAntiAge;

  const electro = seances.ishape > 0;

  /*
    Le guide et la tenue appartiennent à la perte de poids. Une cure
    d'anti-âge seul ne les porte pas — le guide est celui du rééquilibrage
    alimentaire, la tenue celle de l'I-Shape. Les laisser cochés ajoutait
    89 € à une cure de radiofréquence.
  */
  const aUnSoinPertePoids = TECHNOS_PRINCIPALES.some((t) => seances[t] > 0);
  const tenue = aUnSoinPertePoids && (tenueChoisie ?? electro);

  const lignes = useMemo(
    () =>
      [...TECHNOS_PRINCIPALES, ...psio, ...antiAge].map((t) => ({
        technologie: t,
        seances: seances[t],
        prixUnitaire:
          t === 'radiofrequence' && avecDecollete
            ? grille.radiofrequence_decollete
            : prixUnitaireParDefaut(t, grille),
      })),
    // `antiAge` est recalculé à chaque rendu mais ne dépend que du centre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seances, grille, centreId, avecDecollete],
  );

  const complements = useMemo(
    () => complementsChoisis(boites, catalogue, grille.complement),
    [boites, catalogue, grille.complement],
  );

  const guideRetenu = guide && aUnSoinPertePoids;

  const detail = useMemo(
    () =>
      calculerMontant(
        lignes,
        { tenue, guide: guideRetenu, boites: nombreDeBoites(complements), bilan: bilanRetenu },
        grille,
      ),
    [lignes, tenue, guideRetenu, complements, grille, bilanRetenu],
  );

  const offertesPosees = Math.min(offertes, seancesOffertes);

  /*
    L'ACOMPTE, POUR CELLE QUI DIT OUI SANS POUVOIR TOUT RÉGLER AUJOURD'HUI.

    Le même geste qu'au bilan, à une chose près : il n'y a pas de bilan à
    couvrir. Le BioPortrait a été fait et facturé sur la première cure, et
    on ne le refacture pas parce qu'elle revient. L'acompte ne porte donc
    que LES CRÉNEAUX DÉJÀ BLOQUÉS pour elle — une demi-heure par soin, trois
    soins enchaînés font une heure et demie, donc trois séances dues.

    Il se déduit du total, c'est son premier règlement. Au centre seulement :
    chez Alma, le crédit couvre déjà la totalité et le centre est payé à la
    signature. Rangé par défaut — le cas courant est de ne pas en demander.
  */
  const [acompteOuvert, setAcompteOuvert] = useState(false);
  const [creneaux, setCreneaux] = useState<number | null>(null);

  /*
    Le même plafond qu'au bilan : la cure ne se règle pas plus longtemps
    qu'elle ne dure. La Relaxation et le Psio ne comptent pas parmi les soins
    principaux — ils s'ajoutent à une venue existante au lieu d'en demander
    une. La règle est dans `soins.ts`, partagée avec le devis du bilan.
  */
  const soinsPrincipaux = lignes.filter(
    (l) => l.seances > 0 && demandeUneVenue(l.technologie),
  ).length;
  const seancesDuPlusLong = lignes.reduce((n, l) => Math.max(n, l.seances), 0);
  const dureeMois = dureeCureEnMois(seancesDuPlusLong, soinsPrincipaux);
  // Le cinquième chèque ne s'ouvre qu'à partir de vingt luxo.
  const seancesLuxo = lignes.find((l) => l.technologie === 'luxo')?.seances ?? 0;
  const choixEcheances =
    methode === 'centre' ? echeancesCentrePossibles(dureeMois, seancesLuxo) : ECHEANCES_ALMA;
  const nRetenu = choixEcheances.includes(nEcheances)
    ? nEcheances
    : (choixEcheances[choixEcheances.length - 1] ?? 1);

  /*
    Le nombre retenu, et non celui qui traîne dans l'état : la thérapeute a
    pu ouvrir l'acompte sur trois soins puis en retirer un.
  */
  const soinsRetenus = lignes.filter((l) => l.seances > 0).length;
  const creneauxRetenus = creneaux ?? creneauxParDefaut(soinsRetenus);
  const acompte =
    acompteOuvert && methode === 'centre'
      ? montantAcompte({
          // Pas de bilan ici : il a été facturé avec la première cure.
          prixBilan: 0,
          creneauxReserves: creneauxRetenus,
          prixSeance: grille.seance,
        })
      : 0;

  const echeancier = useMemo(
    () =>
      construireEcheancierCure({
        seances: detail.totalSeances,
        prixSeance: grille.seance,
        montantSeances: detail.montantSeances,
        // Tout ce qui n'est pas une séance tombe sur la première échéance.
        options:
          detail.montantGuide +
          detail.montantTenue +
          detail.montantComplements +
          detail.montantBilan,
        methode,
        n: nRetenu,
        acompte,
      }),
    [detail, grille.seance, methode, nRetenu, acompte],
  );

  useEffect(() => {
    onChange(
      {
        lignes,
        electro,
        tenue,
        guide: guideRetenu,
        offertes:
          offertesPosees > 0 ? { technologie: technoOfferte, seances: offertesPosees } : null,
        complements,
        prixBilan: detail.montantBilan,
        montantTotal: detail.total,
        modeReglement: echeancier.mode,
        frais: echeancier.frais,
        echeances: echeancier.echeances,
      },
      detail.totalSeances,
    );
    // onChange est recréée à chaque rendu du parent : on ne l'observe pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, electro, tenue, guideRetenu, detail, echeancier, offertesPosees, technoOfferte, complements]);

  /* Chez Alma, l'acompte n'a pas de sens : on le referme en changeant de méthode. */
  function changerDeMethode(m: 'centre' | 'alma') {
    setMethode(m);
    setNEcheances(4);
    if (m === 'alma') {
      setAcompteOuvert(false);
      setCreneaux(null);
    }
  }

  function ajuster(t: Technologie, delta: number) {
    setSeances((s) => ({ ...s, [t]: ajusterSeancesDuSoin(t, s[t], delta) }));
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

          {/*
            Le Psio se range avec les soins de la perte de poids : il
            s'enchaîne après l'un d'eux, dans la même venue. Son libellé dit
            qu'il se vend par formules, sans quoi les « − » et « + » qui
            sautent de 6 à 8 passeraient pour une panne.
          */}
          {psio.map((t) => (
            <LigneSeances
              key={t}
              libelle={`${LIBELLES_TECHNOLOGIE[t]} · 6 ou 8 séances`}
              valeur={seances[t]}
              onMoins={() => ajuster(t, -1)}
              onPlus={() => ajuster(t, 1)}
            />
          ))}

          {/*
            Les soins anti-âge du centre, à part : ce n'est pas le même
            accompagnement, et les mélanger dans la même liste laisserait
            croire qu'une cure les enchaîne.
          */}
          {antiAge.length > 0 && (
            <div className="bg-violet-50/50 px-5 py-2">
              <p className="text-2xs font-semibold uppercase tracking-widest text-violet-600">
                Anti-âge
              </p>
            </div>
          )}
          {antiAge.map((t) => (
            <LigneSeances
              key={t}
              libelle={LIBELLES_TECHNOLOGIE[t]}
              valeur={seances[t]}
              onMoins={() => ajuster(t, -1)}
              onPlus={() => ajuster(t, 1)}
            />
          ))}

          {/* Deux formats, deux prix : le décolleté ne s'impose pas tout seul. */}
          {antiAge.includes('radiofrequence') && seances.radiofrequence > 0 && (
            <div className="grid gap-2 px-5 py-3 sm:grid-cols-2">
              {[
                { avec: false, titre: 'Visage et cou', detail: '30 minutes', prix: grille.radiofrequence },
                {
                  avec: true,
                  titre: 'Visage, cou et décolleté',
                  detail: '1 heure',
                  prix: grille.radiofrequence_decollete,
                },
              ].map((f) => (
                <button
                  key={f.titre}
                  type="button"
                  onClick={() => setAvecDecollete(f.avec)}
                  className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                    avecDecollete === f.avec
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-ardoise-200 bg-white hover:border-violet-200'
                  }`}
                >
                  <span className="block text-sm font-semibold text-ardoise-900">{f.titre}</span>
                  <span className="block text-xs text-ardoise-500">
                    {f.detail} · {formaterEuros(f.prix)} la séance
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5 border-t border-ardoise-100 bg-ardoise-50/60 px-5 py-4 text-sm">
          {optionsModifiables ? (
            <>
              <p className="mb-1 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                À facturer — décochez ce qui a déjà été remis
              </p>
              <Option
                coche={guideRetenu}
                onChange={setGuide}
                libelle="Guide de rééquilibrage alimentaire"
                prix={formaterEuros(grille.guide)}
                note={!aUnSoinPertePoids ? 'Aucun soin de perte de poids dans cette cure' : undefined}
              />
              <Option
                coche={tenue}
                onChange={(v) => setTenueChoisie(v)}
                libelle="Sous-tenue I-Shape"
                prix={formaterEuros(grille.tenue)}
                note={!electro ? 'Aucune électrostimulation prescrite' : undefined}
              />
              {bilanProposable && (
                <Option
                  coche={bilanAntiAge}
                  onChange={setBilanAntiAge}
                  libelle="Bilan anti-âge"
                  prix={formaterEuros(grille.bilan_signature)}
                  note="À cocher si elle refait son bilan ce jour-là"
                />
              )}
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

      <ChoixComplements
        catalogue={catalogue}
        prix={grille.complement}
        quantites={boites}
        onChange={setBoites}
        recommandation={complement}
      />

      {seancesOffertes > 0 && (
        <section className="carte border-marine-200 bg-marine-50 p-5">
          <div className="flex items-start gap-3">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-marine-700" />
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

      <section className="overflow-hidden rounded-xl bg-marine-900 text-white shadow-flottante">
        <div className="px-6 py-7 text-center">
          <p className="text-2xs font-semibold uppercase tracking-widest text-marine-300">
            Son accompagnement personnalisé
          </p>
          <p className="chiffres mt-2 text-5xl font-bold">{formaterEuros(detail.total)}</p>
          <p className="mt-2 text-sm text-marine-200">
            {detail.totalSeances + offertesPosees === 0 && detail.montantComplements > 0
              ? 'Compléments seulement, aucune séance'
              : `${detail.totalSeances + offertesPosees} séance${
                  detail.totalSeances + offertesPosees > 1 ? 's' : ''
                } au programme`}
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
                {formaterEurosJuste(echeancier.echeances[1].montant)}
              </strong>{' '}
              par mois
            </p>
          )}
        </div>

        <div
          className={`grid gap-px bg-marine-800 text-center text-xs ${
            detail.montantComplements > 0 ? 'grid-cols-4' : 'grid-cols-3'
          }`}
        >
          <Detail libelle="Séances" valeur={formaterEuros(detail.montantSeances)} />
          <Detail libelle="Guide" valeur={guide ? formaterEuros(detail.montantGuide) : '—'} />
          <Detail
            libelle="Tenue I-Shape"
            valeur={tenue ? formaterEuros(detail.montantTenue) : '—'}
          />
          {detail.montantComplements > 0 && (
            <Detail libelle="Compléments" valeur={formaterEuros(detail.montantComplements)} />
          )}
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
                onClick={() => changerDeMethode(m.id)}
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
        {methode === 'centre' && detail.totalSeances > 0 && pourquoiPasPlusDeCheques(dureeMois, seancesLuxo) && (
          <p className="mt-3 text-xs text-ardoise-500">
            {pourquoiPasPlusDeCheques(dureeMois, seancesLuxo)}
          </p>
        )}

        {methode === 'alma' && detail.total > 0 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Frais Alma de {String(tauxFraisAlma(echeancier.n, detail.total)).replace('.', ',')} % —{' '}
            {formaterEuros(echeancier.frais, 2)} à sa charge. Total réglé :{' '}
            <strong className="font-semibold">{formaterEuros(echeancier.montantARegler, 2)}</strong>.
          </p>
        )}

        {methode === 'centre' &&
          detail.montantGuide + detail.montantTenue + detail.montantComplements > 0 && (
            <p className="mt-3 text-xs text-ardoise-500">
              Sans frais.{' '}
              {detail.montantComplements > 0
                ? 'Le guide, la tenue et les compléments'
                : 'Le guide et la tenue'}{' '}
              (
              {formaterEuros(
                detail.montantGuide + detail.montantTenue + detail.montantComplements,
              )}
              ) sont portés par la première échéance.
            </p>
          )}

        {/*
          L'acompte, rangé tant qu'on n'en a pas besoin. Au centre seulement :
          chez Alma le crédit couvre déjà tout.
        */}
        {methode === 'centre' && detail.total > 0 && (
          <div className="mt-4 border-t border-ardoise-100 pt-3">
            {!acompteOuvert ? (
              <button
                type="button"
                onClick={() => setAcompteOuvert(true)}
                className="text-xs font-semibold text-marine-700 underline underline-offset-2 hover:text-marine-900"
              >
                Impossible de tout régler aujourd’hui ?
              </button>
            ) : (
              <div className="rounded-xl border border-marine-200 bg-marine-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-marine-900">Acompte aujourd’hui</span>
                  <button
                    type="button"
                    onClick={() => setCreneaux(Math.max(0, creneauxRetenus - 1))}
                    className="h-6 w-6 rounded-md border border-ardoise-200 bg-white leading-none text-ardoise-700 hover:border-marine-400"
                    aria-label="Un créneau de moins"
                  >
                    −
                  </button>
                  <span className="chiffres text-sm font-semibold text-ardoise-900">
                    {creneauxRetenus} créneau{creneauxRetenus > 1 ? 'x' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreneaux(creneauxRetenus + 1)}
                    className="h-6 w-6 rounded-md border border-ardoise-200 bg-white leading-none text-ardoise-700 hover:border-marine-400"
                    aria-label="Un créneau de plus"
                  >
                    +
                  </button>
                  <span className="chiffres ml-auto text-base font-bold text-marine-800">
                    {formaterEuros(acompte)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAcompteOuvert(false);
                      setCreneaux(null);
                    }}
                    className="text-xs text-ardoise-500 underline underline-offset-2 hover:text-ardoise-800"
                  >
                    Retirer
                  </button>
                </div>
                <p className="mt-2 text-xs text-ardoise-600">
                  {creneauxRetenus} créneau{creneauxRetenus > 1 ? 'x' : ''} de 30 minutes bloqué
                  {creneauxRetenus > 1 ? 's' : ''} dans le planning. Il se déduit du total, et la
                  première échéance tombe quinze jours après.
                </p>
              </div>
            )}
          </div>
        )}

        {echeancier.echeances.length > 1 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {echeancier.echeances.map((e) => (
              <div
                key={`${e.type ?? 'echeance'}-${e.rang}`}
                className={`rounded-lg border px-3 py-2 ${
                  e.type === 'acompte'
                    ? 'border-marine-300 bg-marine-50'
                    : 'border-ardoise-200 bg-ardoise-50'
                }`}
              >
                <div
                  className={`text-2xs font-semibold uppercase tracking-wide ${
                    e.type === 'acompte' ? 'text-marine-700' : 'text-ardoise-400'
                  }`}
                >
                  {e.type === 'acompte' ? 'Acompte' : `${e.rang}${e.rang === 1 ? 'ère' : 'ème'}`}
                </div>
                <div className="chiffres text-sm font-bold text-ardoise-900">
                  {formaterEurosJuste(e.montant)}
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
        className="h-4 w-4 shrink-0 rounded border-ardoise-300 text-marine-700 focus:ring-marine-500"
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
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-marine-700" strokeWidth={3} />
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
