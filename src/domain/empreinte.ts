/*
  Moteur Empreinte.

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

export type TypeEtape = 'radio' | 'slider' | 'text' | 'contact' | 'transition';

export interface EtapeBareme {
  phase?: 'client' | 'analyse';
  type: TypeEtape;
  /** Intitulé de la question. */
  t?: string;
  /** Options : [libellé, points par axe]. */
  o?: Array<[string, Partial<Record<Axe, number>>]>;
  /** Question d'arbitrage, pondérée plus fort. */
  major?: boolean;
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

export interface Bareme {
  STEPS: EtapeBareme[];
  AX: Record<Axe, DescriptionAxe>;
  CURE_PRIO: Record<AxeTerrain, string>;
  TERRAIN_COMPL: Record<AxeTerrain, { n: string; r: string }>;
}

/** Index de l'étape → index de l'option choisie. */
export type Reponses = Record<number, number>;

export interface Empreinte {
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

/**
 * Score maximum atteignable par axe. Sert à normaliser en pourcentage pour
 * que les dix jauges soient comparables entre elles.
 */
export function scoresMaximum(bareme: Bareme): Record<Axe, number> {
  const max = Object.fromEntries(TOUS_AXES.map((a) => [a, 0])) as Record<Axe, number>;

  for (const etape of bareme.STEPS) {
    if (etape.type !== 'radio' || !etape.o) continue;
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

export function calculerEmpreinte(bareme: Bareme, reponses: Reponses): Empreinte {
  const brut = Object.fromEntries(TOUS_AXES.map((a) => [a, 0])) as Record<Axe, number>;

  bareme.STEPS.forEach((etape, index) => {
    if (etape.type !== 'radio' || !etape.o) return;
    const choix = reponses[index];
    if (choix == null) return;
    const poids = etape.o[choix]?.[1] ?? {};
    for (const [axe, points] of Object.entries(poids)) {
      brut[axe as Axe] += points as number;
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

/** Les 7 mesures InBody, dans l'ordre où elles sont saisies. */
export const LIBELLES_INBODY = [
  'Graisse viscérale',
  'Masse musculaire',
  'Métabolisme',
  'Localisation',
  'Rétention',
  'Âge métabolique',
  'Masse grasse',
];

export interface MesureInbody {
  libelle: string;
  valeur: string;
}

/** Reconstitue les mesures InBody lisibles à partir des réponses. */
export function mesuresInbody(bareme: Bareme, reponses: Reponses): MesureInbody[] {
  const sortie: MesureInbody[] = [];
  let rang = 0;

  bareme.STEPS.forEach((etape, index) => {
    if (etape.phase !== 'analyse' || etape.type !== 'radio' || !etape.o) return;
    const choix = reponses[index];
    if (choix != null) {
      sortie.push({ libelle: LIBELLES_INBODY[rang] ?? etape.t ?? '', valeur: etape.o[choix][0] });
    }
    rang += 1;
  });

  return sortie;
}

/** Une phrase de synthèse pour la restitution, nuancée par les axes secondaires. */
export function phraseSynthese(bareme: Bareme, e: Empreinte): string {
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
    `Votre empreinte associe un profil ${bareme.AX[e.profilDominant].name} ` +
    `à un terrain ${bareme.AX[e.terrainDominant].name}.${nuance} ` +
    `Cette combinaison est la vôtre, et elle seule guide votre parcours.`
  );
}

/** Le complément orienté par le terrain dominant. */
export function complementRecommande(bareme: Bareme, e: Empreinte): { nom: string; raison: string } | null {
  const c = bareme.TERRAIN_COMPL[e.terrainDominant];
  return c ? { nom: c.n, raison: c.r } : null;
}

export function prioriteCure(bareme: Bareme, e: Empreinte): string {
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
