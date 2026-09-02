/**
 * Le stock : ce qui reste en rayon, et ce qu'il reste à boire.
 *
 * Deux calculs vivent ici, aucun n'est écrit en base :
 *   — le niveau d'alerte d'un produit, déduit de sa quantité et de ses seuils ;
 *   — la fin d'une boîte de compléments, déduite de la date de vente.
 */

export type NiveauStock = 'rupture' | 'critique' | 'bas' | 'ok';

/**
 * Une quantité négative est possible : on a vendu ce que le comptage ne
 * connaissait pas. On l'affiche telle quelle plutôt que de la ramener à
 * zéro — c'est le signe qu'un inventaire s'impose, pas une erreur à cacher.
 */
export function niveauStock(quantite: number, seuilBas: number, seuilCritique: number): NiveauStock {
  if (quantite <= 0) return 'rupture';
  if (quantite <= seuilCritique) return 'critique';
  if (quantite <= seuilBas) return 'bas';
  return 'ok';
}

export const LIBELLES_NIVEAU: Record<NiveauStock, string> = {
  rupture: 'Rupture',
  critique: 'Critique',
  bas: 'À recommander',
  ok: 'Suffisant',
};

/** Classes Tailwind de la pastille, pour que l'écran se lise d'un coup d'œil. */
export const COULEURS_NIVEAU: Record<NiveauStock, string> = {
  rupture: 'bg-red-100 text-red-800 border-red-200',
  critique: 'bg-orange-100 text-orange-800 border-orange-200',
  bas: 'bg-amber-100 text-amber-800 border-amber-200',
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export const LIBELLES_MOTIF: Record<string, string> = {
  reception: 'Réception',
  vente: 'Vente',
  offert: 'Offert',
  perte: 'Perte ou casse',
  usage_centre: 'Utilisé au centre',
  inventaire: 'Comptage du rayon',
};

// ---------------------------------------------------------------------------
// Compléments : quand la boîte sera-t-elle finie ?
// ---------------------------------------------------------------------------

export interface FinDeCure {
  /** Null quand le produit se prend à la demande : le S.O.S n'a pas d'échéance. */
  fin: Date | null;
  /** Négatif si la cure est déjà terminée. Null s'il n'y a pas d'échéance. */
  joursRestants: number | null;
  terminee: boolean;
}

const JOUR = 24 * 60 * 60 * 1000;

/**
 * Une boîte dure un nombre de jours connu (15 pour le BURN et le DÉTOX,
 * 30 pour le SKIN). Deux boîtes vendues le même jour durent deux fois plus
 * longtemps : la cliente les enchaîne, elle ne les prend pas en parallèle.
 */
export function finDeCure(
  dateVente: string,
  quantite: number,
  joursParBoite: number | null,
  aujourdhui = new Date(),
): FinDeCure {
  if (!joursParBoite) return { fin: null, joursRestants: null, terminee: false };

  const debut = new Date(dateVente);
  const fin = new Date(debut.getTime() + quantite * joursParBoite * JOUR);

  const minuit = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const joursRestants = Math.round((minuit(fin) - minuit(aujourdhui)) / JOUR);

  return { fin, joursRestants, terminee: joursRestants < 0 };
}

/** « il reste 4 jours », « terminée depuis 3 jours ». */
export function libelleFinDeCure(e: FinDeCure): string {
  if (e.joursRestants === null) return 'Pas d’échéance';
  if (e.joursRestants < 0) {
    const j = -e.joursRestants;
    return j === 1 ? 'Terminée depuis hier' : `Terminée depuis ${j} jours`;
  }
  if (e.joursRestants === 0) return 'Se termine aujourd’hui';
  if (e.joursRestants === 1) return 'Se termine demain';
  return `Il reste ${e.joursRestants} jours`;
}
