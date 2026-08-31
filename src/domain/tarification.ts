/*
  Moteur de prix de la Méthode Empreinte.

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

export type Technologie = 'luxo' | 'ishape' | 'presso' | 'dome';

export const LIBELLES_TECHNOLOGIE: Record<Technologie, string> = {
  luxo: 'Luxothérapie',
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

export type ModeReglement = 'comptant' | '4x_maison' | '10x_alma';

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
