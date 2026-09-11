/*
  Le Bio-Portrait Anti-Âge.

  Un second questionnaire, proposé au Grau-du-Roi seulement, qui produit
  deux résultats : un PROFIL anti-âge — ce dont la peau a besoin — et un
  TERRAIN cutané — comment elle réagit. Il ne prescrit rien : « le soin et
  le nombre de séances restent à la décision de la praticienne ». Le soin
  est l'Advance Lift, et c'est la thérapeute qui dit combien de séances.

  Le questionnaire vit en base (`bareme_anti_age`), versionné, comme celui
  de la perte de poids. Ce fichier ne connaît que la règle de calcul.

  Spécification de Jonathan du 11 septembre 2026.
*/

/** Le seul centre qui tient l'Advance Lift : le bilan ne se propose que là. */
export const CENTRE_ANTI_AGE = 'grau-du-roi';

export type AxeAntiAge = 'fermete' | 'rides' | 'hydratation' | 'densite';
export type ProfilAntiAge = 'fermete_ovale' | 'rides_densite' | 'hydratation_qualite' | 'global';
export type TerrainAntiAge = 'hydratation' | 'sensible' | 'dense' | 'fin';

export const AXES_ANTI_AGE: AxeAntiAge[] = ['fermete', 'rides', 'hydratation', 'densite'];
export const TERRAINS_ANTI_AGE: TerrainAntiAge[] = ['hydratation', 'sensible', 'dense', 'fin'];

/**
 * Une option : [libellé, points par axe, points par terrain]. Une question
 * de profil ne renseigne que le deuxième, une question de terrain que le
 * troisième, une question d'information aucun des deux.
 */
export type OptionAntiAge = [
  string,
  Partial<Record<AxeAntiAge, number>>?,
  Partial<Record<TerrainAntiAge, number>>?,
];

export interface QuestionAntiAge {
  code: string;
  type: 'radio' | 'multi';
  t: string;
  o: OptionAntiAge[];
  /** Question d'information — zone, parcours, historique — sans points. */
  info?: string;
  /** Ne se pose que si telle option a été choisie à telle question. */
  si?: { code: string; option: number };
}

export interface DescriptionProfil {
  nom: string;
  signes: string;
  besoins: string[];
  texte: string;
}

export interface DescriptionTerrain {
  nom: string;
  caracteristiques: string;
  besoins: string[];
  texte: string;
}

export interface BaremeAntiAge {
  AXES: Record<AxeAntiAge, string>;
  PROFILS: Record<ProfilAntiAge, DescriptionProfil>;
  TERRAINS: Record<TerrainAntiAge, DescriptionTerrain>;
  QUESTIONS: QuestionAntiAge[];
  MENTION: string;
}

/** Code de la question → index d'option (ou indices, pour une multi). */
export type ReponsesAntiAge = Record<string, number | number[]>;

export function choixAntiAge(reponses: ReponsesAntiAge, code: string): number[] {
  const r = reponses[code];
  if (r == null) return [];
  return Array.isArray(r) ? r : [r];
}

/** Une question se pose si sa condition est remplie — ou si elle n'en a pas. */
export function questionPosee(q: QuestionAntiAge, reponses: ReponsesAntiAge): boolean {
  if (!q.si) return true;
  return choixAntiAge(reponses, q.si.code).includes(q.si.option);
}

/** Les questions à poser, dans l'ordre, compte tenu des réponses déjà données. */
export function questionsAPoser(bareme: BaremeAntiAge, reponses: ReponsesAntiAge): QuestionAntiAge[] {
  return bareme.QUESTIONS.filter((q) => questionPosee(q, reponses));
}

export interface BioPortraitAntiAge {
  scores: Record<AxeAntiAge, number>;
  scoresTerrain: Record<TerrainAntiAge, number>;
  profil: ProfilAntiAge;
  /**
   * Le terrain dominant. Plusieurs à égalité exacte : un terrain mixte,
   * comme le demande la spécification — « plutôt que de choisir
   * arbitrairement ». Vide si aucune question de terrain n'a marqué de
   * point : la peau ne signale rien de particulier.
   */
  terrains: TerrainAntiAge[];
  /** Les axes qui ont marqué, du plus fort au plus faible — trois au plus. */
  priorites: AxeAntiAge[];
}

