/*
  Générateur des consentements signés.

  Repris tel quel de l'ancienne application : les textes sont juridiques,
  ils ne doivent pas être réécrits. La V2 n'en utilise que trois
  (Luxothérapie PDP, I-Shape, Pressodynamie) ; les autres restent
  disponibles si un soin revenait à l'offre.
*/
import jsPDF from 'jspdf';

const A4_W = 210;
const MARGIN = 18;
const CONTENT_W = A4_W - MARGIN * 2;
const LINE_H = 5.5;
const SMALL_LINE_H = 4.8;

type Doc = jsPDF;

function setFont(doc: Doc, size: number, style: 'normal' | 'bold' | 'italic' = 'normal') {
  doc.setFontSize(size);
  doc.setFont('helvetica', style);
}

function txt(doc: Doc, s: string, x: number, y: number, opts?: { maxWidth?: number; align?: 'left' | 'center' | 'right' }) {
  doc.text(s, x, y, opts as any);
}

function para(doc: Doc, s: string, y: number, lineH = LINE_H): number {
  setFont(doc, 9);
  doc.setTextColor(26, 26, 26);
  const lines = doc.splitTextToSize(s, CONTENT_W);
  doc.text(lines, MARGIN, y, { align: 'justify', maxWidth: CONTENT_W });
  return y + lines.length * lineH + 2;
}

function bullets(doc: Doc, items: string[], y: number): number {
  setFont(doc, 9);
  doc.setTextColor(26, 26, 26);
  for (const item of items) {
    const lines = doc.splitTextToSize(`• ${item}`, CONTENT_W - 4);
    doc.text(lines, MARGIN + 4, y);
    y += lines.length * SMALL_LINE_H + 0.5;
  }
  return y + 1;
}

function title(doc: Doc, s: string, y: number): number {
  setFont(doc, 20, 'normal');
  doc.setTextColor(180, 180, 180);
  txt(doc, s, MARGIN, y);
  return y + 12;
}

function sectionTitle(doc: Doc, s: string, y: number): number {
  setFont(doc, 9.5, 'bold');
  doc.setTextColor(26, 26, 26);
  doc.text(s, MARGIN, y);
  return y + LINE_H;
}

function footer(_doc: Doc) {
  // footer vide — plus de logo ni de numérotation
}

function header(doc: Doc, titleText: string, clientName: string, date: string): number {
  let y = MARGIN;
  y = title(doc, titleText, y + 6);

  setFont(doc, 9, 'normal');
  doc.setTextColor(26, 26, 26);
  txt(doc, 'Consentement entre l\'institut : ', MARGIN, y);
  setFont(doc, 9, 'bold');
  txt(doc, 'MAbeautyplus', MARGIN + 55, y);
  y += LINE_H;

  setFont(doc, 9, 'bold');
  txt(doc, 'Date : ', MARGIN, y);
  setFont(doc, 9, 'normal');
  txt(doc, date, MARGIN + 14, y);
  y += LINE_H;

  setFont(doc, 9, 'normal');
  txt(doc, 'Et le/la client(e) :', MARGIN, y);
  y += LINE_H;

  txt(doc, 'Je soussigné(e) : ', MARGIN, y);
  setFont(doc, 9, 'bold');
  txt(doc, clientName, MARGIN + 35, y);
  y += LINE_H + 3;

  return y;
}

