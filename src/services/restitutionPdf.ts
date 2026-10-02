/*
  L'export NOMMÉ, et non celui par défaut : `import jsPDF from 'jspdf'` rend
  l'espace de noms du module quand Node charge le paquet, et « jsPDF is not a
  constructor ». Le nommé marche des deux côtés, et c'est ce qui permet de
  fabriquer une restitution d'exemple hors application pour la regarder.
*/
import { jsPDF } from 'jspdf';
import { LOGO_PDF, LOGO_RATIO } from './logoPdf';
import { pourPdf } from '../domain/texte';
import type { DonneesRestitution } from '../domain/recapitulatif';

/*
  La restitution du BioPortrait, en quatre pages.

  Ce document est le seul que la cliente emporte. Trois jours plus tard, il
  ne lui reste de son rendez-vous qu'une impression — « c'était bien, mais
  c'était cher » — et ce papier. Il doit donc tenir seul : ce qu'elle est,
  pourquoi les choses se passent comme elles se passent chez elle, ce qu'on
  met en face de chaque point, et ce que cela coûte.

  CELLE QUI DÉMARRE N'EN REÇOIT QUE TROIS. Son contrat porte déjà le prix et
  l'échéancier, et un document de dossier qui annonce un tarif devient faux
  le jour où les tarifs changent — on peut ressortir celui-ci six mois plus
  tard sans réveiller une offre périmée.

  LES ÉCARTS ASSUMÉS AVEC LA MAQUETTE. Le modèle est une page web rendue par
  un navigateur ; ici chaque trait est posé à la main. Deux choses s'en
  ressentent et c'est accepté (Jonathan, 2 octobre 2026) : les dégradés —
  le filet tricolore du haut, le bloc profond du prix — sont peints en
  bandes fines plutôt qu'en vrai dégradé continu, et les pictogrammes sont
  redessinés au trait. À l'œil, rien d'autre ne distingue les deux.

  Tout le texte passe par `pourPdf()` : l'espace fine insécable du français
  s'imprime « / » dans un PDF, et « 1 977 € » est déjà parti chez une
  cliente en « 1 / 977 € ».
*/

type Doc = jsPDF;
type RVB = [number, number, number];

/* --- la page ------------------------------------------------------------- */
const L = 210;
const H = 297;
const MARGE = 16;
const LARGEUR = L - MARGE * 2;
const HAUT = 12;
const PIED = H - 12;

/* --- la palette, calée sur les jetons de la DA --------------------------- */
const BLANC: RVB = [255, 255, 255];
const WASH: RVB = [244, 251, 251];
const WASH2: RVB = [234, 247, 247];
const ROSE_WASH: RVB = [254, 243, 248];
const VIOLET_WASH: RVB = [242, 238, 250];
const FILET: RVB = [230, 239, 239];
const FILET_AQUA: RVB = [168, 222, 222];
const FILET_ROSE: RVB = [246, 211, 228];
const FILET_VIOLET: RVB = [207, 192, 232];
const RAIL: RVB = [228, 242, 242];
const AQUA: RVB = [59, 191, 191];
const AQUA_TEXTE: RVB = [31, 127, 127];
const PROFOND: RVB = [15, 67, 68];
const PROFOND_2: RVB = [23, 90, 92];
const PROFOND_DOUX: RVB = [159, 220, 220];
const PROFOND_TEXTE: RVB = [207, 237, 237];
const ROSE: RVB = [232, 49, 138];
const ROSE_TEXTE: RVB = [196, 40, 114];
const VIOLET_TEXTE: RVB = [122, 92, 181];
const ENCRE: RVB = [21, 43, 44];
const TEXTE: RVB = [65, 89, 90];
const GRIS: RVB = [124, 144, 145];
const GRIS_DOUX: RVB = [155, 171, 171];

/* --- les primitives ------------------------------------------------------ */

function police(doc: Doc, taille: number, style: 'normal' | 'bold' | 'italic' = 'normal') {
  doc.setFont('helvetica', style);
  doc.setFontSize(taille);
}

const encre = (doc: Doc, c: RVB) => doc.setTextColor(c[0], c[1], c[2]);
const fond = (doc: Doc, c: RVB) => doc.setFillColor(c[0], c[1], c[2]);
const trait = (doc: Doc, c: RVB) => doc.setDrawColor(c[0], c[1], c[2]);

function ecrire(doc: Doc, texte: string, x: number, y: number, options?: { align?: 'left' | 'center' | 'right' }) {
  doc.text(pourPdf(texte), x, y, options);
}

/**
 * Un dégradé, peint en bandes fines.
 *
 * jsPDF ne connaît pas les dégradés. Cent bandes de deux millimètres se
 * lisent comme un dégradé continu à l'œil comme à l'impression, pour un
 * poids de fichier négligeable.
 */
function degrade(doc: Doc, x: number, y: number, w: number, h: number, etapes: RVB[], bandes = 80) {
  for (let i = 0; i < bandes; i += 1) {
    const t = i / (bandes - 1);
    const pas = t * (etapes.length - 1);
    const a = etapes[Math.min(Math.floor(pas), etapes.length - 1)];
    const b = etapes[Math.min(Math.floor(pas) + 1, etapes.length - 1)];
    const f = pas - Math.floor(pas);
    fond(doc, [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f),
    ]);
    doc.rect(x + (w * i) / bandes, y, w / bandes + 0.35, h, 'F');
  }
}

/** Une carte : un filet, un fond, et le rayon de la charte. */
function carte(doc: Doc, x: number, y: number, w: number, h: number, remplissage: RVB = BLANC, filet: RVB = FILET) {
  fond(doc, remplissage);
  trait(doc, filet);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 4.5, 4.5, 'FD');
}

