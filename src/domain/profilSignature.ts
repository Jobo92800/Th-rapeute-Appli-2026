/*
  Le Bilan Profil Signature anti-âge.

  Le troisième bilan de la maison, au Crès et à Sérignan : une cure de
  radiofréquence visage (Mesojet). Il ne ressemble ni au BioPortrait perte
  de poids ni au Bio-Portrait Anti-Âge du Grau-du-Roi, et c'est voulu.

  Ce qu'il a de particulier, et qui explique tout ce fichier :

    — LA THÉRAPEUTE OBSERVE. Après le questionnaire vient une étape de
      cotation : sept zones du visage, du cou et du décolleté, chacune
      notée discrète, modérée ou marquée. Les réponses de la cliente
      PRÉ-COTENT ces zones ; la thérapeute confirme ou corrige devant elle.

    — LES AXES SE CALCULENT MOITIÉ-MOITIÉ. Fermeté, Rides et Hydratation
      valent 50 % questionnaire et 50 % observation ; la Densité ne
      s'observe pas à l'œil nu et reste au questionnaire seul. Tout est
      ramené sur 100, là où les deux autres bilans comptent des points.

    — IL PRESCRIT UNE CURE, d'après les seules zones où la radiofréquence
      agit — les sillons nasogéniens en sont exclus, ils relèvent d'une
      autre approche.

  Comme pour les deux autres, LE QUESTIONNAIRE VIT EN BASE (table
  `bareme_signature`, versionnée) : le faire évoluer ne demande aucune
  modification de code, et un bilan déjà passé se relit dans sa version.
  Ce fichier ne porte que la règle de calcul.

  Les types d'axes et de terrains portent les mêmes noms que ceux du
  Bio-Portrait Anti-Âge sans les partager : les deux bilans sont
  indépendants, l'un peut gagner un axe sans toucher à l'autre.

  Spécification de Jonathan du 21 septembre 2026.
*/

/** Les centres qui tiennent la radiofréquence. Le bilan ne se propose que là. */
export const CENTRES_SIGNATURE = ['le-cres', 'serignan'];

export function signatureDisponible(centreId: string): boolean {
  return CENTRES_SIGNATURE.includes(centreId);
}

export type AxeSignature = 'fermete' | 'rides' | 'hydratation' | 'densite';
export type ProfilSignature = 'fermete_ovale' | 'rides_densite' | 'hydratation_qualite' | 'global';
export type TerrainSignature = 'hydratation' | 'sensible' | 'dense' | 'fin';

export const AXES_SIGNATURE: AxeSignature[] = ['fermete', 'rides', 'hydratation', 'densite'];
export const TERRAINS_SIGNATURE: TerrainSignature[] = ['hydratation', 'sensible', 'dense', 'fin'];

/**
 * Ce que la radiofréquence fait d'une zone. Ce n'est pas un détail
 * d'affichage : `rf` seule entre dans le calcul de la cure.
 *
 *   rf  la radiofréquence agit
 *   pa  effet partiel — le contour des yeux et le front
 *   ot  une autre approche est conseillée — les sillons, liés au volume
 */
export type PorteeZone = 'rf' | 'pa' | 'ot';

export interface ZoneSignature {
  code: string;
  nom: string;
  /** Ce qu'on y regarde, en quelques mots. */
  detail: string;
  portee: PorteeZone;
}

/** Non notée, discrète, modérée, marquée. */
export type Cotation = 0 | 1 | 2 | 3;

export const LIBELLES_COTATION = ['non notée', 'discrète', 'modérée', 'marquée'] as const;

/*
  LES COULEURS DE L'OBSERVATION, ET POURQUOI ELLES SORTENT DE LA CHARTE.

  Cet écran porte deux informations que l'œil doit séparer en une seconde,
  devant une cliente : ce que la radiofréquence peut faire d'une zone, et à
  quel point cette zone est marquée. Les teintes douces de la charte les
  rendaient presque identiques — trois violets pâles les uns à côté des
  autres (Jonathan, 23 septembre 2026). On s'en écarte ici, et seulement
  ici, avec deux échelles qui ne se ressemblent pas :

    — LA PORTÉE, en pastilles pleines : violet, bleu, gris. Trois familles
      de couleur, pas trois nuances d'une seule.
    — L'INTENSITÉ, sur la rampe d'évaluation que la maison connaît déjà
      (celle du score InBody du BioPortrait) : vert, ambre, brique. Elle se
      lit d'un coup, et elle ne croise jamais le rose des gestes qui
      engagent ni le violet du soin — une pastille colorée ne doit jamais
      ressembler à un bouton sur lequel appuyer.

  Le mot reste écrit dans chaque pastille : un œil qui distingue mal le
  rouge du vert lit « marquée » aussi bien que les autres.
*/
export const COULEUR_PORTEE: Record<PorteeZone, { fond: string; texte: string; libelle: string }> = {
  rf: { fond: '#8E6FC6', texte: '#FFFFFF', libelle: 'La radiofréquence agit' },
  pa: { fond: '#3D82C4', texte: '#FFFFFF', libelle: 'Effet partiel' },
  ot: { fond: '#7C9091', texte: '#FFFFFF', libelle: 'Autre approche conseillée' },
};

