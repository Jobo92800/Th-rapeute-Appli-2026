/*
  Les accords, quand la cliente est un client.

  Les centres reçoivent aussi des hommes. La fiche porte donc une civilité,
  et l'application doit s'y accorder — sinon un monsieur lit « archivée »
  sous son nom, « Qui l'a parrainée » sur sa fiche, et signe un contrat où
  il déclare avoir été « informée ».

  LA RÈGLE, une fois pour toutes.

    Ce qui désigne UNE PERSONNE PRÉCISE s'accorde à sa civilité. Son nom
    dans un message, ce qu'elle a réglé, ce qu'elle a signé, son contrat.

    Ce qui désigne LA CLIENTÈLE EN GÉNÉRAL reste au féminin : le menu
    « Clientes », la colonne « Cliente », « Aucune cliente dans ce centre ».
    La clientèle est massivement féminine, et cribler l'interface de
    « client·e » la rendrait pénible à lire pour toute l'équipe, toute la
    journée, au bénéfice de personne.

    Ce qui désigne UNE AUTRE PERSONNE dont on ne connaît pas la civilité —
    une marraine, une filleule, vues depuis la fiche de quelqu'un d'autre —
    se dit sans genre. Ces personnes viennent d'une commande qui ne rend pas
    leur civilité ; plutôt que de deviner, on tourne la phrase autrement.

  Le doute profite au féminin : une fiche sans civilité est une fiche
  d'avant la civilité, donc une femme dans 99 % des cas.
*/

import type { Civilite } from '../types/db';

export function estFeminin(c: Civilite | null | undefined): boolean {
  return (c ?? 'Mme') !== 'M.';
}

/** « elle » ou « il ». */
export function pronom(c: Civilite | null | undefined): string {
  return estFeminin(c) ? 'elle' : 'il';
}

/** « Madame » ou « Monsieur », en toutes lettres — pour un document. */
export function titre(c: Civilite | null | undefined): string {
  return estFeminin(c) ? 'Madame' : 'Monsieur';
}

/** « Mme » ou « M. », devant un nom. */
export function abrege(c: Civilite | null | undefined): string {
  return estFeminin(c) ? 'Mme' : 'M.';
}

/**
 * Un participe ou un adjectif accordé, donné au masculin.
 *
 *   accorde('archivé', 'M.')  → « archivé »
 *   accorde('archivé', 'Mme') → « archivée »
 *
 * Ne convient qu'aux mots dont le féminin s'obtient par un « e » final —
 * c'est le cas de tous ceux que l'application affiche.
 */
export function accorde(masculin: string, c: Civilite | null | undefined): string {
  return estFeminin(c) ? `${masculin}e` : masculin;
}

/** Une majuscule en tête, pour commencer une phrase par « La cliente… ». */
export function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** « la cliente » ou « le client », avec le déterminant voulu. */
export function laCliente(
  c: Civilite | null | undefined,
  determinant: 'la' | 'cette' | 'une' = 'la',
): string {
  const f = estFeminin(c);
  const det =
    determinant === 'la' ? (f ? 'la' : 'le') : determinant === 'cette' ? (f ? 'cette' : 'ce') : f ? 'une' : 'un';
  return `${det} ${f ? 'cliente' : 'client'}`;
}