function imageRightSection(doc: Doc, label: string, photoText: string[], photoChecked: boolean[], signatureDataUrl: string, y: number): number {
  const boxY = y + 2;

  setFont(doc, 9, 'bold');
  doc.setTextColor(26, 26, 26);
  txt(doc, 'Droit à l\'image :', MARGIN, boxY);
  let dy = boxY + LINE_H;
  setFont(doc, 9, 'normal');
  for (let i = 0; i < photoText.length; i++) {
    const checked = photoChecked[i] ?? false;
    doc.setDrawColor(80, 80, 80);
    doc.setFillColor(checked ? 30 : 255, checked ? 30 : 255, checked ? 30 : 255);
    doc.rect(MARGIN, dy - 3, 3.5, 3.5, checked ? 'FD' : 'D');
    if (checked) {
      doc.setTextColor(255, 255, 255);
      setFont(doc, 7, 'bold');
      doc.text('✓', MARGIN + 0.3, dy - 0.2);
      doc.setTextColor(26, 26, 26);
      setFont(doc, 9, 'normal');
    }
    const wrapped = doc.splitTextToSize(photoText[i], CONTENT_W - 8);
    doc.text(wrapped, MARGIN + 5, dy);
    dy += wrapped.length * SMALL_LINE_H + 1.5;
  }
  dy += 4;

  // Signature client uniquement (pleine largeur)
  const boxH = 36;

  doc.setDrawColor(180, 180, 180);
  doc.setFillColor(255, 255, 255);
  doc.rect(MARGIN, dy, CONTENT_W, boxH, 'D');
  setFont(doc, 8, 'italic');
  doc.setTextColor(120, 120, 120);
  txt(doc, label, MARGIN + 2, dy + 5);
  setFont(doc, 7, 'italic');
  txt(doc, 'avec la mention "lu et approuvé"', MARGIN + 2, dy + 9);

  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', MARGIN + 2, dy + 12, CONTENT_W - 4, 20);
    } catch {
      // silently skip
    }
  }

  return dy + boxH + 6;
}

interface ConsentContext {
  clientName: string;
  date: string;
  signatureDataUrl: string;
  photoChecked: boolean[];
}

// ─── MÉSOJET CORPS ────────────────────────────────────────────────────────────
export function generateMesojetCorpsConsent(ctx: ConsentContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = header(doc, 'Consentement mutuel - Mésojet Corps', ctx.clientName, ctx.date);

  y = para(doc,
    'Certifie avoir été informé(e) concernant les soins par Radiofréquence et Hydroporation (Mésojet) auxquels je vais me soumettre dans le but d\'un traitement d\'amincissement et de raffermissement cutané. La radiofréquence, basée sur l\'émission d\'ondes radio à haute fréquence induisant une action thermique permet un raffermissement et un lissage de la peau.',
    y);

  y = para(doc,
    'Il est recommandé de réaliser une cure de base de 5 ou 10 séances afin de garantir les meilleurs résultats. Le nombre de séances est défini en fonction du métabolisme, de la morphologie, de la zone à traiter, du stade de relâchement du tissus et du type de peau. Une séance d\'entretien une fois par mois est recommandée pour maintenir les résultats du soin sur le long terme.',
    y);

  y = para(doc,
    'Comme pour toute technique minceur, une bonne hygiène de vie et une activité physique quotidienne sont vivement recommandées afin d\'optimiser les résultats.\nPour une réussite optimale de la cure, je m\'engage à respecter les recommandations et conseils des thérapeutes, ainsi qu\'à respecter le rythme des rendez-vous fixés pour les séances.',
    y);

  y = para(doc,
    'Je suis informé(e) que parfois les résultats sont inférieurs à ceux attendus et cela ne me donne droit à la possibilité d\'être remboursé(e) du montant crédité.',
    y) + 2;

  y = sectionTitle(doc, 'Contre-indications à la RADIOFREQUENCE :', y);
  y = bullets(doc, [
    'Maladies/problèmes de peau : enflammée, rougie (coup de soleil), plaie ouverte, écorchures, éruption cutanée, herpès, cicatrices chéloïdes, troubles circulatoires',
    'Peau excessivement sensible, sèche ou délicate, eczema, desquamation, psoriasis',
    'Traitement cutané/cosmétique à l\'alcool (antiseptique, parfum, fixateur de maquillage...) au rétinol ou acide glycolique de moins de 24h',
    'Cancer de la peau, radiothérapie en cours',
    'Rasage, épilation sur la zone de moins de 24h',
    'Tatouage de moins de 2 semaines',
    'Maladies générales : épilepsie, problèmes cardiaques et dispositif médical actif (pacemaker, pompe à insuline...), problèmes sanguins (coagulation, hémorragies, varices, fragilités capillaires...)',
    'Prothèses, métal, stérilet en cuivre ou implant sur la zone de traitement',
    'Myopathies',
  ], y);

  y = sectionTitle(doc, 'Contre-indications à l\'HYDROPORATION :', y);
  y = bullets(doc, [
    'Grossesse',
    'Infections et/ou lésion sur la zone',
    'Phlébite sévère ou récidivante',
    'AVC',
    'Hypertension sévère',
    'Allergie éventuelle connue à un produit de diffusion',
  ], y);

  y = para(doc, 'Selon les cas, un certificat médical écrit pourra être demandé par le centre de soins.', y) + 2;

  y = sectionTitle(doc, 'Conseils indispensables pour préparer le soin :', y);
  y = bullets(doc, [
    'Ne pas réaliser de peeling dans les 7 jours avant et après un soin Mésojet',
    'Ne pas utiliser de cosmétiques abrasifs, gommages, exfoliants avant un soin',
    'Ne pas appliquer un produit à base d\'alcool (parfum, fixateur de maquillage) sur la peau avant un soin',
    'Ne raser ou épiler la zone traitée juste avant et après un soin par radiofréquence',
    'Ne pas s\'exposer au soleil avant (coup de soleil) et après le soin',
    'Appliquer un SPF 50 ou 50+ les jours qui suivent un soin',
  ], y);

  imageRightSection(doc,
    'Signature, nom et prénom du/de la client(e)',
    [
      'J\'autorise la prise de photographies avant/après et leur utilisation interne, une fois anonymisées, à des fins de présentation par les thérapeutes du centre MAbeautyplus.',
      'J\'autorise la diffusion de ces photographies sur les réseaux sociaux du centre MAbeautyplus.',
    ],
    ctx.photoChecked, ctx.signatureDataUrl, y);

  footer(doc);
  return doc.output('datauristring').split(',')[1];
}