/** Un paragraphe, et l'ordonnée où il se termine. */
function paragraphe(doc: Doc, texte: string, x: number, y: number, w: number, interligne: number): number {
  const lignes = doc.splitTextToSize(pourPdf(texte), w) as string[];
  lignes.forEach((ligne, i) => doc.text(ligne, x, y + i * interligne));
  return y + lignes.length * interligne;
}

/** Combien de millimètres ce paragraphe occupera. */
function hauteurTexte(doc: Doc, texte: string, w: number, interligne: number): number {
  return (doc.splitTextToSize(pourPdf(texte), w) as string[]).length * interligne;
}

/**
 * Un titre qui tient dans sa colonne.
 *
 * « Analyse de composition corporelle » dépasse la largeur d'une case du
 * socle et se faisait couper au milieu d'un mot. On réduit le corps jusqu'à
 * ce qu'il entre, plutôt que de raccourcir le nom d'un soin dans le barème —
 * c'est la mise en page qui s'adapte au texte, jamais l'inverse.
 */
function ecrireAjuste(doc: Doc, texte: string, x: number, y: number, large: number, taille: number, mini = 6) {
  let t = taille;
  police(doc, t, 'bold');
  while (doc.getTextWidth(pourPdf(texte)) > large && t > mini) {
    t -= 0.3;
    police(doc, t, 'bold');
  }
  doc.text(pourPdf(texte), x, y);
}

/** Le sur-titre d'une section : petit, espacé, en aqua. */
function surtitre(doc: Doc, texte: string, x: number, y: number) {
  police(doc, 7.5, 'bold');
  encre(doc, AQUA_TEXTE);
  doc.text(pourPdf(texte.toUpperCase()), x, y, { charSpace: 0.35 });
}

/* --- les pictogrammes ---------------------------------------------------- */

/**
 * Les pictogrammes, redessinés au trait.
 *
 * La maquette les porte en SVG ; jsPDF ne sait pas les lire. Chacun tient en
 * quelques primitives, à l'intérieur d'une pastille aqua.
 */
function picto(doc: Doc, nom: string, cx: number, cy: number, r: number) {
  trait(doc, BLANC);
  doc.setLineWidth(0.3);
  const d = r * 0.62;

  switch (nom) {
    case 'lumiere':
      doc.circle(cx, cy, d * 0.42, 'S');
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        doc.line(cx + Math.cos(a) * d * 0.68, cy + Math.sin(a) * d * 0.68,
                 cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      }
      break;
    case 'lune':
      doc.circle(cx + d * 0.1, cy, d * 0.82, 'S');
      fond(doc, AQUA);
      doc.circle(cx + d * 0.62, cy - d * 0.3, d * 0.78, 'F');
      break;
    case 'eclair':
      doc.lines([[d * 0.55, d * 0.75], [-d * 0.55, 0], [d * 0.45, d * 0.75],
                 [d * 0.35, -d * 0.75], [-d * 0.5, 0], [d * 0.2, -d * 0.75]],
                cx - d * 0.5, cy - d * 0.75, [1, 1], 'S', true);
      break;
    case 'vague':
      for (let i = -1; i <= 1; i += 1) {
        const y = cy + i * d * 0.62;
        doc.lines([[d * 0.5, -d * 0.45, d * 1.0, d * 0.45, d * 1.5, 0],
                   [d * 0.5, -d * 0.45, d * 1.0, d * 0.45, d * 1.5, 0]],
                  cx - d * 1.5, y, [0.5, 0.5], 'S');
      }
      break;
    case 'assiette':
      doc.circle(cx, cy, d * 0.92, 'S');
      doc.circle(cx, cy, d * 0.45, 'S');
      break;
    case 'mains':
      doc.circle(cx - d * 0.3, cy - d * 0.42, d * 0.36, 'S');
      doc.lines([[d * 0.35, -d * 0.5, d * 0.95, -d * 0.5, d * 1.3, 0]],
                cx - d * 0.95, cy + d * 0.62, [1, 1], 'S');
      doc.circle(cx + d * 0.62, cy - d * 0.18, d * 0.26, 'S');
      break;
    case 'graphique':
      doc.line(cx - d, cy + d * 0.8, cx + d, cy + d * 0.8);
      [[-0.6, 0.35], [0, 0.95], [0.6, 0.6]].forEach(([dx, h]) => {
        doc.line(cx + dx * d, cy + d * 0.8, cx + dx * d, cy + d * 0.8 - h * d * 1.5);
      });
      break;
    case 'casque':
      doc.lines([[d * 0.45, -d * 0.95, d * 1.35, -d * 0.95, d * 1.8, 0]],
                cx - d * 0.9, cy, [1, 1], 'S');
      doc.roundedRect(cx - d * 0.95, cy - d * 0.05, d * 0.42, d * 0.85, 0.25, 0.25, 'S');
      doc.roundedRect(cx + d * 0.53, cy - d * 0.05, d * 0.42, d * 0.85, 0.25, 0.25, 'S');
      break;
    case 'cible':
      doc.circle(cx, cy, d * 0.92, 'S');
      doc.circle(cx, cy, d * 0.5, 'S');
      fond(doc, BLANC);
      doc.circle(cx, cy, d * 0.14, 'F');
      break;
    case 'empreinte':
    default:
      doc.circle(cx, cy + d * 0.15, d * 0.25, 'S');
      doc.circle(cx, cy + d * 0.15, d * 0.58, 'S');
      doc.circle(cx, cy + d * 0.15, d * 0.92, 'S');
      break;
  }
}

/** La pastille aqua qui porte un pictogramme. */
function pastillePicto(doc: Doc, nom: string, x: number, y: number, diametre: number) {
  fond(doc, AQUA);
  doc.circle(x + diametre / 2, y + diametre / 2, diametre / 2, 'F');
  picto(doc, nom, x + diametre / 2, y + diametre / 2, diametre / 2);
}

