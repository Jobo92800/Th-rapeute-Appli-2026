/*
  La charte des documents PDF.

  Le contrat et les consentements sortaient en Helvetica noir sur blanc,
  sans logo, sans couleur, sans hiérarchie : sept pages qui ressemblaient à
  une photocopie d'administration. Le récapitulatif, lui, était déjà à la
  charte. Ce module met les trois sur le même pied.

  CE QU'IL NE FAIT PAS. Il ne touche à aucun texte. Le contrat et les
  consentements portent des engagements juridiques repris mot pour mot de
  l'ancienne application ; leur mise en page se refait, leur contenu jamais.

  UNE RÈGLE DE FOND. L'en-tête est blanc, pas teal : le logo est bleu et
  rose, sur un fond sombre le bleu se noie et le nom devient illisible. La
  couleur revient sur les titres, les filets et les blocs qui comptent.
*/

import type { jsPDF } from 'jspdf';
import { LOGO_PDF, LOGO_RATIO } from './logoPdf';

export type Doc = jsPDF;

export const A4_L = 210;
export const A4_H = 297;
export const MARGE = 18;
export const LARGEUR = A4_L - MARGE * 2;
/** Où commence le contenu d'une page, sous l'en-tête. */
export const HAUT = 38;
/** Rien ne descend plus bas : le pied de page attend. */
export const BAS = A4_H - 20;

export const ENCRE: [number, number, number] = [21, 43, 44];
export const ENCRE_DOUX: [number, number, number] = [65, 89, 90];
export const GRIS: [number, number, number] = [124, 144, 145];
export const TEAL: [number, number, number] = [59, 191, 191];
export const TEAL_SOMBRE: [number, number, number] = [31, 132, 132];
export const ROSE: [number, number, number] = [206, 30, 115];
export const TRAIT: [number, number, number] = [220, 233, 233];
export const FOND: [number, number, number] = [244, 251, 251];

export function police(doc: Doc, taille: number, style: 'normal' | 'bold' | 'italic' = 'normal') {
  doc.setFontSize(taille);
  doc.setFont('helvetica', style);
}

export function couleur(doc: Doc, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}

/** L'en-tête : le logo à gauche, le document et sa date à droite, un filet. */
export function enTete(doc: Doc, titre: string, sousTitre: string) {
  const largeurLogo = 34;
  doc.addImage(LOGO_PDF, 'JPEG', MARGE, 9, largeurLogo, largeurLogo / LOGO_RATIO);

  police(doc, 8, 'bold');
  couleur(doc, TEAL_SOMBRE);
  doc.text(titre.toUpperCase(), A4_L - MARGE, 14.5, { align: 'right' });

  police(doc, 8, 'normal');
  couleur(doc, GRIS);
  doc.text(sousTitre, A4_L - MARGE, 19.5, { align: 'right' });

  doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.setLineWidth(0.8);
  doc.line(MARGE, 27, A4_L - MARGE, 27);
}

/**
 * Le pied de page, posé sur toutes les pages à la fin.
 *
 * À la fin, et pas au fur et à mesure : on ne connaît le nombre total de
 * pages qu'une fois le document terminé, et « page 3 sur 7 » vaut mieux que
 * « page 3 ».
 */
export function piedsDePage(doc: Doc, ligne: string) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(TRAIT[0], TRAIT[1], TRAIT[2]);
    doc.setLineWidth(0.2);
    doc.line(MARGE, A4_H - 16, A4_L - MARGE, A4_H - 16);

    police(doc, 7.5, 'normal');
    couleur(doc, GRIS);
    doc.text(ligne, MARGE, A4_H - 11);
    doc.text(`${p} / ${total}`, A4_L - MARGE, A4_H - 11, { align: 'right' });
  }
}

/** Le grand titre d'ouverture : maigre, avec le mot important en gras. */
export function titreDocument(doc: Doc, maigre: string, gras: string, y: number): number {
  police(doc, 21, 'normal');
  couleur(doc, ENCRE);
  doc.text(maigre, MARGE, y);
  const l = doc.getTextWidth(maigre);
  police(doc, 21, 'bold');
  doc.text(gras, MARGE + l, y);
  return y + 9;
}

/** Un titre d'article ou de rubrique : teal, souligné d'un filet court. */
export function titreSection(doc: Doc, titre: string, y: number): number {
  police(doc, 9, 'bold');
  couleur(doc, TEAL_SOMBRE);
  doc.text(titre.toUpperCase(), MARGE, y);
  doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.setLineWidth(0.5);
  doc.line(MARGE, y + 1.6, MARGE + Math.min(doc.getTextWidth(titre.toUpperCase()), LARGEUR), y + 1.6);
  return y + 7;
}

/** Une case à cocher, teal quand elle est cochée. */
export function caseACocher(doc: Doc, x: number, y: number, cochee: boolean) {
  if (cochee) {
    doc.setFillColor(TEAL_SOMBRE[0], TEAL_SOMBRE[1], TEAL_SOMBRE[2]);
    doc.setDrawColor(TEAL_SOMBRE[0], TEAL_SOMBRE[1], TEAL_SOMBRE[2]);
    doc.roundedRect(x, y - 3.1, 3.6, 3.6, 0.7, 0.7, 'FD');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.45);
    doc.line(x + 0.9, y - 1.4, x + 1.6, y - 0.7);
    doc.line(x + 1.6, y - 0.7, x + 2.8, y - 2.3);
  } else {
    doc.setDrawColor(180, 197, 197);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y - 3.1, 3.6, 3.6, 0.7, 0.7, 'FD');
  }
}

/** Un encadré léger — pour un bloc d'identité, un rappel, une mise en garde. */
export function encadre(doc: Doc, y: number, hauteur: number, teinte = FOND) {
  doc.setFillColor(teinte[0], teinte[1], teinte[2]);
  doc.setDrawColor(TRAIT[0], TRAIT[1], TRAIT[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGE, y, LARGEUR, hauteur, 2.5, 2.5, 'FD');
}

/** Une étiquette en petites capitales grises, au-dessus de sa valeur. */
export function etiquette(
  doc: Doc,
  texte: string,
  x: number,
  y: number,
  align: 'left' | 'right' = 'left',
) {
  police(doc, 6.5, 'bold');
  couleur(doc, GRIS);
  doc.text(texte.toUpperCase(), x, y, { align });
}
