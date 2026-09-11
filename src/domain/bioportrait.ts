/*
  Moteur BioPortrait.

  Le questionnaire et sa pondération ne sont pas écrits ici : ils vivent dans
  la table `bareme_empreinte`, en base. Ce module ne contient que les règles
  de calcul, qui s'appliquent à n'importe quelle version du barème.

  Conséquence : faire évoluer le questionnaire ne demande aucune modification
  de code, et les bilans passés restent recalculables puisque chacun retient
  le numéro de version qui l'a produit.
*/

export const AXES_PROFIL = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;
export const AXES_TERRAIN = ['T1', 'T2', 'T3', 'T4', 'T5'] as const;

export type AxeProfil = (typeof AXES_PROFIL)[number];
export type AxeTerrain = (typeof AXES_TERRAIN)[number];
export type Axe = AxeProfil | AxeTerrain;

/** Au-dessus de ce pourcentage, un axe secondaire est « présent » et non « en fond ». */
export const SEUIL_PRESENCE = 60;

export type TypeEtape =
  | 'radio'
  | 'multi'
  | 'yesno'
  | 'slider'
  | 'text'
  | 'contact'
  | 'transition';

/** Les quatre prestations que le questionnaire peut recommander. */
export type Prestation = 'LUXO' | 'RELAX' | 'ISHAPE' | 'PRESSO';

/**
 * Ce qu'une réponse dit d'un soin :
 *   « rem »  le soin est retiré — contre-indication franche ;
 *   « med »  le soin reste possible, sous réserve d'un avis médical.
 */
export type ContreIndication = 'rem' | 'med';

/**
 * Le quatrième élément d'une option porte, selon le cas :
 *   — des contre-indications ({ ISHAPE: 'rem' }) ;
 *   — un drapeau d'engagement ('ENG_LOW', 'ENG_HIGH').
 */
export type DrapeauOption = Partial<Record<Prestation, ContreIndication>> | string;

/** [libellé, points par axe, points par prestation, drapeau]. */
export type OptionBareme = [
  string,
  Partial<Record<Axe, number>>,
  Partial<Record<Prestation, number>>?,
  DrapeauOption?,
];

export interface EtapeBareme {
  phase?: 'client' | 'analyse';
  type: TypeEtape;
  /** Thème de la question : elig, alim, emo, image, energie, corps, histo. */
  cat?: string;
  /** Intitulé de la question. */
  t?: string;
  /** Précision affichée sous la question. */
  hint?: string;
  o?: OptionBareme[];
  /** Question d'arbitrage, pondérée plus fort. */
  major?: boolean;
  /** Mesure InBody qui porte le score sur 100. */
  score?: boolean;
  left?: string;
  right?: string;
}

export interface DescriptionAxe {
  name: string;
  sig: string;
  feel: string;
  imp: string[];
  note: string;
}

/** Un palier du barème de prescription : à partir de tant de points… */
export interface PalierPrestation {
  min: number;
  /** Séances proposées à ce palier. 0 = le soin n'est pas retenu. */
  s: number;
  /** prop : proposé · fort : fortement conseillé · oblig : indispensable. */
  l: 'prop' | 'fort' | 'oblig' | null;
}

export interface Bareme {
  STEPS: EtapeBareme[];
  AX: Record<Axe, DescriptionAxe>;
  CURE_PRIO: Record<AxeTerrain, string>;
  TERRAIN_COMPL: Record<AxeTerrain, { n: string; r: string }>;
  /** Thèmes des questions : [libellé, fond, encre]. */
  CAT?: Record<string, [string, string, string]>;
  PRESTA?: Record<Prestation, { n: string; d: string }>;
  BAREME_PRESTA?: Record<Prestation, PalierPrestation[]>;
  METAB?: Array<{ lvl: string; col: string; bg: string; bd: string; p: string }>;
  /**
   * Les formules décrites dans le barème. **Plus lues par l'application.**
   *
   * Elles y tenaient en un facteur — 1, 0,8, 0,5 — tant qu'une formule
   * n'était qu'une multiplication. Équilibre retombe désormais sur des
   * paliers réels et Découverte choisit une prestation : une règle pareille
   * ne tient pas dans une donnée. Les trois formules vivent dans
   * `domain/prescription`, avec le reste du calcul. Le champ reste déclaré
   * pour que les barèmes déjà en base restent lisibles.
   */
  FORMULAS?: Array<{ f: number; n: string; d: string; rec?: boolean }>;
  INCLUS?: Array<{ i: string; t: string; d: string }>;
}