// ─── MÉSOJET VISAGE ───────────────────────────────────────────────────────────
export function generateMesojetVisageConsent(ctx: ConsentContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = header(doc, 'Consentement mutuel - Mésojet Visage', ctx.clientName, ctx.date);

  y = para(doc,
    'Certifie avoir été informé(e) concernant le(s) soin(s) par Hydroporation et/ou Radiofréquence (Mésojet) auxquels je vais me soumettre dans le but d\'un traitement du visage. L\'hydroporation est une technique de revitalisation 100% naturelle qui permet de traiter la peau en surface et en profondeur afin corriger problématiques cutanées sur le visage, le cou et le décolleté. La radiofréquence permet la stimulation de la sécrétion de collagène, un raffermissement et un lissage de la peau.',
    y);

  y = para(doc,
    'Il est recommandé de réaliser une cure de base en traitement d\'une problématique, puis une séance d\'entretien une fois par mois pour maintenir les résultats du soin sur le long terme.',
    y);

  y = para(doc,
    'Comme pour tout soin du visage, une bonne hygiène de vie et un entretien quotidien de la peau sont vivement recommandés afin d\'optimiser les résultats.\nPour une réussite optimale de la cure, je m\'engage à respecter les recommandations et conseils des thérapeutes, ainsi qu\'à respecter le rythme des rendez-vous fixés pour les séances.',
    y);

  y = para(doc,
    'Je suis informé(e) que parfois les résultats sont inférieurs à ceux attendus et cela ne me donne droit à la possibilité d\'être remboursé(e) du montant crédité.',
    y) + 2;

  y = sectionTitle(doc, 'Contre-indications à la RADIOFREQUENCE :', y);
  y = bullets(doc, [
    'Maladies/problèmes de peau : enflammée, rougie (coup de soleil), plaie ouverte, écorchures, éruption cutanée, herpès, cicatrices chéloïdes, troubles circulatoires',
    'Peau excessivement sensible, sèche ou délicate, eczema, desquamation, psoriasis',
    'Traitement cutané/cosmétique à l\'alcool (antiseptique, parfum, fixateur de maquillage...) au rétinol ou acide glycolique de moins de 24h',
    'Cancer de la peau, radiothérapie en cours',
    'Rasage, épilation sur la zone de moins de 24h',
    'Tatouage de moins de 2 semaines',
    'Maladies générales : épilepsie, problèmes cardiaques et dispositif médical actif (pacemaker, pompe à insuline...), problèmes sanguins (coagulation, hémorragies, varices, fragilités capillaires...)',
    'Prothèses, métal, stérilet en cuivre ou implant sur la zone de traitement',
    'Myopathies',
  ], y);

  y = sectionTitle(doc, 'Contre-indications à l\'HYDROPORATION :', y);
  y = bullets(doc, [
    'Grossesse',
    'Infections et/ou lésion sur la zone',
    'Phlébite sévère ou récidivante',
    'AVC',
    'Hypertension sévère',
    'Allergie éventuelle connue à un produit de diffusion',
  ], y);

  y = para(doc, 'Selon les cas, un certificat médical écrit pourra être demandé par le centre de soins.', y) + 2;

  y = sectionTitle(doc, 'Conseils indispensables pour préparer le soin :', y);
  y = bullets(doc, [
    'Ne pas réaliser de peeling dans les 7 jours avant et après un soin Mésojet',
    'Ne pas utiliser de cosmétiques abrasifs, gommages, exfoliants avant un soin',
    'Ne pas appliquer un produit à base d\'alcool (parfum, fixateur de maquillage) sur la peau avant un soin',
    'Ne raser ou épiler la zone traitée juste avant et après un soin par radiofréquence',
    'Ne pas s\'exposer au soleil avant (coup de soleil) et après le soin',
    'Appliquer un SPF 50 ou 50+ les jours qui suivent un soin',
    'Retirer ses lentilles de contact avant le soin',
    'Respecter un délais d\'un mois après une injection d\'acide hyaluronique ou de Botox',
  ], y);

  imageRightSection(doc,
    'Signature, nom et prénom du/de la client(e)',
    [
      'J\'autorise la prise de photographies avant/après et leur utilisation interne, une fois anonymisées, à des fins de présentation par les thérapeutes du centre MAbeautyplus.',
      'J\'autorise la diffusion de ces photographies sur les réseaux sociaux du centre MAbeautyplus.',
    ],
    ctx.photoChecked, ctx.signatureDataUrl, y);

  footer(doc);
  return doc.output('datauristring').split(',')[1];
}