/* --- l'en-tête et le pied ------------------------------------------------ */

function enTete(doc: Doc, d: DonneesRestitution, kicker: string): number {
  // Le filet de marque, en haut de chaque page.
  degrade(doc, 0, 0, L, 1.8, [AQUA, [142, 111, 198], ROSE], 48);

  /*
    L'ALIAS, SANS QUOI LE LOGO EST RECOPIÉ SUR CHAQUE PAGE. jsPDF range une
    image par alias ; sans alias il en invente un à chaque appel et stocke
    quatre fois les 46 Ko du JPEG. Le document passe de 190 à 60 Ko — il part
    chez chaque cliente et Airtable le conserve.
  */
  const largeurLogo = 36;
  doc.addImage(LOGO_PDF, 'JPEG', MARGE, HAUT, largeurLogo, largeurLogo / LOGO_RATIO, 'logo-mabeautyplus');

  police(doc, 7.5, 'bold');
  encre(doc, AQUA_TEXTE);
  doc.text(pourPdf(kicker.toUpperCase()), L - MARGE, HAUT + 4, { align: 'right', charSpace: 0.3 });

  police(doc, 8, 'normal');
  encre(doc, GRIS_DOUX);
  ecrire(doc, d.dateBilan, L - MARGE, HAUT + 8.5, { align: 'right' });

  const y = HAUT + largeurLogo / LOGO_RATIO + 3.5;
  trait(doc, FILET);
  doc.setLineWidth(0.25);
  doc.line(MARGE, y, L - MARGE, y);
  return y + 7;
}

function pied(doc: Doc, d: DonneesRestitution, page: number, total: number) {
  trait(doc, FILET);
  doc.setLineWidth(0.25);
  doc.line(MARGE, PIED - 3, L - MARGE, PIED - 3);
  police(doc, 7, 'normal');
  encre(doc, GRIS_DOUX);
  ecrire(doc, `MAbeautyplus ${d.centre.nom} · ${d.centre.adresse}, ${d.centre.codePostal} ${d.centre.ville}`, MARGE, PIED);
  ecrire(doc, `${page} / ${total}`, L - MARGE, PIED, { align: 'right' });
}

/* --- les blocs ----------------------------------------------------------- */

/**
 * Le bloc vert profond qui porte le croisement, puis le prix.
 *
 * Deux calottes arrondies aux couleurs des extrémités, et le dégradé entre
 * les deux. La première version peignait le dégradé trois fois et reposait
 * des carrés blancs sur les angles : trente kilo-octets de traits inutiles
 * dans un document qui part chez chaque cliente.
 */
function blocProfond(doc: Doc, x: number, y: number, w: number, h: number) {
  const r = 5.8;
  fond(doc, PROFOND);
  doc.roundedRect(x, y, r * 2, h, r, r, 'F');
  fond(doc, PROFOND_2);
  doc.roundedRect(x + w - r * 2, y, r * 2, h, r, r, 'F');
  degrade(doc, x + r, y, w - r * 2, h, [PROFOND, PROFOND_2], 36);
}

/** La jauge d'un axe : un rail, une part remplie, le pourcentage. */
function jauge(doc: Doc, x: number, y: number, w: number, pct: number, legende: string): number {
  fond(doc, RAIL);
  doc.roundedRect(x, y, w, 4, 2, 2, 'F');
  fond(doc, AQUA);
  const rempli = Math.max(4, (w * Math.min(100, Math.max(0, pct))) / 100);
  doc.roundedRect(x, y, rempli, 4, 2, 2, 'F');

  police(doc, 11, 'bold');
  encre(doc, AQUA_TEXTE);
  ecrire(doc, `${Math.round(pct)} %`, x, y + 9);
  police(doc, 7.5, 'normal');
  encre(doc, GRIS_DOUX);
  ecrire(doc, legende, x + w, y + 9, { align: 'right' });
  return y + 12;
}

/** Trois puces aqua. */
function puces(doc: Doc, items: string[], x: number, y: number, w: number): number {
  police(doc, 8.5, 'normal');
  let courant = y;
  for (const item of items) {
    fond(doc, AQUA);
    doc.circle(x + 0.9, courant - 1, 0.8, 'F');
    encre(doc, TEXTE);
    courant = paragraphe(doc, item, x + 3.4, courant, w - 3.4, 3.6) + 1.2;
  }
  return courant;
}

/* =========================================================================
   PAGE 1 — Votre BioPortrait
   ========================================================================= */

