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
/*
  Frais Alma à la charge de la cliente, en pourcentage du montant de la cure.

  D'OÙ VIENNENT CES CHIFFRES. Du tableau de bord Alma du compte MB3PRO,
  page Conditions, relevés le 4 septembre 2026 — et recoupés avec dix
  simulations réelles, montant par montant.

  ATTENTION AU PIÈGE QUI NOUS A COÛTÉ UNE ERREUR. Le tableau de bord affiche
  deux nombres par formule : le **taux de frais client**, qui est celui-ci,
  et le **taux d'usure**, écrit juste en dessous en rouge — un plafond légal
  qui ne se facture à personne. Le 4× avait été saisi à 2,58 %, qui est son
  taux d'usure ; le vrai taux client est 1,9 %. Sur une cure à 1 623 €, on
  réclamait 11 € de trop à la cliente.

  ET POURQUOI 10× ET 12× NE PORTENT PAS LES TAUX AFFICHÉS. Alma annonce
  6,5 % et 7,5 %, mais les applique au **total avec frais**, pas au montant
  de la cure. Rapporté au montant, ça fait 6,9489 % et 8,1063 % — les deux
  valeurs ci-dessous, calées au centime sur les relevés. La V1 avait déjà
  trouvé 6,9488 % de cette façon.

  Au-delà d'un certain montant, Alma baisse son taux. Ces paliers hauts ont
  été vérifiés à leur tour, sur une cure de 3 865 € : le 12× tombe au centime
  avec la conversion, le 10× demandait un léger recalage — 5,4336 % au lieu
  des 5,4297 % que donnait le calcul, soit quinze centimes sur 4 075 €. Il
  repose sur une seule mesure, faute d'une seconde cure au-dessus du seuil.
*/
interface PalierAlma {
  /** Montant au-delà duquel le taux baisse. Absent = un seul taux. */
  seuil?: number;
  taux: number;
  tauxAuDela?: number;
}

const TAUX_ALMA: Record<number, PalierAlma> = {
  2: { taux: 0.87 },
  3: { taux: 1.73 },
  4: { taux: 1.9 },
  10: { seuil: 3333, taux: 6.9489, tauxAuDela: 5.4336 },
  12: { seuil: 3273, taux: 8.1063, tauxAuDela: 6.6894 },
};

/** Le taux applicable, en pourcentage, pour ce nombre d'échéances et ce montant. */
export function tauxFraisAlma(n: number, montant: number): number {
  const p = TAUX_ALMA[n];
  if (!p) return 0;
  if (p.seuil != null && p.tauxAuDela != null && montant > p.seuil) return p.tauxAuDela;
  return p.taux;
}

/** Les frais en euros, à la charge de la cliente. */
export function fraisAlma(n: number, montant: number): number {
  return arrondir((montant * tauxFraisAlma(n, montant)) / 100);
}

export const ECHEANCES_CENTRE = [1, 2, 3, 4];
export const ECHEANCES_ALMA = [2, 3, 4, 10, 12];

/**
 * Combien de mois dure une cure.
 *
 * La durée ne se déduit pas du total des séances : les soins se font en
 * parallèle, sur les mêmes venues. C'est le soin le plus long qui donne le
 * tempo — une cure de 20 luxo et 4 presso dure le temps des 20 luxo.
 *
 * Un mois de plus dès trois soins principaux : il y a plus à caser dans une
 * semaine, et le rythme s'étire. La Relaxation ne compte pas dans ces trois,
 * elle s'ajoute à une venue existante.
 *
 * Les paliers viennent de la maquette du diagnostic, ils ne sont pas de moi.
 */
export function dureeCureEnMois(seancesDuSoinLePlusLong: number, soinsPrincipaux: number): number {
  if (seancesDuSoinLePlusLong <= 0) return 1;
  const mois = seancesDuSoinLePlusLong <= 13 ? 3 : seancesDuSoinLePlusLong <= 16 ? 4 : 5;
  return soinsPrincipaux >= 3 ? mois + 1 : mois;
}

/**
 * Les nombres de chèques proposables, plafonnés par la durée de la cure.
 *
 * On ne fait pas payer une cliente plus longtemps que son accompagnement ne
 * dure : quatre chèques sur une cure de trois mois, c'est un chèque encaissé
 * après la dernière séance. Quand la thérapeute réduit l'offre, la cure
 * raccourcit et le choix se resserre tout seul.
 *
 * Alma n'est pas concerné : c'est un crédit avancé par Alma, le centre est
 * payé tout de suite, la durée de la cure ne l'engage pas.
 */