// ─── PRESSODYNAMIE ────────────────────────────────────────────────────────────
export function generatePressoConsent(ctx: ConsentContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = header(doc, 'Consentement mutuel - Pressodynamie', ctx.clientName, ctx.date);

  y = para(doc,
    'Certifie avoir été informé(e) concernant les soins par Pressodynamie (PSX Esthetique®) auxquels je vais me soumettre dans le but d\'un traitement du corps et des jambes.',
    y);

  y = para(doc,
    'La pressothérapie effectue une action mécanique par pression qui améliore le drainage lymphatique, l\'élimination des toxines, l\'aspect de la peau, la cellulite, la rétention d\'eau et la circulation sanguine. Elle diminue l\'effet de jambes lourdes et agit sur les tissus musculaires. La pressodynamie est vivement recommandée en complément d\'une cure minceur afin d\'éliminer les graisses déstockées par la lipolyse.',
    y);

  y = para(doc,
    'Une bonne hygiène de vie et une activité physique quotidienne sont recommandées afin d\'optimiser les résultats. Pour une réussite optimale de la cure, je m\'engage à respecter les recommandations et conseils des thérapeutes, ainsi qu\'à respecter le rythme des rendez-vous fixés pour les séances.\nJe suis informé(e) que parfois les résultats sont inférieurs à ceux attendus et cela ne me donne droit à la possibilité d\'être remboursé(e) du montant crédité.',
    y) + 2;

  y = sectionTitle(doc, 'Les contre-indications à la Pressodynamie :', y);
  y = para(doc, 'Il est interdit d\'effectuer les séances de pressothérapie en cas de :', y);
  y = bullets(doc, [
    'Œdèmes lymphatique sévère',
    'Varices œdémateuses',
    'Fragilité capillaire, hémophilie, artériopathie sévère stade 3 et 4 (dépôt de cholestérol)',
    'Thromboses veineuses profondes ou phlébite non traitée (caillot sanguin)',
    'Etat inflammatoire local ou général',
    'Infection de la peau, plaie, dermatose ou problème cutané',
    'Tumeur maligne',
    'Diabète sucré (sang sirupeux), insuffisance rénale',
    'Insuffisance cardiaque non traitée, Pacemaker',
    'Vagotomie (section du nerf vague)',
    'Prothèse récente',
    'Femme enceinte',
    'Pour le traitement du ventre : hernies abdominales, inflammations chroniques du tube digestif',
  ], y);

  y = para(doc, 'Selon les cas, un certificat médical écrit pourra être demandé par le centre de soins.', y) + 2;

  imageRightSection(doc,
    'Signature, nom et prénom du/de la client(e)',
    [
      'J\'autorise la prise de photographies avant/après et leur utilisation interne, une fois anonymisées, à des fins de présentation par les thérapeutes du centre MAbeautyplus.',
      'J\'autorise la diffusion de ces photographies sur les réseaux sociaux du centre MAbeautyplus.',
    ],
    ctx.photoChecked, ctx.signatureDataUrl, y);

  footer(doc);
  return doc.output('datauristring').split(',')[1];
}

