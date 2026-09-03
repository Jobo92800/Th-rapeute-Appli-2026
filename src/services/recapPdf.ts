/*
  Le récapitulatif BioPortrait en PDF.

  Deux pages : ce que le bilan a révélé, puis ce qu'on lui propose. Dans cet
  ordre, et jamais l'inverse — c'est la règle de la méthode, la compréhension
  d'abord, l'offre ensuite. Un document qui ouvre sur un prix se lit comme un
  devis ; celui-ci doit se lire comme un compte rendu.

  jsPDF n'embarque que ses polices de base : on reste sur Helvetica, comme le
  contrat. Ce sont les couleurs de la charte qui portent l'identité.
*/

// L'export nommé plutôt que l'export par défaut : c'est le seul des deux
// qui fonctionne aussi bien sous Vite que sous Node, où le banc d'essai
// fabrique un PDF d'exemple pour le relire.
import { jsPDF } from 'jspdf';
import type { DonneesRecap } from '../domain/recapitulatif';
import { formaterEuros } from '../domain/tarification';
import { pourPdf } from '../domain/texte';

const A4_W = 210;
const A4_H = 297;
const MARGE = 18;
const LARGEUR = A4_W - MARGE * 2;
const BAS = A4_H - 20;

// La charte, en composantes RVB : teal pour l'interface, magenta pour ce qui
// engage, gris vert-de-gris pour le texte courant.
const TEAL: [number, number, number] = [59, 191, 191];
const TEAL_SOMBRE: [number, number, number] = [15, 67, 68];
const MAGENTA: [number, number, number] = [232, 49, 138];
const ENCRE: [number, number, number] = [21, 43, 44];
const GRIS: [number, number, number] = [94, 114, 115];
const TRAIT: [number, number, number] = [214, 233, 233];
const FOND: [number, number, number] = [240, 250, 250];

type Doc = jsPDF;

function police(doc: Doc, taille: number, style: 'normal' | 'bold' | 'italic' = 'normal') {
  doc.setFontSize(taille);
  doc.setFont('helvetica', style);
}

function couleur(doc: Doc, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}

/*
  Tout ce qui s'imprime passe par ici, et par ici seulement.

  Les polices de base d'un PDF ne connaissent pas l'espace fine insécable que
  le français met entre les milliers : « 1 977 € » ressortait « 1 / 977 € ».
  Nettoyer au moment d'écrire évite d'avoir à y penser à chaque montant, et
  couvre aussi les textes qui viennent du barème ou de la fiche.
*/
function ecrire(
  doc: Doc,
  texte: string,
  x: number,
  y: number,
  opts?: { align?: 'left' | 'center' | 'right' },
) {
  doc.text(pourPdf(texte), x, y, opts);
}

/** Un montant, prêt à être imprimé. */
function euros(n: number, decimales = 0): string {
  return pourPdf(formaterEuros(n, decimales));
}

/** Écrit un paragraphe et renvoie l'ordonnée suivante. */
function paragraphe(doc: Doc, texte: string, x: number, y: number, largeur: number, interligne = 4.6): number {
  const lignes = doc.splitTextToSize(texte, largeur) as string[];
  for (const l of lignes) {
    ecrire(doc, l, x, y);
    y += interligne;
  }
  return y;
}

function bandeau(doc: Doc, titre: string, sousTitre: string) {
  doc.setFillColor(TEAL_SOMBRE[0], TEAL_SOMBRE[1], TEAL_SOMBRE[2]);
  doc.rect(0, 0, A4_W, 30, 'F');

  police(doc, 15, 'bold');
  doc.setTextColor(255, 255, 255);
  ecrire(doc, 'MAbeauty', MARGE, 15);
  const l = doc.getTextWidth('MAbeauty');
  couleur(doc, [247, 155, 198]);
  ecrire(doc, 'plus', MARGE + l, 15);

  police(doc, 8, 'normal');
  couleur(doc, [169, 224, 224]);
  ecrire(doc, titre.toUpperCase(), MARGE, 22);

  police(doc, 8, 'normal');
  ecrire(doc, sousTitre, A4_W - MARGE, 22, { align: 'right' });
}

function pied(doc: Doc, d: DonneesRecap, page: number) {
  police(doc, 7.5, 'normal');
  couleur(doc, GRIS);
  ecrire(doc, 
    `${d.centre.nom} · ${d.centre.adresse}, ${d.centre.codePostal} ${d.centre.ville} · ${d.centre.telephone}`,
    MARGE,
    A4_H - 12,
  );
  ecrire(doc, String(page), A4_W - MARGE, A4_H - 12, { align: 'right' });
}

/** Le titre d'une section, avec son filet teal. */
function sousTitre(doc: Doc, texte: string, y: number): number {
  police(doc, 7.5, 'bold');
  couleur(doc, TEAL_SOMBRE);
  ecrire(doc, texte.toUpperCase(), MARGE, y);
  doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.setLineWidth(0.5);
  doc.line(MARGE, y + 1.8, MARGE + 14, y + 1.8);
  return y + 8;
}