function page1(doc: Doc, d: DonneesRestitution) {
  let y = enTete(doc, d, 'Votre BioPortrait');

  police(doc, 22, 'normal');
  encre(doc, ENCRE);
  ecrire(doc, 'Votre ', MARGE, y);
  const large = doc.getTextWidth('Votre ');
  police(doc, 22, 'bold');
  ecrire(doc, 'BioPortrait', MARGE + large, y);

  y += 6;
  police(doc, 10, 'normal');
  encre(doc, GRIS);
  ecrire(doc, `${d.civilite} ${d.prenom} ${d.nom}`, MARGE, y);

  // --- le croisement ------------------------------------------------------
  y += 6;
  blocProfond(doc, MARGE, y, LARGEUR, 26);
  police(doc, 7, 'bold');
  encre(doc, PROFOND_DOUX);
  const g = MARGE + LARGEUR * 0.27;
  const dte = MARGE + LARGEUR * 0.73;
  doc.text(pourPdf('VOTRE PROFIL'), g, y + 9, { align: 'center', charSpace: 0.3 });
  doc.text(pourPdf('VOTRE TERRAIN'), dte, y + 9, { align: 'center', charSpace: 0.3 });
  police(doc, 17, 'bold');
  encre(doc, BLANC);
  ecrire(doc, d.profil.nom, g, y + 18.5, { align: 'center' });
  ecrire(doc, d.terrain.nom, dte, y + 18.5, { align: 'center' });
  police(doc, 15, 'normal');
  encre(doc, PROFOND_DOUX);
  ecrire(doc, '×', L / 2, y + 17.5, { align: 'center' });

  // --- le duo profil / terrain -------------------------------------------
  y += 32;
  const lCarte = (LARGEUR - 6) / 2;
  const hCarte = 76;
  [
    { x: MARGE, kicker: "Qui vous êtes aujourd'hui", a: d.profil },
    { x: MARGE + lCarte + 6, kicker: 'Ce que révèle votre corps', a: d.terrain },
  ].forEach(({ x, kicker, a }) => {
    carte(doc, x, y, lCarte, hCarte);
    const px = x + 6;
    const pw = lCarte - 12;
    surtitre(doc, kicker, px, y + 8);
    police(doc, 16, 'bold');
    encre(doc, ENCRE);
    ecrire(doc, a.nom, px, y + 17);
    police(doc, 9.6, 'italic');
    encre(doc, AQUA_TEXTE);
    ecrire(doc, a.sousTitre, px, y + 23);
    police(doc, 9.4, 'normal');
    encre(doc, TEXTE);
    const apres = paragraphe(doc, a.resume, px, y + 30, pw, 4.4);
    const apresJauge = jauge(doc, px, apres + 4, pw, a.pourcentage, 'de vos réponses');
    puces(doc, a.manifestations, px, apresJauge + 3, pw);
  });

  // --- la composition corporelle ------------------------------------------
  y += hCarte + 6;
  surtitre(doc, 'Votre analyse de composition corporelle', MARGE, y);
  y += 3;

  const colonnes = [42, 27, 33, LARGEUR - 102];
  const xCol = [MARGE, MARGE + 42, MARGE + 69, MARGE + 102];
  const hLigne = 10.4;
  const hTableau = 7 + d.composition.length * hLigne;

  carte(doc, MARGE, y, LARGEUR, hTableau);
  fond(doc, WASH2);
  doc.roundedRect(MARGE, y, LARGEUR, 7, 4.5, 4.5, 'F');
  doc.rect(MARGE, y + 3.5, LARGEUR, 3.5, 'F');
  police(doc, 6.8, 'bold');
  encre(doc, AQUA_TEXTE);
  ['MESURE', 'NIVEAU', 'SITUATION', 'CE QUE CELA VEUT DIRE'].forEach((t, i) => {
    doc.text(pourPdf(t), xCol[i] + 4, y + 4.7, { charSpace: 0.25 });
  });

  let yl = y + 7;
  d.composition.forEach((ligne, i) => {
    if (i > 0) {
      trait(doc, FILET);
      doc.setLineWidth(0.2);
      doc.line(MARGE + 2, yl, L - MARGE - 2, yl);
    }
    police(doc, 8.8, 'bold');
    encre(doc, ENCRE);
    ecrire(doc, ligne.libelle, xCol[0] + 4, yl + 6);

    // Les pastilles : trois, remplies jusqu'au niveau, roses si ça alerte.
    for (let k = 0; k < 3; k += 1) {
      fond(doc, k < ligne.niveau ? (ligne.alerte ? ROSE : AQUA) : RAIL);
      doc.roundedRect(xCol[1] + 4 + k * 7, yl + 3.6, 6, 2.8, 1.4, 1.4, 'F');
    }

    police(doc, 8.4, 'bold');
    encre(doc, ENCRE);
    ecrire(doc, ligne.situation, xCol[2] + 4, yl + 6);

    police(doc, 7.8, 'normal');
    encre(doc, TEXTE);
    const lignes = doc.splitTextToSize(pourPdf(ligne.sens), colonnes[3] - 8) as string[];
    lignes.slice(0, 2).forEach((t, k) => doc.text(t, xCol[3] + 4, yl + (lignes.length > 1 ? 4.4 : 6) + k * 3.3));
    yl += hLigne;
  });

  // --- les priorités -------------------------------------------------------
  y += hTableau + 8;
  const hPrio = 28;
  carte(doc, MARGE, y, LARGEUR, hPrio, WASH2, FILET_AQUA);
  surtitre(doc, `Les ${d.priorites.length === 3 ? 'trois' : 'deux'} points sur lesquels nous allons agir`, MARGE + 6, y + 8);
  const lPrio = (LARGEUR - 12 - (d.priorites.length - 1) * 6) / d.priorites.length;
  d.priorites.forEach((p, i) => {
    const px = MARGE + 6 + i * (lPrio + 6);
    fond(doc, AQUA);
    doc.circle(px + 2.6, y + 16, 2.6, 'F');
    police(doc, 8, 'bold');
    encre(doc, BLANC);
    ecrire(doc, String(i + 1), px + 2.6, y + 17.1, { align: 'center' });
    police(doc, 8.2, 'normal');
    encre(doc, ENCRE);
    paragraphe(doc, p, px + 7, y + 15, lPrio - 7, 3.5);
  });

  police(doc, 7, 'normal');
  encre(doc, GRIS_DOUX);
  paragraphe(doc,
    'Les pourcentages expriment la part de vos réponses qui oriente vers ce profil et ce terrain.',
    MARGE, y + hPrio + 6, LARGEUR, 3.2);

  pied(doc, d, 1, d.pages);
}

/* =========================================================================
   PAGE 2 — Ce que votre BioPortrait raconte
   ========================================================================= */