// ─── I-SHAPE (ÉLECTROSTIMULATION) ─────────────────────────────────────────────
export function generateIShapeConsent(ctx: ConsentContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = header(doc, 'Consentement mutuel - Electrostimulation', ctx.clientName, ctx.date);

  y = para(doc,
    'Certifie avoir été informé(e) concernant les séances d\'Electrostimulation (I-Shape®, certifié CE et IECEE) auxquels je vais me soumettre dans le but d\'un traitement de tonification, minceur et/ou raffermissement. L\'électrostimulation reproduit le message chimique demandé par le cerveau et envoie un signal nerveux au muscle en permettant sa contraction. La stimulation est simplifiée et amplifiée, pour une contraction plus efficace et en profondeur. 20 minutes d\'électrostimulation équivalent à 4h de sport.',
    y);

  y = para(doc,
    'Il est recommandé de réaliser une cure de base de 12 à 40 séances, 1 à 2 fois/semaine, renouvelable afin de garantir les meilleurs résultats. Le nombre de séances est défini en fonction de l\'objectif physique, du métabolisme, de la morphologie et du bilan d\'analyse de composition corporelle.\nComme pour toute méthode de minceur, une bonne hygiène de vie, une alimentation équilibrée et une activité physique quotidienne sont vivement recommandées afin d\'optimiser les résultats.',
    y);

  y = para(doc,
    'Pour une réussite optimale de la cure, je m\'engage à respecter les recommandations et conseils des thérapeutes ainsi qu\'à respecter le rythme des rendez-vous fixés pour les séances.\nJe suis informé(e) que parfois les résultats sont inférieurs à ceux attendus et cela ne me donne droit à la possibilité d\'être remboursé(e) du montant crédité.',
    y) + 2;

  y = sectionTitle(doc, 'Les contre-indications à l\'utilisation :', y);
  y = para(doc, 'Il est interdit d\'effectuer les séances d\'électrostimulation en cas de :', y);
  y = bullets(doc, [
    'Pacemaker ou dispositif médical actif',
    'Maladie ou anomalie cardiaque (arythmie, tachycardie, fragilité cardiaque...)',
    'Epilepsie',
    'Présence ou antécédant d\'hernie abdominale ou inguinale (aine), éventration',
    'Phlébites (obstruction d\'une veine par un caillot), thrombose (caillot)',
    'Tumeur ou cancer',
    'Troubles circulatoires graves, hémophilie',
    'Blessure non cicatrisée ou affection cutanée (eczéma, brûlure, irritation...) sur la zone de traitement',
    'Maladie du foie, diabète sucré (sang sirupeux)',
    'Maladie neurologique grave',
    'Enfants, adolescents, femme enceinte',
  ], y);

  y = para(doc, 'Selon les cas, un certificat médical écrit pourra être demandé par le centre de soins.', y) + 2;

  imageRightSection(doc,
    'Signature, nom et prénom du/de la client(e)',
    [
      'J\'autorise la prise de photographies avant/après et leur utilisation interne, une fois anonymisées, à des fins de présentation par les thérapeutes du centre MAbeautyplus.',
      'J\'autorise la diffusion de ces photographies sur les réseaux sociaux du centre MAbeautyplus.',
    ],
    ctx.photoChecked, ctx.signatureDataUrl, y);

  footer(doc);
  return doc.output('datauristring').split(',')[1];
}

