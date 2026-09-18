/*
  Les compléments alimentaires vendus avec une cure.

  Jusqu'au 18 septembre 2026, une boîte se vendait à part, depuis l'onglet
  Compléments de la fiche, après coup. Jonathan veut la proposer AU MOMENT
  DE LA CURE, sur tous les formulaires — bilan, nouvelle cure, anti-âge —
  au même prix pour toutes (37 € la boîte, tarif `complement`), comptée
  dans le montant de la cure et, quand la cliente règle en plusieurs fois,
  TOUJOURS SUR LA PREMIÈRE ÉCHÉANCE : elle repart avec ses boîtes, elle
  les règle tout de suite — même règle que le guide et la tenue.

  Rien de neuf en base pour les compter : une boîte choisie avec la cure
  devient une vente ordinaire (`ventes_complements`, marquée « comprise
  dans la cure »), donc elle apparaît dans l'onglet Compléments avec sa
  date de fin, et le rayon se décompte tout seul par le déclencheur qui
  existe déjà. Ce qui vit ici, c'est l'arithmétique du devis.
*/

import type { ProduitComplement } from '../types/db';

/** Une boîte choisie avec la cure, telle qu'elle remonte à l'enregistrement. */
export interface ComplementChoisi {
  produit: ProduitComplement;
  nom: string;
  quantite: number;
  /** Figé à la validation, comme le prix d'une séance. */
  prixUnitaire: number;
}

/** Ce qu'il faut connaître d'un produit pour le proposer : son code, son nom. */
export interface ProduitProposable {
  code: string;
  nom: string;
}

function arrondir(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Passe des compteurs de l'écran (code → nombre de boîtes) à la liste des
 * compléments choisis, en ignorant les zéros et les codes inconnus au
 * catalogue — un produit retiré du rayon ne se vend plus, même si un
 * vieux compteur le nomme encore.
 */
export function complementsChoisis(
  quantites: Record<string, number>,
  catalogue: ProduitProposable[],
  prixUnitaire: number,
): ComplementChoisi[] {
  return catalogue
    .map((p) => ({
      produit: p.code as ProduitComplement,
      nom: p.nom,
      quantite: Math.max(0, Math.floor(quantites[p.code] ?? 0)),
      prixUnitaire,
    }))
    .filter((c) => c.quantite > 0);
}

export function nombreDeBoites(choix: ComplementChoisi[]): number {
  return choix.reduce((n, c) => n + Math.max(0, c.quantite), 0);
}

/** Ce que les boîtes ajoutent au montant de la cure. */
export function montantComplements(choix: ComplementChoisi[]): number {
  return arrondir(choix.reduce((n, c) => n + Math.max(0, c.quantite) * c.prixUnitaire, 0));
}

/** « BURN ×2, DÉTOX ×1 » — pour le devis, le contrat et le récapitulatif. */
export function libelleComplements(choix: ComplementChoisi[]): string {
  return choix
    .filter((c) => c.quantite > 0)
    .map((c) => `${c.nom} ×${c.quantite}`)
    .join(', ');
}

/** « 3 boîtes de compléments alimentaires » — au singulier quand il n'y en a qu'une. */
export function libelleBoites(nombre: number): string {
  return `${nombre} boîte${nombre > 1 ? 's' : ''} de compléments alimentaires`;
}