function page2(doc: Doc, d: DonneesRestitution) {
  let y = enTete(doc, d, 'Ce que votre BioPortrait raconte');

  police(doc, 19, 'normal');
  encre(doc, ENCRE);
  ecrire(doc, 'Ce que nous avons vu,', MARGE, y);
  police(doc, 19, 'bold');
  ecrire(doc, 'et ce que cela explique', MARGE, y + 8);

  y += 16;
  police(doc, 11, 'normal');
  encre(doc, TEXTE);
  y = paragraphe(doc,
    "Votre BioPortrait n'est pas une étiquette. C'est une manière de comprendre pourquoi, chez vous précisément, les choses se passent comme elles se passent.",
    MARGE, y, LARGEUR, 5.2) + 9;

  // --- 1. ce qu'elle vit ---------------------------------------------------
  surtitre(doc, "1 — Ce que vous vivez au quotidien", MARGE, y);
  y += 4;
  police(doc, 10.2, 'normal');
  const hVecu = hauteurTexte(doc, d.vecu, LARGEUR - 14, 4.8) + 9;
  carte(doc, MARGE, y, LARGEUR, hVecu, WASH);
  encre(doc, TEXTE);
  paragraphe(doc, d.vecu, MARGE + 7, y + 7, LARGEUR - 14, 4.8);
  y += hVecu + 7;

  // --- 2. les deux mécanismes ---------------------------------------------
  surtitre(doc, '2 — Ce qui se passe réellement dans votre corps', MARGE, y);
  y += 4;

  for (const bloc of [
    { titre: `Votre profil : ${d.profil.nom}`, texte: d.profil.mecanisme },
    { titre: `Votre terrain : ${d.terrain.nom}`, texte: d.terrain.mecanisme },
  ]) {
    police(doc, 10.2, 'normal');
    const h = hauteurTexte(doc, bloc.texte, LARGEUR - 14, 4.8) + 15;
    carte(doc, MARGE, y, LARGEUR, h);
    police(doc, 12.5, 'bold');
    encre(doc, ENCRE);
    ecrire(doc, bloc.titre, MARGE + 7, y + 9);
    police(doc, 10.2, 'normal');
    encre(doc, TEXTE);
    paragraphe(doc, bloc.texte, MARGE + 7, y + 15, LARGEUR - 14, 4.8);
    y += h + 4;
  }

  // --- 3. le croisement ----------------------------------------------------
  y += 3;
  surtitre(doc, "3 — Pourquoi c'est le croisement des deux qui compte", MARGE, y);
  y += 5;

  const lBoite = 66;
  const hBoite = 24;
  const yBoite = y + 8;
  carte(doc, MARGE + 4, yBoite, lBoite, hBoite, WASH2, FILET_AQUA);
  carte(doc, L - MARGE - 4 - lBoite, yBoite, lBoite, hBoite, VIOLET_WASH, FILET_VIOLET);

  police(doc, 12.5, 'bold');
  encre(doc, ENCRE);
  ecrire(doc, d.profil.nom, MARGE + 4 + lBoite / 2, yBoite + 11, { align: 'center' });
  ecrire(doc, d.terrain.nom, L - MARGE - 4 - lBoite / 2, yBoite + 11, { align: 'center' });
  police(doc, 9, 'italic');
  encre(doc, AQUA_TEXTE);
  ecrire(doc, d.profil.sousTitre, MARGE + 4 + lBoite / 2, yBoite + 18, { align: 'center' });
  encre(doc, VIOLET_TEXTE);
  ecrire(doc, d.terrain.sousTitre, L - MARGE - 4 - lBoite / 2, yBoite + 18, { align: 'center' });

  // Les deux courbes, et ce qu'elles disent.
  const xg = MARGE + 4 + lBoite;
  const xd = L - MARGE - 4 - lBoite;
  trait(doc, FILET_AQUA);
  doc.setLineWidth(0.5);
  doc.lines([[(xd - xg) * 0.3, -9, (xd - xg) * 0.7, -9, xd - xg, 0]], xg, yBoite + 5, [1, 1], 'S');
  doc.lines([[-(xd - xg) * 0.3, 9, -(xd - xg) * 0.7, 9, -(xd - xg), 0]], xd, yBoite + hBoite - 5, [1, 1], 'S');

  [
    { t: "l'un ralentit l'autre", y: yBoite - 4 },
    { t: 'et réciproquement', y: yBoite + hBoite + 4 },
  ].forEach((e) => {
    police(doc, 8.6, 'bold');
    const w = doc.getTextWidth(pourPdf(e.t)) + 8;
    carte(doc, L / 2 - w / 2, e.y - 3.5, w, 7, BLANC, FILET);
    encre(doc, AQUA_TEXTE);
    ecrire(doc, e.t, L / 2, e.y + 1.4, { align: 'center' });
  });

  y = yBoite + hBoite + 11;

  police(doc, 10.2, 'normal');
  const hSynthese = hauteurTexte(doc, d.syntheseCroisement, LARGEUR - 14, 4.8)
    + hauteurTexte(doc, d.ordreDesChoses, LARGEUR - 14, 4.8) + 17;
  carte(doc, MARGE, y, LARGEUR, hSynthese, WASH2, FILET_AQUA);
  encre(doc, TEXTE);
  const apres = paragraphe(doc, d.syntheseCroisement, MARGE + 7, y + 8, LARGEUR - 14, 4.8);
  police(doc, 10.2, 'bold');
  encre(doc, ENCRE);
  ecrire(doc, "Ce qu'il faut faire, dans l'ordre :", MARGE + 7, apres + 6);
  police(doc, 10.2, 'normal');
  encre(doc, TEXTE);
  paragraphe(doc, d.ordreDesChoses, MARGE + 7, apres + 11, LARGEUR - 14, 4.8);

  pied(doc, d, 2, d.pages);
}