/** La rampe d'intensité : du signe discret au signe marqué. */
export const COULEUR_COTATION: Record<Cotation, { fond: string; texte: string; pale: string; encre: string }> = {
  0: { fond: '#E6EFEF', texte: '#41595A', pale: '#F4FBFB', encre: '#7C9091' },
  1: { fond: '#2A9D6A', texte: '#FFFFFF', pale: '#E8F5EE', encre: '#1F7A52' },
  2: { fond: '#D9932B', texte: '#FFFFFF', pale: '#FBF1DF', encre: '#8A5D12' },
  3: { fond: '#B4472E', texte: '#FFFFFF', pale: '#FBEAE6', encre: '#8E3522' },
};

/** Une option : [libellé, points par axe, points par terrain]. */
export type OptionSignature = [
  string,
  Partial<Record<AxeSignature, number>>?,
  Partial<Record<TerrainSignature, number>>?,
];

export interface QuestionSignature {
  code: string;
  /** Le groupe où la question se pose : ressenti, miroir, besoins, historique. */
  groupe: string;
  t: string;
  o: OptionSignature[];
  /** Plusieurs réponses possibles. Une multi ne donne jamais de points. */
  multi?: boolean;
  /**
   * La zone que cette question renseigne, et l'intensité que chaque
   * réponse lui donne : `zone: 'ovale', intensites: [0, 2, 3]`.
   */
  zone?: string;
  intensites?: Cotation[];
  /** Les zones qu'une réponse « allume » sans les coter — les besoins. */
  zonesVisees?: string[][];
  /** Ne se pose que si telle option a été choisie à telle question. */
  si?: { code: string; option: number };
}

export interface GroupeSignature {
  id: string;
  titre: string;
  detail?: string;
}

export interface DescriptionProfilSignature {
  nom: string;
  texte: string;
  besoins: string[];
  /** « Ce que la radiofréquence peut apporter », limites comprises. */
  radiofrequence: string;
}

export interface DescriptionTerrainSignature {
  nom: string;
  texte: string;
  /** Une consigne pour la thérapeute, quand le terrain en appelle une. */
  consigne?: string;
}

export interface CureSignature {
  code: string;
  nom: string;
  seances: number;
  mois: number;
  /** Le rythme, en toutes lettres — « 8 séances hebdomadaires, puis… ». */
  rythme: string;
  /** Les semaines où tombe chaque séance, pour dessiner le calendrier. */
  semaines: number[];
  note: string;
  /**
   * Préconisée jusqu'à ce nombre de points inclus. La dernière cure de la
   * liste n'en porte pas : c'est elle au-delà. Les seuils vivent donc dans
   * le barème, et passer de trois cures à deux ne touche pas ce fichier.
   */
  jusqua?: number;
}

export interface BaremeSignature {
  ZONES: ZoneSignature[];
  GROUPES: GroupeSignature[];
  /** Les contre-indications cochées par la thérapeute. Une seule suffit à interdire. */
  SECURITE: string[];
  QUESTIONS: QuestionSignature[];
  PROFILS: Record<ProfilSignature, DescriptionProfilSignature>;
  TERRAINS: Record<TerrainSignature, DescriptionTerrainSignature>;
  CURES: CureSignature[];
  MENTION: string;
}

/** Code de la question → index d'option (ou indices, pour une multi). */
export type ReponsesSignature = Record<string, number | number[]>;

export function choixSignature(reponses: ReponsesSignature, code: string): number[] {
  const r = reponses[code];
  if (r == null) return [];
  return Array.isArray(r) ? r : [r];
}

export function questionPosee(q: QuestionSignature, reponses: ReponsesSignature): boolean {
  if (!q.si) return true;
  return choixSignature(reponses, q.si.code).includes(q.si.option);
}

export function questionsAPoser(bareme: BaremeSignature, reponses: ReponsesSignature): QuestionSignature[] {
  return bareme.QUESTIONS.filter((q) => questionPosee(q, reponses));
}