/**
 * Index de l'étape → réponse. Un nombre pour un choix unique, un tableau
 * d'index pour les questions à cases à cocher.
 */
export type Reponses = Record<number, number | number[]>;

/** Les index choisis à une étape, quel que soit son type. */
export function choix(reponses: Reponses, index: number): number[] {
  const r = reponses[index];
  if (r == null) return [];
  return Array.isArray(r) ? r : [r];
}

export interface BioPortrait {
  pourcentages: Record<Axe, number>;
  profilsTries: AxeProfil[];
  terrainsTries: AxeTerrain[];
  profilDominant: AxeProfil;
  terrainDominant: AxeTerrain;
  /** Axes secondaires au-dessus du seuil de présence. */
  profilsSecondaires: AxeProfil[];
  terrainsSecondaires: AxeTerrain[];
}

const TOUS_AXES: Axe[] = [...AXES_PROFIL, ...AXES_TERRAIN];

/** Les types d'étape qui portent des options notées. */
const EST_QUESTION: TypeEtape[] = ['radio', 'multi', 'yesno'];

/**
 * Score maximum atteignable par axe. Sert à normaliser en pourcentage pour
 * que les dix jauges soient comparables entre elles.
 */
export function scoresMaximum(bareme: Bareme): Record<Axe, number> {
  const max = Object.fromEntries(TOUS_AXES.map((a) => [a, 0])) as Record<Axe, number>;

  for (const etape of bareme.STEPS) {
    if (!etape.o || !EST_QUESTION.includes(etape.type)) continue;
    for (const axe of TOUS_AXES) {
      let maxEtape = 0;
      for (const [, poids] of etape.o) {
        const p = poids?.[axe] ?? 0;
        if (p > maxEtape) maxEtape = p;
      }
      max[axe] += maxEtape;
    }
  }

  return max;
}

export function calculerBioPortrait(bareme: Bareme, reponses: Reponses): BioPortrait {
  const brut = Object.fromEntries(TOUS_AXES.map((a) => [a, 0])) as Record<Axe, number>;

  bareme.STEPS.forEach((etape, index) => {
    if (!etape.o || !EST_QUESTION.includes(etape.type)) return;

    for (const i of choix(reponses, index)) {
      const poids = etape.o[i]?.[1] ?? {};
      for (const [axe, points] of Object.entries(poids)) {
        brut[axe as Axe] += points as number;
      }
    }
  });

  const max = scoresMaximum(bareme);
  const pourcentages = Object.fromEntries(
    TOUS_AXES.map((a) => [a, max[a] ? Math.round((brut[a] / max[a]) * 100) : 0]),
  ) as Record<Axe, number>;

  const profilsTries = [...AXES_PROFIL].sort((a, b) => pourcentages[b] - pourcentages[a]);
  const terrainsTries = [...AXES_TERRAIN].sort((a, b) => pourcentages[b] - pourcentages[a]);

  return {
    pourcentages,
    profilsTries,
    terrainsTries,
    profilDominant: profilsTries[0],
    terrainDominant: terrainsTries[0],
    profilsSecondaires: profilsTries.slice(1).filter((a) => pourcentages[a] >= SEUIL_PRESENCE),
    terrainsSecondaires: terrainsTries.slice(1).filter((a) => pourcentages[a] >= SEUIL_PRESENCE),
  };
}

export interface MesureInbody {
  libelle: string;
  valeur: string;
}

/** Reconstitue les mesures InBody lisibles à partir des réponses. */
/*
  Les mesures relevées sur la balance, telles que la cliente les lira.

  Les libellés viennent du BARÈME, jamais d'une liste écrite ici. Il y en a
  eu une : sept intitulés figés, hérités d'une version du questionnaire qui
  posait sept questions d'analyse. La version 3 n'en pose que cinq, et les
  deux dernières se retrouvaient étiquetées avec les libellés des rangs
  précédents — « Score InBody » s'affichait sous le nom « Rétention », sur
  la fiche comme dans le récapitulatif envoyé à la cliente.

  Le barème est versionné et chaque bilan retient le sien : lire l'intitulé
  dedans nomme donc juste, y compris pour les bilans passés.
*/
export function mesuresInbody(bareme: Bareme, reponses: Reponses): MesureInbody[] {
  const sortie: MesureInbody[] = [];

  bareme.STEPS.forEach((etape, index) => {
    if (etape.phase !== 'analyse' || etape.type !== 'radio' || !etape.o) return;

    const [i] = choix(reponses, index);
    if (i != null) {
      sortie.push({ libelle: etape.t ?? '', valeur: etape.o[i][0] });
    }
  });

  return sortie;
}