export function echeancesCentrePossibles(dureeMois: number): number[] {
  const plafond = Math.max(1, dureeMois);
  return ECHEANCES_CENTRE.filter((n) => n <= plafond);
}

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
  /** « acompte » pour le premier versement, quand il y en a un. */
  type?: 'acompte' | 'echeance';
}

/**
 * L'acompte demandé à une cliente qui dit oui mais ne peut pas tout régler
 * tout de suite.
 *
 * Il couvre exactement ce que le centre a déjà engagé pour elle : le bilan
 * qui vient d'être fait, et les créneaux bloqués dans le planning pour sa
 * prochaine venue — une demi-heure par soin. Trois soins enchaînés, c'est
 * une heure et demie réservée, donc trois séances dues.
 *
 * Il ne s'ajoute pas à la cure, il en fait partie : c'est son premier
 * règlement. Le bilan reste offert puisqu'elle démarre — les 129 € ne
 * servent qu'à mesurer ce que le centre perdrait si elle ne revenait pas.
 */
export function montantAcompte(args: {
  prixBilan: number;
  creneauxReserves: number;
  prixSeance: number;
}): number {
  const creneaux = Math.max(0, Math.floor(args.creneauxReserves));
  return arrondir(args.prixBilan + creneaux * args.prixSeance);
}

/** Autant de créneaux que de soins différents : ils s'enchaînent sur une venue. */
export function creneauxParDefaut(soinsRetenus: number): number {
  return Math.max(1, soinsRetenus);
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
  echeances: Echeance[];
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
   * Premier versement, réglé avant la prochaine séance. Il se déduit du
   * total : le reste se répartit sur les échéances suivantes. Au centre
   * seulement — chez Alma, le crédit couvre déjà la totalité.
   */
  acompte?: number;
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

    /*
      Avec un acompte, il vient en tête et se déduit du total. Le reste suit
      les séances comme d'habitude, à ceci près que le guide et la tenue ne
      sont plus portés par la première échéance : l'acompte a déjà chargé le
      début du parcours, inutile d'en rajouter.
    */
    const acompte = arrondir(Math.max(0, Math.min(args.acompte ?? 0, base)));

    if (acompte > 0) {
      const reste = arrondir(base - acompte);
      const parts = repartirSeances(seances, n);
      const parPart = parts.map((s) => arrondir((reste * s) / Math.max(1, seances)));
      const ecart = arrondir(reste - parPart.reduce((a, b) => a + b, 0));

      return {
        methode,
        n,
        mode,
        frais: 0,
        montantARegler: base,
        echeances: [
          { rang: 1, montant: acompte, type: 'acompte' as const },
          ...parPart.map((m, i) => ({
            rang: i + 1,
            montant: arrondir(m + (i === 0 ? ecart : 0)),
            type: 'echeance' as const,
          })),
        ],
      };
    }

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
  const frais = fraisAlma(n, base);
  const total = arrondir(base + frais);

  /*
    Alma ne répartit pas de la même façon selon la formule, et il faut le
    suivre : le contrat annonce des montants qui seront débités sur le compte
    de la cliente. Se tromper, c'est lui promettre 550 € et lui en prélever
    569 le premier mois.

    2×, 3×, 4× — paiement fractionné. Alma prend **la totalité des frais sur
    le premier versement** ; les suivants valent le montant divisé, rond.
    Vérifié sur six simulations : 1 623 € en 3× donne 569,07 puis 541 et 541.
  */
  if (n <= 4) {
    const part = Math.floor((base / n) * 100) / 100;
    const reliquat = arrondir(base - part * n);

    return {
      methode,
      n,
      mode,
      frais,
      montantARegler: total,
      echeances: Array.from({ length: n }, (_, i) => ({
        rang: i + 1,
        montant: i === 0 ? arrondir(part + reliquat + frais) : part,
      })),
    };
  }

  /*
    10× et 12× — crédit amorti. Là, Alma lisse : mensualités égales, le
    reliquat d'arrondi sur la première. Vérifié sur quatre simulations :
    973 € en 12× donne 87,72 puis onze fois 87,65.
  */
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