// ─── LUXO MÉNOPAUSE ───────────────────────────────────────────────────────────
export function generateLuxoMenopauseConsent(ctx: ConsentContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = header(doc, 'Consentement mutuel - Ménopause', ctx.clientName, ctx.date);

  y = para(doc,
    'Certifie avoir été informée concernant les séances de Luxothérapie par Rayonnements infrarouges (Luxoscreen®, certifié CE dispositif médical) auxquels je vais me soumettre dans le but d\'un traitement des inconforts liés à la ménopause. La luxothérapie stimule les points réflexes du corps et permet de rétablir l\'équilibre fonctionnel des organes et des systèmes hormonal, digestif et lymphatique. Elle aide ainsi à diminuer les bouffées de chaleur, la fatigue, réguler l\'humeur, la rétention d\'eau, la transpiration excessive, les troubles du sommeil et autres problématiques.',
    y);

  y = para(doc, 'Il est recommandé de réaliser une cure de base de 10 séances, réparties comme tel :', y);
  y = bullets(doc, [
    '2 séances la première semaine',
    '1 séance par semaine pendant 5 semaines',
    '1 séance par mois pendant 3 mois',
  ], y);
  y = para(doc, 'afin de garantir les meilleurs résultats.', y);

  y = para(doc,
    'Je suis informée que parfois les résultats sont inférieurs à ceux attendus et cela ne me donne droit à la possibilité d\'être remboursée du montant crédité.',
    y) + 2;

  y = sectionTitle(doc, 'Les contre-indications à l\'utilisation :', y);
  y = para(doc, 'Il est interdit d\'effectuer les séances de luxothérapie en cas de :', y);
  y = bullets(doc, [
    'Troubles épileptiques',
    'Maladie grave (nécessitant une prise en charge hospitalière ou de la convalescence)',
    'Pathologie infectieuse ou bactérienne',
    'Pathologie cancéreuse active ou non stabilisée',
    'Femme enceinte',
  ], y);

  y = para(doc, 'Selon les cas, un certificat médical écrit pourra être demandé par le centre de soins.', y) + 2;

  imageRightSection(doc,
    'Signature, nom et prénom du/de la client(e)',
    [],
    [], ctx.signatureDataUrl, y);

  footer(doc);
  return doc.output('datauristring').split(',')[1];
}