/* =========================================================================
   PAGE 3 — Votre programme
   ========================================================================= */

function page3(doc: Doc, d: DonneesRestitution) {
  let y = enTete(doc, d, 'Votre programme sur mesure');
  const serre = d.soins.length >= 3;

  police(doc, serre ? 17 : 19, 'normal');
  encre(doc, ENCRE);
  ecrire(doc, 'Votre programme,', MARGE, y);
  police(doc, serre ? 17 : 19, 'bold');
  ecrire(doc, 'construit sur votre BioPortrait', MARGE, y + 7.5);

  y += 14.5;
  police(doc, 10.5, 'normal');
  encre(doc, TEXTE);
  y = paragraphe(doc, d.soins.length > 0
    ? "Chaque élément répond à un point précis de votre analyse. Rien n'est là par défaut."
    : "Chaque élément de votre accompagnement répond à un point précis de votre analyse.",
    MARGE, y, LARGEUR, 5) + 8;

  // --- le tableau des correspondances -------------------------------------
  const lGauche = (LARGEUR - 14) * 0.47;
  const lDroite = LARGEUR - 14 - lGauche - 8;
  police(doc, 6.6, 'bold');
  encre(doc, AQUA_TEXTE);
  doc.text(pourPdf('CE QUE VOTRE ANALYSE A MONTRÉ'), MARGE + 4, y, { charSpace: 0.25 });
  doc.text(pourPdf('CE QUE NOUS METTONS EN FACE'), MARGE + 4 + lGauche + 14, y, { charSpace: 0.25 });
  y += 2;

  police(doc, 8.2, 'normal');
  const hauteurs = d.correspondances.map(
    (c) => Math.max(17, hauteurTexte(doc, c.texte, lDroite, 3.6) + 12),
  );
  const hCorr = hauteurs.reduce((a, b) => a + b, 0) + 3;
  carte(doc, MARGE, y, LARGEUR, hCorr, WASH2, FILET_AQUA);

  let yc = y + 1.5;
  d.correspondances.forEach((c, i) => {
    if (i > 0) {
      trait(doc, FILET_AQUA);
      doc.setLineWidth(0.2);
      doc.line(MARGE + 4, yc, L - MARGE - 4, yc);
    }
    const milieu = yc + hauteurs[i] / 2;
    police(doc, 10.6, 'bold');
    encre(doc, ENCRE);
    ecrire(doc, c.libelle, MARGE + 5, milieu - 0.8);
    police(doc, 8.4, 'normal');
    encre(doc, GRIS);
    ecrire(doc, c.sous, MARGE + 5, milieu + 3.8);

    // la flèche
    trait(doc, AQUA);
    doc.setLineWidth(0.5);
    const xf = MARGE + 4 + lGauche + 2;
    doc.line(xf, milieu, xf + 8, milieu);
    doc.line(xf + 5.5, milieu - 1.8, xf + 8, milieu);
    doc.line(xf + 5.5, milieu + 1.8, xf + 8, milieu);

    const xd = MARGE + 4 + lGauche + 14;
    police(doc, 10.2, 'bold');
    encre(doc, AQUA_TEXTE);
    ecrire(doc, c.prestation, xd, yc + 7);
    const w = doc.getTextWidth(pourPdf(c.prestation));
    police(doc, 8, 'normal');
    encre(doc, GRIS);
    ecrire(doc, `· ${c.detail}`, xd + w + 2, yc + 7);
    police(doc, 8.2, 'normal');
    encre(doc, TEXTE);
    paragraphe(doc, c.texte, xd, yc + 11.6, lDroite, 3.6);
    yc += hauteurs[i];
  });

  y += hCorr + 7;

  // --- les soins préconisés ------------------------------------------------
  if (d.soins.length > 0) {
    surtitre(doc, 'Vos prestations préconisées', MARGE, y);
    y += 4;

    const colonnes = d.soins.length >= 5 ? 3 : d.soins.length >= 3 ? 2 : 1;
    const lSoin = (LARGEUR - (colonnes - 1) * 4) / colonnes;
    const lignes = Math.ceil(d.soins.length / colonnes);
    const hSoin = colonnes === 1 ? 40 : colonnes === 2 ? 46 : 44;

    d.soins.forEach((s, i) => {
      const col = i % colonnes;
      const lig = Math.floor(i / colonnes);
      const x = MARGE + col * (lSoin + 4);
      const ys = y + lig * (hSoin + 3.5);
      carte(doc, x, ys, lSoin, hSoin, BLANC, FILET_AQUA);

      const diam = colonnes === 1 ? 9 : 7.4;
      pastillePicto(doc, s.icone, x + 5, ys + 4.5, diam);

      encre(doc, ENCRE);
      ecrireAjuste(doc, s.titre, x + 5 + diam + 3.5, ys + 9, lSoin - diam - 13, colonnes === 1 ? 12 : 10.2, 7.5);
      police(doc, 7.2, 'bold');
      encre(doc, AQUA_TEXTE);
      ecrire(doc, s.quantite, x + 5 + diam + 3.5, ys + 13.5);

      police(doc, colonnes === 3 ? 7.2 : 8, 'normal');
      encre(doc, TEXTE);
      let yt = paragraphe(doc, s.court, x + 5, ys + 18.5, lSoin - 10, colonnes === 3 ? 3.1 : 3.5) + 1.6;

      const atouts = colonnes === 1 ? s.atouts : s.atouts.slice(0, 2);
      police(doc, colonnes === 3 ? 7 : 7.6, 'normal');
      encre(doc, AQUA_TEXTE);
      for (const a of atouts) {
        fond(doc, AQUA);
        doc.circle(x + 5.8, yt - 1, 0.65, 'F');
        yt = paragraphe(doc, a, x + 8.2, yt, lSoin - 13, colonnes === 3 ? 3 : 3.3) + 0.6;
      }

      /*
        « Pourquoi dans votre programme » : le bloc qui fait tout l'intérêt
        de la page. Il prend la place qui reste au bas de la carte — et les
        cartes sont dimensionnées pour qu'il en reste toujours.
      */
      if (s.raisonTexte) {
        const hp = hSoin - (yt - ys) - 3;
        if (hp > 7) {
          fond(doc, WASH2);
          doc.roundedRect(x + 4, yt + 1.2, lSoin - 8, hp, 2, 2, 'F');
          police(doc, 6.2, 'bold');
          encre(doc, AQUA_TEXTE);
          doc.text(pourPdf('POURQUOI DANS VOTRE PROGRAMME'), x + 6.5, yt + 5, { charSpace: 0.2 });
          police(doc, colonnes === 3 ? 6.8 : 7.4, 'normal');
          encre(doc, ENCRE);
          const quoi = s.raisonLibelle ? `${s.raisonLibelle}. ${s.raisonTexte}` : s.raisonTexte;
          paragraphe(doc, quoi, x + 6.5, yt + 8.8, lSoin - 13, 3.1);
        }
      }
    });

    y += lignes * (hSoin + 3.5) + 4;
  }

  // --- le socle ------------------------------------------------------------
  surtitre(doc, 'Et ce que comprend toute cure MAbeautyplus', MARGE, y);
  y += 4;

  const colSocle = d.soins.length >= 3 ? 3 : 2;
  const lSocle = (LARGEUR - 10 - (colSocle - 1) * 6) / colSocle;
  const ligSocle = Math.ceil(d.socle.length / colSocle);
  const hLigneSocle = 12.5;
  const hSocle = 6 + ligSocle * hLigneSocle;

  carte(doc, MARGE, y, LARGEUR, hSocle, WASH);
  d.socle.forEach((s, i) => {
    const col = i % colSocle;
    const lig = Math.floor(i / colSocle);
    const x = MARGE + 5 + col * (lSocle + 6);
    const ys = y + 4 + lig * hLigneSocle;
    pastillePicto(doc, s.icone, x, ys, 5.6);
    encre(doc, ENCRE);
    ecrireAjuste(doc, s.titre, x + 7.4, ys + 3.8, lSocle - 8, 8.4);
    police(doc, 7, 'normal');
    encre(doc, TEXTE);
    paragraphe(doc, s.court, x + 7.4, ys + 7.4, lSocle - 8, 2.9);
  });

  if (d.soins.length > 0) {
    police(doc, 7, 'normal');
    encre(doc, GRIS_DOUX);
    paragraphe(doc,
      "Nos soins en cabine s'utilisent exclusivement en cure, jamais à la séance : c'est la répétition qui produit l'effet, pas la séance isolée.",
      MARGE, y + hSocle + 6, LARGEUR, 3.3);
  }

  pied(doc, d, 3, d.pages);
}

