/**
 * Les règles de lecture du tableau de bord.
 *
 * Un chiffre seul ne dit rien : 3 104 € encaissés, est-ce bien ou mal ? La
 * comparaison avec la période précédente, de même durée, le rend lisible.
 */

/** Variation en pourcentage. Null quand la période précédente était vide : on ne divise pas par zéro, et « +∞ % » n'aide personne. */
export function evolution(actuel: number, precedent: number): number | null {
  if (!precedent || precedent === 0) return null;
  return Math.round(((actuel - precedent) / precedent) * 100);
}

/** « +12 % », « −65 % », « stable ». */
export function libelleEvolution(pct: number | null): string | null {
  if (pct === null) return null;
  if (Math.abs(pct) < 1) return 'stable';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`;
}