// ─── LUXO RELAXATION ──────────────────────────────────────────────────────────
export function generateLuxoRelaxConsent(ctx: ConsentContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = header(doc, 'Consentement mutuel - Relaxation', ctx.clientName, ctx.date);

  y = para(doc,
    'Certifie avoir été informé(e) concernant les séances de Luxothérapie par Rayonnements infrarouges (Luxoscreen®, certifié CE dispositif médical) auxquels je vais me soumettre dans le but d\'un traitement de relaxation et gestion du stress. La luxothérapie stimule les points réflexes du corps et permet de rétablir l\'équilibre fonctionnel des organes, des systèmes hormonal, digestif et lymphatique.',
    y);

  y = para(doc, 'Il est recommandé de réaliser une cure de base de 10 séances, réparties comme tel :', y);
  y = bullets(doc, [
    '2 séances la première semaine',
    '1 séance par semaine pendant 5 semaines',
    '1 séance par mois pendant 3 mois',
  ], y);
  y = para(doc, 'afin de garantir les meilleurs résultats.', y);

  y = para(doc,
    'Je suis informé(e) que parfois les résultats sont inférieurs à ceux attendus et cela ne me donne droit à la possibilité d\'être remboursé(e) du montant crédité.',
    y) + 2;

  y = sectionTitle(doc, 'Les contre-indications à l\'utilisation :', y);
  y = para(doc, 'Il est interdit d\'effectuer les séances de luxothérapie en cas de :', y);
  y = bullets(doc, [
    'Troubles épileptiques',
    'Maladie grave (nécessitant une prise en charge hospitalière ou de la convalescence)',
    'Pathologie infectieuse ou bactérienne',
    'Pathologie cancéreuse active ou non stabilisée',
    'Femme enceinte',
  ], y);

  y = para(doc, 'Selon les cas, un certificat médical écrit pourra être demandé par le centre de soins.', y) + 2;

  imageRightSection(doc,
    'Signature, nom et prénom du/de la client(e)',
    [],
    [], ctx.signatureDataUrl, y);

  footer(doc);
  return doc.output('datauristring').split(',')[1];
}

// ─── LUXO PERTE DE POIDS ──────────────────────────────────────────────────────
export function generateLuxoPdpConsent(ctx: ConsentContext): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = header(doc, 'Consentement mutuel - Perte de poids', ctx.clientName, ctx.date);

  y = para(doc,
    'Certifie avoir été informé(e) concernant les séances de Luxothérapie par Rayonnements infrarouges (Luxoscreen®, certifié CE dispositif médical) auxquels je vais me soumettre dans le but d\'un traitement de perte de poids. La luxothérapie stimule les points réflexes du corps et permet de rétablir l\'équilibre fonctionnel des organes, des systèmes hormonal, digestif et lymphatique, de réguler les sensations alimentaires (appétit excessif, compulsions, fringales, envies de sucre ou de gras...), ainsi que d\'améliorer la qualité du sommeil et la gestion du stress.',
    y);

  y = para(doc,
    'Il est recommandé de réaliser une cure de base de 12 à 20 séances, 2 séances la 1ère semaine, puis 1 séance/semaine afin de garantir les meilleurs résultats. Le nombre de séances est défini en fonction de l\'objectif de poids, du métabolisme, de la morphologie et du bilan d\'analyse de composition corporelle.',
    y);

  y = para(doc,
    'Comme pour toute méthode de perte de poids, une bonne hygiène de vie et une activité physique quotidienne sont vivement recommandées afin d\'optimiser les résultats.\nPour une réussite optimale de la cure, je m\'engage à respecter les recommandations et conseils des thérapeutes, à suivre le protocole de rééquilibrage alimentaire ainsi qu\'à respecter le rythme des rendez-vous fixés pour les séances.',
    y);

  y = para(doc,
    'Je suis informé(e) que parfois les résultats sont inférieurs à ceux attendus et cela ne me donne droit à la possibilité d\'être remboursé(e) du montant crédité.',
    y) + 2;

  y = sectionTitle(doc, 'Les contre-indications à l\'utilisation :', y);
  y = para(doc, 'Il est interdit d\'effectuer les séances de luxothérapie en cas de :', y);
  y = bullets(doc, [
    'Troubles épileptiques',
    'Maladie grave (nécessitant une prise en charge hospitalière ou de la convalescence)',
    'Pathologie infectieuse ou bactérienne',
    'Pathologie cancéreuse active ou non stabilisée',
    'Femme enceinte',
  ], y);

  y = para(doc, 'Selon les cas, un certificat médical écrit pourra être demandé par le centre de soins.', y) + 2;

  imageRightSection(doc,
    'Signature, nom et prénom du/de la client(e)',
    [
      'J\'autorise la prise de photographies avant/après et leur utilisation interne, une fois anonymisées, à des fins de présentation par les thérapeutes du centre MAbeautyplus.',
      'J\'autorise la diffusion de ces photographies sur les réseaux sociaux du centre MAbeautyplus.',
    ],
    ctx.photoChecked, ctx.signatureDataUrl, y);

  footer(doc);
  return doc.output('datauristring').split(',')[1];
}