// ---------------------------------------------------------------------------
// Les maxima, lus sur le barème
// ---------------------------------------------------------------------------

/**
 * Le plus haut score atteignable, axe par axe et terrain par terrain.
 *
 * Calculé sur le barème plutôt qu'écrit à la main : une question ajoutée
 * change les maxima toute seule, et un pourcentage reste un pourcentage.
 * Les multi n'en font pas partie — elles ne donnent pas de points.
 */
export interface MaximaSignature {
  axes: Record<AxeSignature, number>;
  terrains: Record<TerrainSignature, number>;
}

export function maximaSignature(bareme: BaremeSignature): MaximaSignature {
  const axes: Record<AxeSignature, number> = { fermete: 0, rides: 0, hydratation: 0, densite: 0 };
  const terrains: Record<TerrainSignature, number> = { hydratation: 0, sensible: 0, dense: 0, fin: 0 };

  for (const q of bareme.QUESTIONS) {
    if (q.multi) continue;
    for (const a of AXES_SIGNATURE) axes[a] += Math.max(0, ...q.o.map((o) => o[1]?.[a] ?? 0));
    for (const t of TERRAINS_SIGNATURE) terrains[t] += Math.max(0, ...q.o.map((o) => o[2]?.[t] ?? 0));
  }

  return { axes, terrains };
}

// ---------------------------------------------------------------------------
// La carte des zones
// ---------------------------------------------------------------------------

export type CarteDesZones = Record<string, Cotation>;

/**
 * Ce que le questionnaire dit des sept zones, avant que la thérapeute ne
 * regarde la cliente.
 *
 * Pour chaque zone, dans l'ordre :
 *   1. la question du miroir qui la vise a répondu autre chose que « rien
 *      de particulier » → la zone prend cette intensité ;
 *   2. sinon, la zone est visée par ce qui gêne la cliente ou par les zones
 *      qu'elle veut améliorer → modérée si la question du miroir n'a pas
 *      été posée, discrète si elle a répondu « rien » (la cliente s'en
 *      plaint, mais ce qu'elle voit est léger) ;
 *   3. sinon la zone reste non notée.
 *
 * Une zone que la thérapeute a cotée elle-même n'est jamais réécrite : son
 * œil passe avant le questionnaire, et une réponse changée après coup ne
 * doit pas effacer ce qu'elle a vu.
 */
export function precoterLesZones(
  bareme: BaremeSignature,
  reponses: ReponsesSignature,
  ajustees: CarteDesZones = {},
): CarteDesZones {
  const visees = new Set<string>();
  for (const q of questionsAPoser(bareme, reponses)) {
    if (!q.zonesVisees) continue;
    for (const i of choixSignature(reponses, q.code)) {
      for (const z of q.zonesVisees[i] ?? []) visees.add(z);
    }
  }

  const carte: CarteDesZones = {};
  for (const zone of bareme.ZONES) {
    if (ajustees[zone.code] !== undefined) {
      carte[zone.code] = ajustees[zone.code];
      continue;
    }

    const q = bareme.QUESTIONS.find((x) => x.zone === zone.code && questionPosee(x, reponses));
    const choix = q ? choixSignature(reponses, q.code)[0] : undefined;
    const vue = q && choix !== undefined ? (q.intensites?.[choix] ?? 0) : null;

    if (vue) carte[zone.code] = vue;
    else if (visees.has(zone.code)) carte[zone.code] = vue === null ? 2 : 1;
    else carte[zone.code] = 0;
  }

  return carte;
}

/** Les zones que la thérapeute a cotées elle-même, pour le dire à l'écran. */
export function zoneAjustee(ajustees: CarteDesZones, code: string): boolean {
  return ajustees[code] !== undefined;
}

// ---------------------------------------------------------------------------
// Le Profil Signature
// ---------------------------------------------------------------------------

export interface ProfilSignatureCalcule {
  /** Les quatre axes, ramenés sur 100. */
  axes: Record<AxeSignature, number>;
  profil: ProfilSignature;
  /** Le terrain dominant, ou plusieurs quand ils se tiennent — terrain mixte. */
  terrains: TerrainSignature[];
  /** Les terrains sur 100, pour l'écran. */
  scoresTerrain: Record<TerrainSignature, number>;
}