/* =========================================================================
   PAGE 4 — Votre accompagnement
   ========================================================================= */

function page4(doc: Doc, d: DonneesRestitution) {
  let y = enTete(doc, d, 'Votre accompagnement');

  police(doc, 19, 'normal');
  encre(doc, ENCRE);
  ecrire(doc, 'Votre accompagnement', MARGE, y);
  police(doc, 19, 'bold');
  ecrire(doc, "en un coup d'œil", MARGE, y + 8);

  y += 15;
  police(doc, 10, 'normal');
  encre(doc, TEXTE);
  y = paragraphe(doc,
    'Tout est réuni ici. Vous pouvez emporter cette page, la relire à tête reposée, et en parler autour de vous.',
    MARGE, y, LARGEUR, 4.6) + 6;

  // --- ce que comprend le programme ---------------------------------------
  surtitre(doc, 'Ce que comprend votre programme', MARGE, y);
  y += 3;

  const serre = d.recapitulatif.length > 4;
  const hL = serre ? 5 : 6.2;
  const hRecap = 4 + d.recapitulatif.length * hL;
  carte(doc, MARGE, y, LARGEUR, hRecap, WASH2, FILET_AQUA);
  d.recapitulatif.forEach((r, i) => {
    const yr = y + 2 + i * hL;
    if (i > 0) {
      trait(doc, FILET_AQUA);
      doc.setLineWidth(0.2);
      doc.line(MARGE + 5, yr, L - MARGE - 5, yr);
    }
    police(doc, serre ? 7.6 : 8.4, 'normal');
    encre(doc, ENCRE);
    ecrire(doc, r.libelle, MARGE + 5, yr + hL - 1.8);
    police(doc, serre ? 7.6 : 8.4, 'bold');
    encre(doc, AQUA_TEXTE);
    ecrire(doc, r.detail, L - MARGE - 5, yr + hL - 1.8, { align: 'right' });
  });
  y += hRecap + 5;

  // --- le prix -------------------------------------------------------------
  const hPrix = 30;
  blocProfond(doc, MARGE, y, LARGEUR, hPrix);
  police(doc, 7, 'bold');
  encre(doc, PROFOND_DOUX);
  doc.text(pourPdf('VOTRE ACCOMPAGNEMENT COMPLET'), MARGE + 7, y + 7, { charSpace: 0.3 });
  police(doc, 22, 'bold');
  encre(doc, BLANC);
  ecrire(doc, d.prix, MARGE + 7, y + 17);
  police(doc, 9, 'normal');
  encre(doc, PROFOND_TEXTE);
  ecrire(doc, d.mentionReglement, MARGE + 7, y + 22.5);

  if (d.echeances.length > 0) {
    trait(doc, PROFOND_DOUX);
    doc.setLineWidth(0.2);
    doc.line(MARGE + 7, y + 24.5, L - MARGE - 7, y + 24.5);
    police(doc, 8, 'normal');
    encre(doc, PROFOND_TEXTE);
    const pas = (LARGEUR - 14) / d.echeances.length;
    d.echeances.forEach((e, i) => ecrire(doc, e, MARGE + 7 + i * pas, y + 28.4));
  }
  y += hPrix + 5;

  // --- les deux cartes -----------------------------------------------------
  const lDuo = (LARGEUR - 6) / 2;
  const hDuo = 22;
  carte(doc, MARGE, y, lDuo, hDuo, WASH2, FILET_AQUA);
  surtitre(doc, 'Votre bilan est déduit', MARGE + 5, y + 6);
  police(doc, 8.6, 'normal');
  encre(doc, TEXTE);
  paragraphe(doc, d.mentionBilanDeduit, MARGE + 5, y + 11, lDuo - 10, 3.8);

  carte(doc, MARGE + lDuo + 6, y, lDuo, hDuo, WASH);
  surtitre(doc, "Vous n'êtes pas seul" + (d.civilite === 'M.' ? '' : 'e'), MARGE + lDuo + 11, y + 6);
  police(doc, 8.6, 'normal');
  encre(doc, TEXTE);
  paragraphe(doc,
    'Plus de 10 000 personnes ont déjà été accompagnées dans nos centres. Presque toutes avaient déjà essayé autre chose avant.',
    MARGE + lDuo + 11, y + 11, lDuo - 10, 3.8);
  y += hDuo + 5;

  // --- la frise ------------------------------------------------------------
  surtitre(doc, 'Comment se déroulent vos quatre premières semaines', MARGE, y);
  y += 3;

  const SEMAINES = [
    ['Semaine 1', 'On relance. Première séance, mise en route de votre programme alimentaire, on lève les premiers freins.'],
    ['Semaine 2', 'On installe. Le rythme se met en place, premier point complet avec votre thérapeute.'],
    ['Semaine 3', "On tient. C'est là que l'élan du début retombe : le suivi et les Missions Déclic prennent le relais."],
    ['Semaine 4', 'On mesure. Nouvelle analyse de composition corporelle, pour voir ce qui a bougé à l’intérieur.'],
  ];
  const lEtape = (LARGEUR - 3 * 3) / 4;
  const hEtape = 26;
  SEMAINES.forEach(([titre, texte], i) => {
    const x = MARGE + i * (lEtape + 3);
    carte(doc, x, y, lEtape, hEtape);
    fond(doc, AQUA);
    doc.circle(x + 4.4, y + 4.8, 2.2, 'F');
    police(doc, 7.2, 'bold');
    encre(doc, BLANC);
    ecrire(doc, String(i + 1), x + 4.4, y + 5.8, { align: 'center' });
    police(doc, 8.2, 'bold');
    encre(doc, ENCRE);
    ecrire(doc, titre, x + 3, y + 11);
    police(doc, 6.6, 'normal');
    encre(doc, TEXTE);
    paragraphe(doc, texte, x + 3, y + 14.6, lEtape - 6, 2.8);
  });
  y += hEtape + 5;

  // --- l'appel ------------------------------------------------------------
  const hCta = 18;
  carte(doc, MARGE, y, LARGEUR, hCta, ROSE_WASH, FILET_ROSE);
  police(doc, 10, 'bold');
  encre(doc, ROSE_TEXTE);
  ecrire(doc, 'Une question, une hésitation ?', L / 2, y + 6, { align: 'center' });
  police(doc, 8.4, 'normal');
  encre(doc, ENCRE);
  const appel = doc.splitTextToSize(
    pourPdf('Reprenez contact avec votre thérapeute, ou passez directement au centre. Nous reverrons chaque point avec vous, sans engagement.'),
    LARGEUR - 24,
  ) as string[];
  appel.forEach((t, i) => doc.text(t, L / 2, y + 11 + i * 3.8, { align: 'center' }));

  police(doc, 7, 'normal');
  encre(doc, GRIS_DOUX);
  paragraphe(doc,
    `Document personnel établi le ${d.dateBilan} au centre de ${d.centre.nom}. Support d'accompagnement bien-être, sans visée thérapeutique.`,
    MARGE, y + hCta + 5, LARGEUR, 3.2);

  pied(doc, d, 4, d.pages);
}