/** Une phrase de synthèse pour la restitution, nuancée par les axes secondaires. */
export function phraseSynthese(bareme: Bareme, e: BioPortrait): string {
  const secondaires = [
    ...e.profilsSecondaires.slice(0, 1),
    ...e.terrainsSecondaires.slice(0, 1),
  ].map((a) => bareme.AX[a].name.toLowerCase());

  const nuance =
    secondaires.length === 0
      ? ''
      : secondaires.length === 1
        ? ` Une force secondaire la nuance : ${secondaires[0]}.`
        : ` Deux forces secondaires la nuancent : ${secondaires.join(' et ')}.`;

  return (
    `Votre BioPortrait associe un profil ${bareme.AX[e.profilDominant].name} ` +
    `à un terrain ${bareme.AX[e.terrainDominant].name}.${nuance} ` +
    `Cette combinaison est la vôtre, et elle seule guide votre parcours.`
  );
}

/** Le complément orienté par le terrain dominant. */
export function complementRecommande(bareme: Bareme, e: BioPortrait): { nom: string; raison: string } | null {
  const c = bareme.TERRAIN_COMPL[e.terrainDominant];
  return c ? { nom: c.n, raison: c.r } : null;
}

export function prioriteCure(bareme: Bareme, e: BioPortrait): string {
  return bareme.CURE_PRIO[e.terrainDominant] ?? '';
}

/** Indices des étapes réellement posées à la cliente (hors InBody et écrans de service). */
export function etapesCliente(bareme: Bareme): number[] {
  return bareme.STEPS.map((e, i) => ({ e, i }))
    .filter(({ e }) => e.phase === 'client')
    .map(({ i }) => i);
}

export function etapesInbody(bareme: Bareme): number[] {
  return bareme.STEPS.map((e, i) => ({ e, i }))
    .filter(({ e }) => e.phase === 'analyse')
    .map(({ i }) => i);
}

// ---------------------------------------------------------------------------
// Relire ce que la cliente a répondu
// ---------------------------------------------------------------------------

export interface ReponseLue {
  /** Le code du thème dans le barème (`elig`, `alim`…) : l'écran y lit ses couleurs. */
  cle: string;
  /** Le thème de la question, tel que le barème le nomme. */
  theme: string;
  question: string;
  /**
   * Ce qu'elle a choisi, en toutes lettres. Plusieurs entrées pour une
   * question à cases ; vide si elle n'a pas répondu.
   */
  reponses: string[];
  /** Pour le curseur : la position, et ce qu'il y a à chaque bout. */
  curseur?: { valeur: number; gauche: string; droite: string };
}

/**
 * Les réponses d'un bilan, question par question, dans l'ordre où elles ont
 * été posées.
 *
 * On relit le questionnaire tel qu'il était CE JOUR-LÀ : les réponses sont
 * indexées sur les étapes de leur propre barème, et une version plus récente
 * en déplace. Les mesures InBody n'y sont pas — ce ne sont pas des réponses
 * de la cliente — ni le texte libre, qui a déjà sa place sur la fiche.
 */
export function relireLesReponses(
  bareme: Bareme,
  reponses: Reponses,
  curseur: number | null,
): ReponseLue[] {
  const lues: ReponseLue[] = [];

  bareme.STEPS.forEach((etape, index) => {
    if (etape.phase !== 'client') return;
    const cle = etape.cat ?? '';
    const theme = bareme.CAT?.[cle]?.[0] ?? '';

    if (EST_QUESTION.includes(etape.type)) {
      const options = etape.o ?? [];
      lues.push({
        cle,
        theme,
        question: etape.t ?? '',
        reponses: choix(reponses, index)
          .map((i) => options[i]?.[0])
          .filter((l): l is string => typeof l === 'string'),
      });
      return;
    }

    if (etape.type === 'slider' && curseur != null) {
      lues.push({
        cle,
        theme,
        question: etape.t ?? '',
        reponses: [],
        curseur: { valeur: curseur, gauche: etape.left ?? '', droite: etape.right ?? '' },
      });
    }
  });

  return lues;
}
