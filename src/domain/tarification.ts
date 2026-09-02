/*
  Moteur de prix de la Méthode Empreinte.
  (« Empreinte » est le nom historique de la méthode ; le diagnostic, lui,
  s'appelle désormais le BioPortrait.)

  Remplace intégralement le catalogue de 60 lignes et les tables de
  répartition par palier de l'ancienne application. La règle tient
  désormais en une addition :

      59 € × total de séances
    + 29 €  guide de rééquilibrage — systématique
    + 60 €  tenue I-Shape — uniquement si électrostimulation

  Les montants ne sont jamais écrits en dur ici : ils viennent de la table
  `tarifs`, qui les date. Un programme copie les prix en vigueur au moment
  de sa validation, pour que les cures passées ne changent jamais de prix.
*/

export type Technologie = 'luxo' | 'ishape' | 'presso' | 'dome' | 'relax';

export const LIBELLES_TECHNOLOGIE: Record<Technologie, string> = {
  luxo: 'Luxothérapie Perte de poids',
  relax: 'Luxothérapie Relaxation',
  ishape: 'I-Shape · électrostimulation',
  presso: 'Pressodynamie',
  dome: 'Dôme',
};

export interface LigneProgramme {
  technologie: Technologie;
  seances: number;
  /** Prix unitaire figé à la validation. Le Dôme a le sien. */
  prixUnitaire: number;
}

export interface GrilleTarifaire {
  seance: number;
  guide: number;
  tenue: number;
  bilan: number;
  dome: number;
  /** Une boîte de compléments, vendue à part de la cure. */
  complement: number;
}

export interface DetailMontant {
  totalSeances: number;
  montantSeances: number;
  montantGuide: number;
  montantTenue: number;
  total: number;
}

/**
 * Le total de séances additionne toutes les technologies prescrites.
 * Exemple de la présentation : 20 Luxo + 15 électro = 35 séances
 * → 2 065 € + 29 € de guide + 60 € de tenue = 2 094 €.
 *
 * Le guide et la tenue se facturent séparément : sur une cure suivante, la
 * cliente les a déjà et on ne les lui revend pas.
 */
export function calculerMontant(
  lignes: LigneProgramme[],
  options: { tenue: boolean; guide: boolean },
  grille: GrilleTarifaire,
): DetailMontant {
  const totalSeances = lignes.reduce((n, l) => n + Math.max(0, l.seances), 0);
  const montantSeances = lignes.reduce((n, l) => n + Math.max(0, l.seances) * l.prixUnitaire, 0);
  const montantGuide = options.guide ? grille.guide : 0;
  const montantTenue = options.tenue ? grille.tenue : 0;

  return {
    totalSeances,
    montantSeances,
    montantGuide,
    montantTenue,
    total: arrondir(montantSeances + montantGuide + montantTenue),
  };
}

/** Prix unitaire par défaut d'une technologie, selon la grille en vigueur. */
export function prixUnitaireParDefaut(techno: Technologie, grille: GrilleTarifaire): number {
  return techno === 'dome' ? grille.dome : grille.seance;
}

// ---------------------------------------------------------------------------
// Échéanciers
// ---------------------------------------------------------------------------

/**
 * Deux façons de régler, telles qu'elles se pratiquent au comptoir.
 *
 *   comptant   en une fois
 *   centre_Nx  chèques au centre, sans frais
 *   alma_Nx    carte, avec des frais Alma à la charge de la cliente
 *
 * « 4x_maison » et « 10x_alma » sont les anciennes valeurs, gardées pour
 * les cures déjà signées. « inconnu » ne concerne que les cures reprises du
 * CRM : Airtable ne garde aucune trace du règlement, et inventer une valeur
 * fausserait le tableau de bord.
 */
export type ModeReglement =
  | 'comptant'
  | 'centre_2x'
  | 'centre_3x'
  | 'centre_4x'
  | 'alma_2x'
  | 'alma_3x'
  | 'alma_4x'
  | 'alma_10x'
  | 'alma_12x'
  | '4x_maison'
  | '10x_alma'
  | 'inconnu';