/* ========================================================================= */

/**
 * La restitution complète.
 *
 * Quatre pages pour celle qui réfléchit encore, trois pour celle qui a
 * signé : la page du prix ne part qu'avec le devis.
 */
export function genererRestitutionPdf(d: DonneesRestitution): jsPDF {
  /*
    COMPRESSÉ. Les dégradés sont peints en bandes fines, ce qui fait
    quelques centaines de traits par page ; sans compression le flux de
    dessin pèse plus lourd que le logo. Le document part chez chaque
    cliente, Airtable le conserve, et il voyage par mail.
  */
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  page1(doc, d);
  doc.addPage();
  page2(doc, d);

  /*
    Deux pages seulement sur un point de suivi : aucune cure n'a été
    présentée ce jour-là, et une page intitulée « Votre programme » qui ne
    propose rien est une page qui ment. Son diagnostic, lui, vaut toujours.
  */
  if (d.pages >= 3) {
    doc.addPage();
    page3(doc, d);
  }

  if (d.pages >= 4) {
    doc.addPage();
    page4(doc, d);
  }

  return doc;
}

/** Le PDF en base64, prêt à être rangé en base puis déposé dans Airtable. */
export function restitutionEnBase64(d: DonneesRestitution): string {
  return genererRestitutionPdf(d).output('datauristring').split(',')[1];
}