/** Un axe qui se lit à moitié sur l'observation : sur quoi, et jusqu'où. */
const OBSERVATION: Partial<Record<AxeSignature, { zones: Array<[string, number]>; max: number }>> = {
  /* L'ovale et le cou en entier, le décolleté pour moitié : il compte, mais il ne fait pas la fermeté du visage. */
  fermete: { zones: [['ovale', 1], ['cou', 1], ['decollete', 0.5]], max: 7.5 },
  rides: { zones: [['yeux', 1], ['front', 1], ['decollete', 0.5]], max: 7.5 },
  hydratation: { zones: [['grain', 1]], max: 3 },
  /* La densité ne s'observe pas à l'œil nu : elle reste au questionnaire seul. */
};

/** L'écart en points de pourcentage sous lequel deux axes ne se départagent plus. */
const ECART_INDECIS = 10;
/** Un terrain sous ce seuil ne se signale pas : la peau ne dit rien de particulier. */
const SEUIL_TERRAIN = 20;
/** Les terrains à cet écart du premier s'affichent avec lui — terrain mixte. */
const ECART_TERRAIN_MIXTE = 5;

export function calculerProfilSignature(
  bareme: BaremeSignature,
  reponses: ReponsesSignature,
  carte: CarteDesZones,
): ProfilSignatureCalcule {
  const max = maximaSignature(bareme);
  const points: Record<AxeSignature, number> = { fermete: 0, rides: 0, hydratation: 0, densite: 0 };
  const terrain: Record<TerrainSignature, number> = { hydratation: 0, sensible: 0, dense: 0, fin: 0 };

  for (const q of questionsAPoser(bareme, reponses)) {
    if (q.multi) continue;
    for (const i of choixSignature(reponses, q.code)) {
      const option = q.o[i];
      if (!option) continue;
      for (const a of AXES_SIGNATURE) points[a] += option[1]?.[a] ?? 0;
      for (const t of TERRAINS_SIGNATURE) terrain[t] += option[2]?.[t] ?? 0;
    }
  }

  const axes = {} as Record<AxeSignature, number>;
  for (const a of AXES_SIGNATURE) {
    const partQuestionnaire = max.axes[a] > 0 ? points[a] / max.axes[a] : 0;
    const obs = OBSERVATION[a];
    if (!obs) {
      axes[a] = Math.round(100 * partQuestionnaire);
      continue;
    }
    const vu = obs.zones.reduce((n, [code, poids]) => n + poids * (carte[code] ?? 0), 0);
    axes[a] = Math.round(50 * partQuestionnaire + (50 * vu) / obs.max);
  }

  /*
    Le profil. Quand les deux premiers axes se tiennent à dix points ou
    moins, aucun ne domine vraiment : c'est un profil global — sauf si ce
    sont Rides et Densité, qui vont par paire et forment leur propre
    profil. Au-delà, l'axe de tête décide.
  */
  const ordre = [...AXES_SIGNATURE].sort((a, b) => axes[b] - axes[a]);
  const [premier, deuxieme] = ordre;
  const paire = new Set([premier, deuxieme]);

  let profil: ProfilSignature;
  if (axes[premier] - axes[deuxieme] <= ECART_INDECIS) {
    profil = paire.has('rides') && paire.has('densite') ? 'rides_densite' : 'global';
  } else if (premier === 'fermete') {
    profil = 'fermete_ovale';
  } else if (premier === 'hydratation') {
    profil = 'hydratation_qualite';
  } else {
    profil = 'rides_densite';
  }

  const scoresTerrain = {} as Record<TerrainSignature, number>;
  for (const t of TERRAINS_SIGNATURE) {
    scoresTerrain[t] = max.terrains[t] > 0 ? Math.round((100 * terrain[t]) / max.terrains[t]) : 0;
  }
  const plusHaut = Math.max(...TERRAINS_SIGNATURE.map((t) => scoresTerrain[t]));
  const terrains =
    plusHaut < SEUIL_TERRAIN
      ? []
      : TERRAINS_SIGNATURE.filter((t) => plusHaut - scoresTerrain[t] <= ECART_TERRAIN_MIXTE);

  return { axes, profil, terrains, scoresTerrain };
}

/** « Hydratation et Sensible / Réactif » pour un terrain mixte. */
export function nomDuTerrainSignature(bareme: BaremeSignature, terrains: TerrainSignature[]): string {
  if (terrains.length === 0) return 'Pas de terrain particulier signalé';
  return terrains.map((t) => bareme.TERRAINS[t].nom).join(' et ');
}

// ---------------------------------------------------------------------------
// La cure préconisée
// ---------------------------------------------------------------------------

/** Ce que vaut une zone : une marquée compte double, une discrète ne compte pas. */
const POINTS_PAR_COTATION: Record<Cotation, number> = { 0: 0, 1: 0, 2: 1, 3: 2 };