// ─── DISPATCHER ───────────────────────────────────────────────────────────────

const CONSENT_GENERATORS: Record<string, (ctx: ConsentContext) => string> = {
  'meso-corps':   generateMesojetCorpsConsent,
  'adipologie':   generateMesojetCorpsConsent,
  'cavitalyse':   generateMesojetCorpsConsent,
  'meso-visage':  generateMesojetVisageConsent,
  'advance-lift': generateMesojetVisageConsent,
  'presso':       generatePressoConsent,
  'ishape':       generateIShapeConsent,
  'luxo-meno':    generateLuxoMenopauseConsent,
  'luxo-relax':   generateLuxoRelaxConsent,
  'luxo-pdp':     generateLuxoPdpConsent,
};

const CONSENT_FILENAMES: Record<string, string> = {
  'meso-corps':   'Consentement_Mesojet_Corps',
  'adipologie':   'Consentement_Mesojet_Corps',
  'cavitalyse':   'Consentement_Mesojet_Corps',
  'meso-visage':  'Consentement_Mesojet_Visage',
  'advance-lift': 'Consentement_Mesojet_Visage',
  'presso':       'Consentement_Pressodynamie',
  'ishape':       'Consentement_IShape',
  'luxo-meno':    'Consentement_Luxo_Menopause',
  'luxo-relax':   'Consentement_Luxo_Relaxation',
  'luxo-pdp':     'Consentement_Luxo_PDP',
};

export interface GeneratedConsent {
  serviceId: string;
  filename: string;
  pdfBase64: string;
}

function sanitizeFilename(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function generateSignedConsents(
  activeServiceIds: string[],
  clientFirstName: string,
  clientLastName: string,
  signatureDataUrl: string,
  date: string,
  photoChecked: boolean[] = [],
): GeneratedConsent[] {
  const clientName = `${clientFirstName} ${clientLastName}`;
  const ctx: ConsentContext = { clientName, date, signatureDataUrl, photoChecked };

  const seen = new Set<string>();
  const results: GeneratedConsent[] = [];

  for (const serviceId of activeServiceIds) {
    const generator = CONSENT_GENERATORS[serviceId];
    const filename = CONSENT_FILENAMES[serviceId];
    if (!generator || !filename) continue;
    if (seen.has(filename)) continue;
    seen.add(filename);

    const pdfBase64 = generator(ctx);
    const safe = `${filename}_${sanitizeFilename(clientLastName)}_${sanitizeFilename(clientFirstName)}.pdf`;
    results.push({ serviceId, filename: safe, pdfBase64 });
  }

  return results;
}