/**
 * Le calcul, tel que la spécification le décrit.
 *
 * Profil :
 *   — Fermeté & Ovale quand Fermeté domine ;
 *   — Hydratation & Qualité quand Hydratation / Qualité domine ;
 *   — Rides & Densité quand Rides et Densité sont les deux plus élevés,
 *     ensemble : c'est le seul cas où deux axes hauts ne font pas un
 *     profil global — ils vont par paire ;
 *   — Anti-Âge Global sinon dès que les deux meilleurs scores sont à un
 *     point ou moins d'écart : « plusieurs catégories élevées sans
 *     dominante claire ».
 *
 * Terrain : le plus haut ; à égalité exacte, tous les ex æquo.
 */
export function calculerAntiAge(bareme: BaremeAntiAge, reponses: ReponsesAntiAge): BioPortraitAntiAge {
  const scores: Record<AxeAntiAge, number> = { fermete: 0, rides: 0, hydratation: 0, densite: 0 };
  const scoresTerrain: Record<TerrainAntiAge, number> = { hydratation: 0, sensible: 0, dense: 0, fin: 0 };

  for (const q of bareme.QUESTIONS) {
    if (!questionPosee(q, reponses)) continue;
    for (const i of choixAntiAge(reponses, q.code)) {
      const option = q.o[i];
      if (!option) continue;
      for (const a of AXES_ANTI_AGE) scores[a] += option[1]?.[a] ?? 0;
      for (const t of TERRAINS_ANTI_AGE) scoresTerrain[t] += option[2]?.[t] ?? 0;
    }
  }

  const tries = [...AXES_ANTI_AGE].sort((a, b) => scores[b] - scores[a]);
  const [premier, deuxieme] = tries;
  const paire = new Set([premier, deuxieme]);

  let profil: ProfilAntiAge;
  if (scores[premier] === 0) {
    profil = 'global';
  } else if (paire.has('rides') && paire.has('densite')) {
    profil = 'rides_densite';
  } else if (scores[premier] - scores[deuxieme] <= 1) {
    profil = 'global';
  } else if (premier === 'fermete') {
    profil = 'fermete_ovale';
  } else if (premier === 'hydratation') {
    profil = 'hydratation_qualite';
  } else {
    /* Rides seul, ou Densité seule, nettement devant : la paire. */
    profil = 'rides_densite';
  }

  const maxTerrain = Math.max(...TERRAINS_ANTI_AGE.map((t) => scoresTerrain[t]));
  const terrains = maxTerrain > 0 ? TERRAINS_ANTI_AGE.filter((t) => scoresTerrain[t] === maxTerrain) : [];

  const priorites = tries.filter((a) => scores[a] > 0).slice(0, 3);

  return { scores, scoresTerrain, profil, terrains, priorites };
}

/** « Hydratation / Sensible » pour un terrain mixte, « — » pour aucun. */
export function nomDuTerrain(bareme: BaremeAntiAge, terrains: TerrainAntiAge[]): string {
  if (terrains.length === 0) return 'Aucun terrain particulier';
  return terrains.map((t) => bareme.TERRAINS[t].nom).join(' / ');
}

export interface ReponseAntiAgeLue {
  code: string;
  question: string;
  reponses: string[];
}

/** Les réponses en toutes lettres, pour la carte « Mes réponses » de la fiche. */
export function relireLesReponsesAntiAge(bareme: BaremeAntiAge, reponses: ReponsesAntiAge): ReponseAntiAgeLue[] {
  return questionsAPoser(bareme, reponses).map((q) => ({
    code: q.code,
    question: q.t,
    reponses: choixAntiAge(reponses, q.code)
      .map((i) => q.o[i]?.[0])
      .filter((l): l is string => typeof l === 'string'),
  }));
}