/** Frais Alma, en pourcentage du montant, selon le nombre d'échéances. */
export const FRAIS_ALMA: Record<number, number> = {
  2: 0.87,
  3: 1.73,
  4: 2.58,
  10: 6.5,
  12: 7.5,
};

export const ECHEANCES_CENTRE = [1, 2, 3, 4];
export const ECHEANCES_ALMA = [2, 3, 4, 10, 12];

export function modeReglement(methode: 'centre' | 'alma', n: number): ModeReglement {
  if (methode === 'centre') return n <= 1 ? 'comptant' : (`centre_${n}x` as ModeReglement);
  return `alma_${n}x` as ModeReglement;
}

export const LIBELLES_MODE_REGLEMENT: Record<ModeReglement, string> = {
  comptant: 'Comptant',
  centre_2x: '2 fois au centre',
  centre_3x: '3 fois au centre',
  centre_4x: '4 fois au centre',
  alma_2x: '2 fois Alma',
  alma_3x: '3 fois Alma',
  alma_4x: '4 fois Alma',
  alma_10x: '10 fois Alma',
  alma_12x: '12 fois Alma',
  '4x_maison': '4 fois sans frais',
  '10x_alma': '10 fois Alma',
  inconnu: 'Mode de règlement inconnu',
};

export interface Echeance {
  rang: number;
  montant: number;
}

export interface Echeancier {
  mode: ModeReglement;
  /** Frais du financement, nuls hors Alma. */
  frais: number;
  /** Ce que la cliente règle au total, frais compris. */
  montantARegler: number;
  echeances: Echeance[];
}

/** Taux Alma, repris tels quels de l'ancienne application. */
const TAUX_ALMA_10X_BAS = 0.065; // jusqu'à 3 333 €
const TAUX_ALMA_10X_HAUT = 0.0515; // au-delà
/**
 * Au-delà de 4×, Alma amortit réellement le crédit. Cette constante a été
 * calée empiriquement dans la V1 pour tomber au centime sur le montant
 * affiché par Alma en 10× sous 3 333 €.
 */
const TAUX_EFFECTIF_10X_BAS = 0.069488;

function tauxEffectifAlma10x(total: number): number {
  if (total <= 3333) return TAUX_EFFECTIF_10X_BAS;
  return TAUX_ALMA_10X_HAUT / (1 - TAUX_ALMA_10X_HAUT);
}

export function construireEcheancier(total: number, mode: ModeReglement): Echeancier {
  if (total <= 0) return { mode, frais: 0, montantARegler: 0, echeances: [] };

  // Une cure reprise du CRM n'a pas d'échéancier : on n'en invente pas un.
  if (mode === 'inconnu') return { mode, frais: 0, montantARegler: total, echeances: [] };

  if (mode === 'comptant') {
    return { mode, frais: 0, montantARegler: total, echeances: [{ rang: 1, montant: total }] };
  }

  if (mode === '4x_maison') {
    // Sans frais : on divise, et le reste de la division tombe sur la première.
    const base = arrondir(Math.floor((total / 4) * 100) / 100);
    const reste = arrondir(total - base * 4);
    return {
      mode,
      frais: 0,
      montantARegler: total,
      echeances: [
        { rang: 1, montant: arrondir(base + reste) },
        { rang: 2, montant: base },
        { rang: 3, montant: base },
        { rang: 4, montant: base },
      ],
    };
  }

  // 10× Alma, frais ajoutés au montant.
  const frais = arrondir(total * tauxEffectifAlma10x(total));
  const avecFrais = arrondir(total + frais);
  const base = Math.floor((avecFrais / 10) * 100) / 100;
  const reste = arrondir(avecFrais - base * 10);

  return {
    mode,
    frais,
    montantARegler: avecFrais,
    echeances: Array.from({ length: 10 }, (_, i) => ({
      rang: i + 1,
      montant: i === 0 ? arrondir(base + reste) : base,
    })),
  };
}