export interface PreconisationSignature {
  /** Le total, sur les seules zones où la radiofréquence agit. */
  points: number;
  cure: CureSignature;
  /** Les zones qui ont produit ce total, pour l'expliquer à la cliente. */
  marquees: string[];
  moderees: string[];
  discretes: string[];
}

/**
 * La cure que le bilan préconise.
 *
 * Elle ne se lit que sur les zones où la radiofréquence agit — les sillons
 * nasogéniens et tout ce qui n'est pas `rf` en sont exclus : proposer des
 * séances pour une zone que le soin ne traite pas serait vendre du vent.
 *
 * UNE SEULE ZONE MARQUÉE SUFFIT à préconiser la cure la plus longue : un
 * relâchement franc ne se rattrape pas en quatre séances, même si tout le
 * reste va bien.
 *
 * Les seuils vivent dans le barème (`jusqua`), pas ici : le jour où l'on
 * passe de trois cures à deux, rien ne change dans ce fichier.
 */
export function preconiserLaCure(bareme: BaremeSignature, carte: CarteDesZones): PreconisationSignature {
  const traitees = bareme.ZONES.filter((z) => z.portee === 'rf');
  const nommer = (c: Cotation) => traitees.filter((z) => (carte[z.code] ?? 0) === c).map((z) => z.nom);

  const marquees = nommer(3);
  const moderees = nommer(2);
  const discretes = nommer(1);
  const points = traitees.reduce((n, z) => n + POINTS_PAR_COTATION[carte[z.code] ?? 0], 0);

  /*
    Les cures sont rangées de la plus légère à la plus longue ; la première
    dont le plafond n'est pas dépassé l'emporte, la dernière prend tout le
    reste. Une zone marquée envoie directement à la dernière.
  */
  const ordonnees = [...bareme.CURES].sort((a, b) => a.seances - b.seances);
  const derniere = ordonnees[ordonnees.length - 1];
  const cure =
    marquees.length > 0
      ? derniere
      : (ordonnees.find((c) => c.jusqua !== undefined && points <= c.jusqua) ?? derniere);

  return { points, cure, marquees, moderees, discretes };
}

// ---------------------------------------------------------------------------
// Sécurité
// ---------------------------------------------------------------------------

/** Le code de la question qui porte les contre-indications cochées par la thérapeute. */
export const CODE_SECURITE = 'secu';

/**
 * Une seule case cochée et la séance ne se fait pas.
 *
 * Ce n'est pas un avis médical, c'est une interdiction : pacemaker,
 * implant métallique, grossesse, lésion, perte de sensibilité à la
 * chaleur, cancer en cours. Le bilan peut s'enregistrer — il dit quelque
 * chose de la peau — mais aucune cure ne se vend ce jour-là.
 */
export function contreIndications(bareme: BaremeSignature, reponses: ReponsesSignature): string[] {
  return choixSignature(reponses, CODE_SECURITE)
    .map((i) => bareme.SECURITE[i])
    .filter((s): s is string => typeof s === 'string');
}

export function securiteBloquante(bareme: BaremeSignature, reponses: ReponsesSignature): boolean {
  return contreIndications(bareme, reponses).length > 0;
}

/** Le code de la question sur la date du dernier peeling, laser ou injection. */
export const CODE_SOIN_RECENT = 'q10c';
/** L'option « moins d'un mois ». */
export const OPTION_MOINS_DUN_MOIS = 0;

/**
 * Peeling, laser ou injection de moins d'un mois : le bilan se fait, la
 * cure se vend, mais aucune séance aujourd'hui — elle démarre au plus tôt
 * un mois après ce soin. Ce n'est donc pas bloquant, c'est un décalage.
 */
export function soinRecent(reponses: ReponsesSignature): boolean {
  return choixSignature(reponses, CODE_SOIN_RECENT).includes(OPTION_MOINS_DUN_MOIS);
}

// ---------------------------------------------------------------------------

export interface ReponseSignatureLue {
  code: string;
  question: string;
  reponses: string[];
}

/** Les réponses en toutes lettres, pour la carte « Mes réponses » de la fiche. */
export function relireLesReponsesSignature(
  bareme: BaremeSignature,
  reponses: ReponsesSignature,
): ReponseSignatureLue[] {
  return questionsAPoser(bareme, reponses).map((q) => ({
    code: q.code,
    question: q.t,
    reponses: choixSignature(reponses, q.code)
      .map((i) => q.o[i]?.[0])
      .filter((l): l is string => typeof l === 'string'),
  }));
}
