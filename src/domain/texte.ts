/*
  Les petites corrections de texte qui n'ont de sens qu'au moment d'imprimer.

  À l'écran, le français bien composé sépare les milliers par une espace fine
  insécable et met une espace insécable devant les deux-points. C'est correct,
  et les navigateurs les dessinent parfaitement.

  Les polices de base d'un PDF, elles, ne connaissent pas ces caractères : la
  place du signe est occupée par autre chose, et « 1 977 € » s'imprime
  « 1 / 977 € ». C'est arrivé sur le récapitulatif envoyé aux clientes, et le
  contrat de prestation avait exactement le même défaut sur toute cure à
  quatre chiffres.

  On les remplace donc par une espace ordinaire, mais seulement au moment
  d'écrire dans un PDF : rien ne change à l'écran, où elles sont justes.
*/

/**
 * Les espaces que les polices d'un PDF ne savent pas dessiner :
 *   U+202F espace fine insécable (séparateur de milliers en français)
 *   U+2009 espace fine
 *   U+00A0 espace insécable
 *   U+2007 espace tabulaire
 */
const ESPACES_EXOTIQUES = /[\u202f\u2009\u00a0\u2007]/g;

export function pourPdf(texte: string): string {
  return texte.replace(ESPACES_EXOTIQUES, ' ');
}