/** La carte d'un axe dominant : profil ou terrain. */
function carteAxe(
  doc: Doc,
  etiquette: string,
  axe: DonneesRecap['profil'],
  y: number,
): number {
  const hautDeCarte = y;

  police(doc, 7, 'bold');
  couleur(doc, GRIS);
  ecrire(doc, etiquette.toUpperCase(), MARGE + 5, y + 7);

  police(doc, 16, 'bold');
  couleur(doc, ENCRE);
  ecrire(doc, axe.nom, MARGE + 5, y + 15);

  police(doc, 9, 'italic');
  couleur(doc, GRIS);
  ecrire(doc, axe.signature, MARGE + 5, y + 20.5);

  police(doc, 20, 'bold');
  couleur(doc, TEAL_SOMBRE);
  ecrire(doc, `${axe.pourcentage} %`, A4_W - MARGE - 5, y + 16, { align: 'right' });

  let curseur = y + 28;
  police(doc, 9, 'normal');
  couleur(doc, ENCRE);
  curseur = paragraphe(doc, axe.texte, MARGE + 5, curseur, LARGEUR - 10, 4.8);

  curseur += 2;
  police(doc, 7, 'bold');
  couleur(doc, GRIS);
  ecrire(doc, 'CE QUE CELA CHANGE CHEZ VOUS', MARGE + 5, curseur);
  curseur += 5;

  police(doc, 9, 'normal');
  couleur(doc, ENCRE);
  for (const impact of axe.impacts) {
    doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.circle(MARGE + 7, curseur - 1.2, 0.9, 'F');
    ecrire(doc, impact, MARGE + 11, curseur);
    curseur += 5;
  }

  // Le cadre se trace après coup : sa hauteur dépend du texte.
  doc.setDrawColor(TRAIT[0], TRAIT[1], TRAIT[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGE, hautDeCarte, LARGEUR, curseur - hautDeCarte + 1, 3, 3, 'S');

  return curseur + 8;
}

function ligneTableau(
  doc: Doc,
  gauche: string,
  milieu: string,
  droite: string,
  y: number,
  gras = false,
): number {
  police(doc, 9.5, gras ? 'bold' : 'normal');
  couleur(doc, gras ? ENCRE : [65, 89, 90]);
  ecrire(doc, gauche, MARGE + 3, y);
  if (milieu) {
    couleur(doc, GRIS);
    ecrire(doc, milieu, A4_W - MARGE - 40, y, { align: 'right' });
  }
  police(doc, 9.5, gras ? 'bold' : 'normal');
  couleur(doc, gras ? ENCRE : [65, 89, 90]);
  ecrire(doc, droite, A4_W - MARGE - 3, y, { align: 'right' });

  doc.setDrawColor(TRAIT[0], TRAIT[1], TRAIT[2]);
  doc.setLineWidth(0.2);
  doc.line(MARGE, y + 2.2, A4_W - MARGE, y + 2.2);
  return y + 7.5;
}

export function genererRecapPdf(d: DonneesRecap): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // =========================================================================
  // Page 1 — ce que le bilan a révélé
  // =========================================================================

  bandeau(doc, 'Diagnostic BioPortrait', d.dateBilan);

  let y = 44;
  police(doc, 22, 'normal');
  couleur(doc, ENCRE);
  ecrire(doc, 'Votre ', MARGE, y);
  const largeurVotre = doc.getTextWidth('Votre ');
  police(doc, 22, 'bold');
  ecrire(doc, 'BioPortrait', MARGE + largeurVotre, y);

  y += 8;
  police(doc, 10, 'normal');
  couleur(doc, GRIS);
  ecrire(doc, `${d.civilite} ${d.prenom} ${d.nom}`, MARGE, y);

  y += 10;
  doc.setFillColor(FOND[0], FOND[1], FOND[2]);
  doc.roundedRect(MARGE, y - 6, LARGEUR, 12, 2, 2, 'F');
  police(doc, 11, 'bold');
  couleur(doc, TEAL_SOMBRE);
  ecrire(doc, `${d.profil.nom}  ×  ${d.terrain.nom}`, A4_W / 2, y + 1.5, { align: 'center' });

  y += 16;
  y = sousTitre(doc, 'Votre profil comportemental', y);
  y = carteAxe(doc, 'Qui vous êtes aujourd’hui', d.profil, y);

  y = sousTitre(doc, 'Votre terrain physiologique', y);
  y = carteAxe(doc, 'Ce que révèle votre corps', d.terrain, y);

  if (d.aussiPresents.length > 0 && y < BAS - 20) {
    y = sousTitre(doc, 'Aussi présent chez vous', y);
    police(doc, 9, 'normal');
    couleur(doc, [65, 89, 90]);
    ecrire(doc, 
      d.aussiPresents.map((a) => `${a.nom} ${a.pourcentage} %`).join('   ·   '),
      MARGE,
      y,
    );
    y += 10;
  }

  if (d.inbody.length > 0 && y < BAS - 24) {
    y = sousTitre(doc, 'Votre analyse de composition corporelle', y);
    police(doc, 9, 'normal');
    for (const m of d.inbody) {
      couleur(doc, GRIS);
      ecrire(doc, m.libelle, MARGE + 3, y);
      couleur(doc, ENCRE);
      police(doc, 9, 'bold');
      ecrire(doc, m.valeur, A4_W - MARGE - 3, y, { align: 'right' });
      police(doc, 9, 'normal');
      doc.setDrawColor(TRAIT[0], TRAIT[1], TRAIT[2]);
      doc.setLineWidth(0.2);
      doc.line(MARGE, y + 2.2, A4_W - MARGE, y + 2.2);
      y += 7;
    }
  }

  pied(doc, d, 1);

  // =========================================================================
  // Page 2 — ce que nous vous proposons
  // =========================================================================

  doc.addPage();
  bandeau(doc, 'Votre programme sur mesure', d.dateBilan);

  y = 44;
  police(doc, 22, 'normal');
  couleur(doc, ENCRE);
  ecrire(doc, 'Votre cure ', MARGE, y);
  const largeurCure = doc.getTextWidth('Votre cure ');
  police(doc, 22, 'bold');
  ecrire(doc, 'sur mesure', MARGE + largeurCure, y);

  y += 8;
  police(doc, 10, 'normal');
  couleur(doc, GRIS);
  y = paragraphe(
    doc,
    'Construite à partir de votre BioPortrait : chaque soin répond à ce que votre bilan a montré.',
    MARGE,
    y,
    LARGEUR,
    5,
  );

  y += 6;
  y = sousTitre(doc, 'Vos soins', y);
  for (const s of d.soins) {
    y = ligneTableau(doc, s.libelle, `${s.seances} séances`, euros(s.montant), y);
  }
  for (const o of d.options) {
    y = ligneTableau(doc, o.libelle, '', euros(o.montant), y);
  }
  y = ligneTableau(doc, `Total · ${d.totalSeances} séances`, '', euros(d.montantTotal), y, true);

  y += 6;

  // Le prix, mis en avant comme à l'écran : c'est le chiffre qu'elle cherche.
  doc.setFillColor(TEAL_SOMBRE[0], TEAL_SOMBRE[1], TEAL_SOMBRE[2]);
  doc.roundedRect(MARGE, y, LARGEUR, d.echeances.length > 1 ? 40 : 28, 3, 3, 'F');

  police(doc, 7.5, 'bold');
  couleur(doc, [159, 214, 214]);
  ecrire(doc, 'VOTRE ACCOMPAGNEMENT', MARGE + 6, y + 8);

  police(doc, 20, 'bold');
  doc.setTextColor(255, 255, 255);
  ecrire(doc, euros(d.montantRegle), MARGE + 6, y + 18);

  police(doc, 9, 'normal');
  couleur(doc, [191, 230, 230]);
  ecrire(doc, d.reglement, MARGE + 6, y + 24);

  if (d.echeances.length > 1) {
    police(doc, 8.5, 'normal');
    couleur(doc, [191, 230, 230]);
    const texteEcheances = d.echeances
      .map((e, i) => `${i === 0 ? '1re' : `${e.rang}e`} : ${euros(Number(e.montant))}`)
      .join('   ·   ');
    ecrire(doc, texteEcheances, MARGE + 6, y + 33);
  }

  y += (d.echeances.length > 1 ? 40 : 28) + 10;

  y = sousTitre(doc, 'Et tout ce qui est compris', y);
  for (const i of d.inclus) {
    if (y > BAS - 12) break;
    police(doc, 9.5, 'bold');
    couleur(doc, ENCRE);
    doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.circle(MARGE + 2, y - 1.2, 0.9, 'F');
    ecrire(doc, i.titre, MARGE + 6, y);
    y += 4.4;
    police(doc, 8.5, 'normal');
    couleur(doc, GRIS);
    y = paragraphe(doc, i.detail, MARGE + 6, y, LARGEUR - 6, 4.2);
    y += 2.5;
  }

  if (y < BAS - 14) {
    doc.setFillColor(FOND[0], FOND[1], FOND[2]);
    doc.roundedRect(MARGE, y, LARGEUR, 14, 2, 2, 'F');
    police(doc, 9, 'normal');
    couleur(doc, TEAL_SOMBRE);
    ecrire(doc, 
      `Une question, une hésitation ? Appelez-nous au ${d.centre.telephone}.`,
      A4_W / 2,
      y + 8.5,
      { align: 'center' },
    );
  }

  pied(doc, d, 2);

  // Le magenta ne sert qu'à une chose ici : un filet en tête de la page de
  // l'offre, pour la distinguer de la page du diagnostic.
  doc.setPage(2);
  doc.setFillColor(MAGENTA[0], MAGENTA[1], MAGENTA[2]);
  doc.rect(0, 30, A4_W, 1.2, 'F');

  return doc;
}

/** Le PDF en base64, prêt à être rangé en base puis déposé dans Airtable. */
export function recapEnBase64(d: DonneesRecap): string {
  const doc = genererRecapPdf(d);
  const sortie = doc.output('datauristring');
  return sortie.slice(sortie.indexOf(',') + 1);
}