/** Taux affiché à la cliente pour le 10× Alma. */
export function tauxAffichealma10x(total: number): number {
  return total <= 3333 ? TAUX_ALMA_10X_BAS : TAUX_ALMA_10X_HAUT;
}

// ---------------------------------------------------------------------------

function arrondir(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formaterEuros(n: number, decimales = 0): string {
  return (
    n.toLocaleString('fr-FR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }) + ' €'
  );
}


// ---------------------------------------------------------------------------
// L'échéancier tel qu'il se négocie au comptoir
// ---------------------------------------------------------------------------

export interface EcheancierCure {
  methode: 'centre' | 'alma';
  /** Nombre d'échéances. 1 = comptant. */
  n: number;
  mode: ModeReglement;
  /** Frais Alma, à la charge de la cliente. Zéro au centre. */
  frais: number;
  /** Ce que la cliente règle en tout, frais compris. */
  montantARegler: number;
  echeances: Array<{ rang: number; montant: number }>;
}

/**
 * Répartit des séances en N parts entières, le reste sur les premières.
 * On répartit les séances plutôt que les euros : chaque échéance
 * correspond alors à un nombre de séances entier, ce qui se justifie devant
 * la cliente — « vous payez vos quatre premières séances ».
 */
export function repartirSeances(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const reste = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < reste ? 1 : 0));
}

/**
 * L'échéancier d'une cure.
 *
 * Au centre, par chèques : sans frais, et le guide et la tenue tombent sur
 * la première échéance — la cliente repart avec, elle les règle tout de
 * suite.
 *
 * Chez Alma, par carte : des mensualités égales, frais compris. Les frais
 * sont à la charge de la cliente et apparaissent en clair, sans quoi le
 * montant du contrat ne correspondrait pas à ce qu'elle paie.
 */
export function construireEcheancierCure(args: {
  seances: number;
  prixSeance: number;
  options: number;
  methode: 'centre' | 'alma';
  n: number;
  /**
   * Montant des séances, quand tous les soins n'ont pas le même prix — le
   * Dôme est moins cher. Sans lui, on multiplie simplement le nombre de
   * séances par le prix unitaire.
   */
  montantSeances?: number;
}): EcheancierCure {
  const { seances, prixSeance, options, methode } = args;
  const montantDesSeances = arrondir(args.montantSeances ?? seances * prixSeance);
  const base = arrondir(montantDesSeances + options);
  const mode = modeReglement(methode, args.n);

  if (methode === 'centre') {
    const n = Math.max(1, Math.min(4, args.n));

    if (n === 1) {
      return {
        methode,
        n: 1,
        mode: 'comptant',
        frais: 0,
        montantARegler: base,
        echeances: [{ rang: 1, montant: base }],
      };
    }

    /*
      On répartit les séances, pas les euros : chaque échéance correspond à
      un nombre entier de séances, ce qui s'explique devant la cliente. Le
      reliquat d'arrondi tombe sur la première, avec le guide et la tenue.
    */
    const parts = repartirSeances(seances, n);
    const parPart = parts.map((s) => arrondir((montantDesSeances * s) / Math.max(1, seances)));
    const ecart = arrondir(montantDesSeances - parPart.reduce((a, b) => a + b, 0));

    const echeances = parPart.map((m, i) => ({
      rang: i + 1,
      montant: arrondir(m + (i === 0 ? options + ecart : 0)),
    }));

    return { methode, n, mode, frais: 0, montantARegler: base, echeances };
  }

  const n = ECHEANCES_ALMA.includes(args.n) ? args.n : 4;
  const taux = FRAIS_ALMA[n] ?? 0;
  const frais = arrondir((base * taux) / 100);
  const total = arrondir(base + frais);

  // Mensualités égales : le reste de la division tombe sur la première.
  const mensualite = Math.floor((total / n) * 100) / 100;
  const reste = arrondir(total - mensualite * n);

  return {
    methode,
    n,
    mode,
    frais,
    montantARegler: total,
    echeances: Array.from({ length: n }, (_, i) => ({
      rang: i + 1,
      montant: i === 0 ? arrondir(mensualite + reste) : mensualite,
    })),
  };
}
