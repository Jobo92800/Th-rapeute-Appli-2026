/*
  Générateur du contrat de prestation signé.

  LE TEXTE NE SE RÉÉCRIT PAS. Le contenu est juridique — treize articles et
  les CGV, repris mot pour mot de l'ancienne application. La mise en page,
  elle, a été refaite : elle sortait en Helvetica noir sur blanc, sans logo
  ni hiérarchie, et ressemblait à la photocopie d'un formulaire. Tout ce qui
  a changé passe par `chartePdf` ; pas une phrase n'a bougé.
*/
import { jsPDF } from 'jspdf';
import type { ContractData } from '../domain/contrat';
import {
  BAS,
  ENCRE,
  ENCRE_DOUX,
  GRIS,
  HAUT,
  MARGE,
  TEAL_SOMBRE,
  TRAIT,
  caseACocher,
  couleur,
  encadre,
  enTete,
  etiquette,
  piedsDePage,
  police,
  titreDocument,
  titreSection,
} from './chartePdf';

// A4 dimensions in mm
const A4_W = 210;
const MARGIN = MARGE;
const CONTENT_W = A4_W - MARGIN * 2;
const LINE_H = 5.5;
const SMALL_LINE_H = 4.8;
// Bottom safety margin — content must not exceed this Y position
const PAGE_BOTTOM = BAS;

type PdfDoc = jsPDF;

/*
  L'en-tête est redessiné sur chaque page nouvelle : un contrat de sept
  pages dont seule la première porte le logo se lit comme un assemblage de
  feuilles dépareillées.
*/
let enTeteCourant = { titre: '', date: '' };

function setFont(doc: PdfDoc, size: number, style: 'normal' | 'bold' | 'italic' = 'normal') {
  doc.setFontSize(size);
  doc.setFont('helvetica', style);
}

function text(doc: PdfDoc, txt: string, x: number, y: number, opts?: { maxWidth?: number; align?: 'left' | 'center' | 'right' }) {
  doc.text(txt, x, y, opts as any);
}

function addPage(doc: PdfDoc): number {
  doc.addPage();
  enTete(doc, enTeteCourant.titre, enTeteCourant.date);
  return HAUT;
}

function ensureSpace(doc: PdfDoc, y: number, needed: number): number {
  if (y + needed > PAGE_BOTTOM) {
    return addPage(doc);
  }
  return y;
}

function checkboxRow(doc: PdfDoc, label: string, x: number, y: number, checked: boolean, sessions?: number): number {
  y = ensureSpace(doc, y, LINE_H + 2);
  caseACocher(doc, x, y, checked);
  setFont(doc, 9);
  couleur(doc, checked ? ENCRE : GRIS);
  const sessionStr = checked && sessions ? `${sessions}` : '...........';
  text(doc, `Nombre de séances ${sessionStr} : ${label}`, x + 5, y);
  return y + LINE_H;
}

function engagementCheckbox(doc: PdfDoc, label: string, x: number, y: number, checked = false): number {
  const lines = doc.splitTextToSize(label, CONTENT_W - 8);
  const blockH = lines.length * SMALL_LINE_H + 4;
  y = ensureSpace(doc, y, blockH);
  caseACocher(doc, x, y, checked);
  couleur(doc, ENCRE_DOUX);
  setFont(doc, 9);
  doc.text(lines, x + 5, y);
  return y + lines.length * SMALL_LINE_H + 2;
}

function sectionTitle(doc: PdfDoc, title: string, y: number): number {
  y = ensureSpace(doc, y, LINE_H + 12);
  return titreSection(doc, title, y + 2);
}

function paragraph(doc: PdfDoc, txt: string, y: number, lineH = LINE_H): number {
  setFont(doc, 9);
  couleur(doc, ENCRE_DOUX);
  const lines = doc.splitTextToSize(txt, CONTENT_W);
  const blockH = lines.length * lineH;
  y = ensureSpace(doc, y, blockH);
  doc.text(lines, MARGIN, y);
  return y + blockH + 2;
}

function bulletList(doc: PdfDoc, items: string[], y: number): number {
  setFont(doc, 9);
  couleur(doc, ENCRE_DOUX);
  for (const item of items) {
    const lines = doc.splitTextToSize(`• ${item}`, CONTENT_W - 4);
    const blockH = lines.length * LINE_H;
    y = ensureSpace(doc, y, blockH);
    doc.text(lines, MARGIN + 4, y);
    y += blockH;
  }
  return y + 2;
}

export async function generateSignedContractPdf(
  data: ContractData,
  signatureDataUrl: string,
  engagements?: boolean[]
): Promise<string> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  enTeteCourant = { titre: 'Contrat de prestation', date: data.signatureDate };
  enTete(doc, enTeteCourant.titre, enTeteCourant.date);

  let y = HAUT + 4;
  y = titreDocument(doc, 'Contrat de ', 'prestation de services', y);

  /*
    Les deux parties, chacune dans son encadré. Le texte est celui du
    contrat, au mot près ; seule la disposition change — quatre lignes
    perdues au fil du texte ne se distinguaient pas d'un paragraphe.
  */
  y += 2;
  setFont(doc, 9);
  couleur(doc, ENCRE_DOUX);
  doc.text('Entre les soussignés :', MARGIN, y);
  y += 4;

  encadre(doc, y, 22);
  etiquette(doc, 'Le Prestataire', MARGIN + 5, y + 6);
  setFont(doc, 8.5, 'normal');
  couleur(doc, ENCRE);
  doc.text(
    `MAbeautyplus Centre de Perte de poids, Minceur et Anti-âge, ${data.centerAddress}, ${data.centerPostalCode} ${data.centerCity.toUpperCase()}`,
    MARGIN + 5,
    y + 11,
    { maxWidth: CONTENT_W - 10 },
  );
  couleur(doc, GRIS);
  doc.text(
    `Société exploitante : SAS ${data.centerSocietyName}   ·   Siège social : ${data.siegeSocialAddress}, ${data.siegeSocialPostalCode} LE GRAU-DU-ROI`,
    MARGIN + 5,
    y + 18,
    { maxWidth: CONTENT_W - 10 },
  );
  y += 26;

  setFont(doc, 9);
  couleur(doc, ENCRE_DOUX);
  doc.text('Et :', MARGIN, y);
  y += 4;

  encadre(doc, y, 24);
  etiquette(doc, 'Le Client', MARGIN + 5, y + 6);
  setFont(doc, 10, 'bold');
  couleur(doc, ENCRE);
  doc.text(
    `${data.clientCivility ? data.clientCivility + ' ' : ''}${data.clientLastName} ${data.clientFirstName}`,
    MARGIN + 5,
    y + 12,
  );
  setFont(doc, 8.5, 'normal');
  couleur(doc, ENCRE_DOUX);
  doc.text(
    `${data.clientAddress}, ${data.clientPostalCode} ${data.clientCity}`,
    MARGIN + 5,
    y + 18.5,
  );
  doc.text(`${data.clientPhone}   ·   ${data.clientEmail}`, A4_W - MARGIN - 5, y + 18.5, {
    align: 'right',
  });
  y += 30;

  // Article 1
  y = sectionTitle(doc, 'Article 1 - Objet du contrat', y);
  y = paragraph(doc, 'Le présent contrat porte sur une cure comprenant la/les prestation(s) suivantes :', y, SMALL_LINE_H);
  for (const item of data.careItems) {
    y = checkboxRow(doc, item.label, MARGIN, y, item.checked, item.sessions);
  }
  // Les séances gagnées par parrainage figurent au contrat : la cliente doit
  // en avoir la trace écrite. Elles n'entrent dans aucun montant.
  if (data.offeredSessions > 0) {
    y = paragraph(
      doc,
      `À ces séances s'ajoutent ${data.offeredSessions} séance${data.offeredSessions > 1 ? 's' : ''} offerte${data.offeredSessions > 1 ? 's' : ''}${data.offeredLabel ? ` (${data.offeredLabel})` : ''} au titre du parrainage, sans supplément de prix.`,
      y,
      SMALL_LINE_H,
    );
  }
  y = paragraph(doc, 'Les modalités précises de la cure (fréquence, organisation, durée estimée) sont définies lors du bilan préalable.', y, SMALL_LINE_H);
  y += 2;

  // Article 2
  y = sectionTitle(doc, 'Article 2 – Nature de l\'obligation', y);
  y = paragraph(doc, 'Le Prestataire est tenu à une obligation de moyens. Il s\'engage à mettre en œuvre l\'ensemble des moyens nécessaires (techniques, humains et matériels) pour accompagner le Client dans son objectif. Le Client est informé que les résultats peuvent varier selon plusieurs facteurs personnels, notamment : hygiène de vie, alimentation, régularité, état de santé, métabolisme. Aucune garantie de résultat ne peut être apportée.', y, SMALL_LINE_H);
  y += 2;

  // Article 3
  y = sectionTitle(doc, 'Article 3 – Durée et validité', y);
  y = paragraph(doc, 'Le présent contrat prend effet à compter de sa signature. Les séances sont valables pendant une durée de 12 mois à compter de la première séance, sauf accord exceptionnel écrit entre les parties. Au-delà de ce délai, les séances non réalisées pourront être considérées comme expirées. Ce délai est justifié par la nature de la prestation et l\'organisation du planning du Prestataire. Toute demande de prolongation pour motif légitime pourra être étudiée au cas par cas.', y, SMALL_LINE_H);
  y += 2;

  // Article 4
  y = sectionTitle(doc, 'Article 4 – Conditions financières', y);
  y = paragraph(doc, 'Le montant total de la cure est dû à la signature du présent contrat et au plus tard à la première séance.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Ce montant correspond à un forfait global incluant notamment : la réservation des créneaux, l\'organisation du planning, la mobilisation des équipes, ainsi que l\'accompagnement personnalisé du Client. Cet accompagnement comprend également : les conseils individualisés, les recommandations en hygiène de vie, les supports et documents remis, ainsi que l\'accès au savoir-faire et aux méthodes propres au Prestataire. Ces éléments, délivrés dès le démarrage de la cure, constituent une part essentielle de la prestation.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Conformément à l\'article L221-18 du Code de la consommation, lorsque le contrat est soumis au droit de rétractation, le Client dispose d\'un délai légal de 14 jours à compter de la signature du contrat. Le Client est informé que la première séance pourra être programmée avant l\'expiration de ce délai. En confirmant ce rendez-vous, le Client reconnaît expressément demander l\'exécution anticipée de la prestation. Il est également informé qu\'en cas d\'exercice de son droit de rétractation après réalisation d\'une première séance, le montant correspondant aux prestations réalisées restera dû. Passé ce délais, le Client reconnaît être engagé sur l\'ensemble du forfait souscrit.', y, SMALL_LINE_H);
  y += 2;

  // Article 5
  y = sectionTitle(doc, 'Article 5 – Modalités de paiement', y);
  y = paragraph(doc, 'Moyens acceptés : chèques, espèces, carte bancaire, paiement fractionné via organisme partenaire (sous réserve d\'acceptation).', y, SMALL_LINE_H);
  y = paragraph(doc, 'L\'éventuel acompte versé lors de la signature du présent contrat correspond à la réservation anticipée du ou des créneaux de séance programmés pour le Client, ainsi qu\'au temps consacré à l\'organisation administrative du dossier, à la planification du programme personnalisé et à la mobilisation des ressources nécessaires à l\'exécution de la prestation. Ces créneaux étant réservés spécifiquement pour le Client et rendus indisponibles pour d\'autres réservations, l\'acompte sera déduit du montant total du forfait.', y, SMALL_LINE_H);
  y = paragraph(doc, 'En cas d\'annulation imputable au Client après expiration du délai légal de rétractation, l\'acompte restera acquis au Prestataire au titre des frais de réservation, d\'organisation et de planification engagés.', y, SMALL_LINE_H);

  y = paragraph(doc, 'Le Client reconnaît que le présent contrat correspond à un forfait global incluant notamment l\'organisation du programme, la réservation des créneaux, l\'accompagnement personnalisé, les conseils et le savoir-faire du Prestataire. Les éventuelles échéances mises en place constituent uniquement une facilité de paiement accordée par le Prestataire et ne remettent pas en cause l\'engagement du Client sur l\'ensemble du forfait souscrit.', y, SMALL_LINE_H);
  y = paragraph(doc, 'En cas de règlement en plusieurs échéances directement auprès du Prestataire, les modalités de paiement acceptées sont déterminées au moment de la signature du présent contrat. Le Prestataire se réserve le droit de refuser certains moyens de paiement pour les règlements fractionnés.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Les échéances deviennent dues selon les modalités convenues entre les parties.', y, SMALL_LINE_H);
  y = paragraph(doc, 'En cas :', y, SMALL_LINE_H);
  y = bulletList(doc, ["d'impayé,", 'de rejet bancaire,', "d'opposition abusive,", "ou d'incident de paiement,"], y);
  y = paragraph(doc, 'le Prestataire pourra :', y, SMALL_LINE_H);
  y = bulletList(doc, ['suspendre immédiatement les prestations en cours,', 'exiger le règlement immédiat des sommes restant dues,', 'engager toute démarche utile de recouvrement.'], y);
  y = paragraph(doc, 'Les éventuels frais bancaires liés à un incident de paiement pourront être répercutés au Client.', y, SMALL_LINE_H);
  y += 4;

  // Payment schedule box — estimate height first
  const installmentLines = (data.deposit ? 1 : 0) + data.installments.length;
  const boxEstH = 9 + LINE_H + 1 + installmentLines * LINE_H + 6;
  y = ensureSpace(doc, y, boxEstH);

  doc.setDrawColor(200, 200, 200);
  /*
    Le montant et son échéancier : le seul bloc du contrat qu'on relit
    six mois plus tard pour savoir ce qu'on doit. Il mérite d'être trouvé
    d'un coup d'œil, d'où le fond teal pâle et le montant en gros.
  */
  const lignesReglement = data.installments.length + (data.deposit ? 1 : 0);
  const hauteurBloc = 18 + lignesReglement * LINE_H + 4;
  y = ensureSpace(doc, y, hauteurBloc + 4);
  const boxStartY = y;
  encadre(doc, y, hauteurBloc);

  etiquette(doc, 'Montant total TTC', MARGIN + 5, y + 6.5);
  police(doc, 15, 'bold');
  couleur(doc, TEAL_SOMBRE);
  doc.text(data.totalAmount, MARGIN + 5, y + 14);

  police(doc, 8, 'normal');
  couleur(doc, GRIS);
  doc.text(
    `Règlement établi en ${data.installmentCount} échéance${data.installmentCount > 1 ? 's' : ''}`,
    A4_W - MARGIN - 5,
    y + 8,
    { align: 'right' },
  );

  y = boxStartY + 20;
  const ligneReglement = (libelle: string, montant: string, date: string, moyen: string) => {
    setFont(doc, 8.5);
    couleur(doc, ENCRE_DOUX);
    doc.text(libelle, MARGIN + 6, y);
    setFont(doc, 9, 'bold');
    couleur(doc, ENCRE);
    doc.text(montant, MARGIN + 46, y, { align: 'right' });
    setFont(doc, 8.5);
    couleur(doc, ENCRE_DOUX);
    doc.text(`le ${date}`, MARGIN + 54, y);
    couleur(doc, GRIS);
    doc.text(moyen, A4_W - MARGIN - 6, y, { align: 'right' });
    y += LINE_H;
  };

  if (data.deposit) {
    ligneReglement('Acompte', data.deposit.amount, data.deposit.date, data.deposit.method);
  }
  data.installments.forEach((inst, i) => {
    ligneReglement(`Échéance ${i + 1}`, inst.amount, inst.date, inst.method);
  });

  y = boxStartY + hauteurBloc + 6;

  // Article 6
  y = sectionTitle(doc, 'Article 6 – Paiement fractionné via un organisme partenaire', y);
  y = paragraph(doc, 'En cas de paiement fractionné via un organisme de paiement partenaire :', y, SMALL_LINE_H);
  y = bulletList(doc, [
    'Le Prestataire est considéré comme payé intégralement à la validation du financement.',
    'La relation financière est gérée directement entre le Client et l\'organisme de financement.',
    'Toute difficulté de paiement doit être traitée avec cet organisme.',
  ], y);
  y = paragraph(doc, 'La résiliation du présent contrat n\'entraîne pas automatiquement celle du contrat de financement souscrit auprès de l\'organisme partenaire.', y, SMALL_LINE_H);
  y += 2;

  // Article 7
  y = sectionTitle(doc, 'Article 7 – Réservation & annulation', y);
  y = paragraph(doc, 'Toute séance doit être préalablement réservée. L\'annulation d\'une séance doit être communiquée au moins 24 heures à l\'avance. À défaut d\'annulation dans les délais ou en cas de non-présentation, la séance sera décomptée du forfait et considérée comme due, sauf cas de force majeure dûment justifié (article 1218 du Code civil).', y, SMALL_LINE_H);
  y += 2;

  // Article 8
  y = sectionTitle(doc, 'Article 8 – Engagement et adhésion', y);
  y = paragraph(doc, 'La signature du présent contrat vaut engagement du Client pour le forfait de cure, constitué comme un ensemble global incluant l\'organisation, la planification et l\'accompagnement personnalisé.', y, SMALL_LINE_H);
  y += 2;

  // Article 9
  y = sectionTitle(doc, 'Article 9 – Obligations du client :', y);
  y = paragraph(doc, 'Le Client s\'engage à :', y, SMALL_LINE_H);
  y = bulletList(doc, [
    'respecter les horaires de rendez-vous. Un retard supérieur à 10 minutes pourra entraîner la reprogrammation de la séance.',
    'suivre les recommandations transmises,',
    'informer de tout changement d\'état de santé,',
    'adopter un comportement respectueux.',
  ], y);
  y = paragraph(doc, 'Tout comportement jugé inapproprié ou contraire aux présentes clauses peut entraîner une suspension immédiate des prestations. Les prestations déjà réalisées ainsi que les sommes encaissées restent acquises au titre des prestations engagées.', y, SMALL_LINE_H);

  // Article 10
  y = sectionTitle(doc, 'Article 10 – Responsabilité', y);
  y = paragraph(doc, 'Le Prestataire ne pourra être tenu responsable en cas :', y, SMALL_LINE_H);
  y = bulletList(doc, [
    'de non-respect des recommandations par le Client,',
    "d'omission d'informations relatives à son état de santé,",
    "ou de résultats ne correspondant pas aux attentes du Client.",
  ], y);
  y = paragraph(doc, 'Le Client reconnaît avoir été informé de la nature non médicale des prestations proposées.', y, SMALL_LINE_H);
  y += 2;

  // Article 11
  y = sectionTitle(doc, 'Article 11 – Résiliation anticipée', y);
  y = paragraph(doc, 'Le contrat engage le Client sur l\'ensemble du forfait, dans le cadre d\'une démarche volontaire et sérieuse. Le Client reconnaît que la réussite du programme repose sur son implication et sa régularité.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Toute demande de résiliation anticipée pour convenance personnelle pourra faire l\'objet d\'un refus ou entraîner l\'application des conditions financières prévues au présent contrat, sauf appréciation exceptionnelle du Prestataire.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Une résiliation anticipée pourra être étudiée uniquement en cas de motif légitime dûment justifié. En cas de résiliation anticipée sans motif légitime, le Client reste redevable des prestations réalisées ainsi que d\'une indemnité correspondant aux frais engagés et à l\'organisation du programme, dans une limite proportionnée au préjudice subi par le Prestataire.', y, SMALL_LINE_H);
  y = paragraph(doc, 'En cas de résiliation :', y, SMALL_LINE_H);
  y = bulletList(doc, [
    'les prestations réalisées et les éléments d\'accompagnement délivrés restent dus',
    'les sommes déjà encaissées correspondent aux prestations réalisées, aux éléments d\'accompagnement déjà délivrés ainsi qu\'aux frais engagés dans le cadre de l\'exécution du contrat',
    'les échéances non encore encaissées pourront être suspendues à compter de la date de résiliation',
  ], y);
  y = paragraph(doc, 'Le Prestataire se réserve le droit de résilier le contrat en cas de non-respect des engagements ou de non-paiement.', y, SMALL_LINE_H);
  y += 2;

  // Article 12
  y = sectionTitle(doc, 'Article 12 – Protection des données', y);
  y = paragraph(doc, 'Conformément au Règlement Général sur la Protection des Données (RGPD), les données personnelles sont utilisées exclusivement pour le suivi de la cure et ne sont en aucun cas cédées à des tiers. Le client peut exercer ses droits (accès, rectification, suppression) à tout moment par demande écrite à la direction.', y, SMALL_LINE_H);
  y += 2;

  // Article 13
  y = sectionTitle(doc, 'Article 13 – Médiation et litiges', y);
  y = paragraph(doc, 'En cas de litige, une solution amiable sera recherchée en priorité.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Conformément aux articles L.612-1 et suivants du Code de la consommation, le Client est informé qu\'il pourra recourir gratuitement à un médiateur de la consommation, dont les coordonnées seront communiquées dès l\'adhésion du Prestataire à un dispositif de médiation.', y, SMALL_LINE_H);
  y += 6;

  // Engagement checkboxes
  const engagementTexts = [
    'Le Client reconnaît avoir pris connaissance du présent contrat et des modalités financières du forfait souscrit.',
    'Le Client reconnaît avoir reçu toutes les informations nécessaires avant la signature du présent contrat et avoir pu poser l\'ensemble de ses questions.',
    'Le Client reconnaît avoir été informé de mon droit légal de rétractation de 14 jours conformément aux articles L221-18 et suivants du Code de la consommation.',
    'Le Client reconnaît avoir pris connaissance et accepté les Conditions Générales de Vente remises préalablement à la signature du présent contrat.',
  ];
  for (let i = 0; i < engagementTexts.length; i++) {
    y = engagementCheckbox(doc, engagementTexts[i], MARGIN, y, engagements?.[i] ?? false);
  }
  y += 6;

  // Signature section — needs ~50mm for all columns
  y = ensureSpace(doc, y, 50);
  const sigY = y;

  // Column 1: Fait en
  setFont(doc, 9, 'italic');
  doc.text('Fait en deux exemplaires', MARGIN, sigY);
  doc.text(`A : ${data.signatureCity}`, MARGIN, sigY + LINE_H);
  doc.text(`le : ${data.signatureDate}`, MARGIN, sigY + LINE_H * 2);

  // Column 2: Center info
  const col2X = MARGIN + 65;
  setFont(doc, 9, 'bold');
  doc.text('CENTRE MAbeautyplus', col2X, sigY);
  setFont(doc, 9);
  doc.text(`Centre : MAbeautyplus ${data.centerName}`, col2X, sigY + LINE_H);
  doc.text(`Société exploitante : SAS ${data.centerSocietyName}`, col2X, sigY + LINE_H * 2);
  doc.text(`SIREN : ${data.centerSiren}`, col2X, sigY + LINE_H * 3);
  doc.text(`Adresse : ${data.siegeSocialAddress}`, col2X, sigY + LINE_H * 4);
  doc.text(`Téléphone : ${data.centerPhone}`, col2X, sigY + LINE_H * 5);
  doc.text(`Email : ${data.centerEmail}`, col2X, sigY + LINE_H * 6);

  // Column 3: Signature
  const col3X = MARGIN + 130;
  setFont(doc, 9, 'italic');
  doc.text('Signature du Client,', col3X, sigY);
  doc.text('"Lu et approuvé"', col3X, sigY + LINE_H);
  setFont(doc, 9);

  const sigImgY = sigY + LINE_H * 2;
  const sigImgH = 30;
  try {
    doc.addImage(signatureDataUrl, 'PNG', col3X, sigImgY, CONTENT_W - 130, sigImgH);
  } catch {
    // signature image failed
  }

  doc.setDrawColor(TRAIT[0], TRAIT[1], TRAIT[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(col3X, sigImgY, CONTENT_W - 130, sigImgH, 2, 2, 'D');

  // ── PAGE CGV ─────────────────────────────────────────────────────────────────
  y = addPage(doc);

  // CGV Title
  y = titreDocument(doc, 'Conditions ', 'générales de vente', y + 4);
  setFont(doc, 8.5, 'italic');
  couleur(doc, GRIS);
  doc.text('MAbeautyplus — dernière mise à jour : Mai 2026', MARGIN, y);
  y += 8;

  setFont(doc, 9);
  couleur(doc, ENCRE_DOUX);

  // ARTICLE 1
  y = sectionTitle(doc, 'ARTICLE 1 – IDENTIFICATION DU PRESTATAIRE', y);
  y = paragraph(doc, 'Les présentes Conditions Générales de Vente sont proposées par MAbeautyplus.', y, SMALL_LINE_H);

  const cgvLines: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Société exploitante : ', value: data.cgvSocietyName, highlight: true },
    { label: 'Forme juridique : ', value: 'SAS, société par actions simplifiée' },
    { label: 'Capital social : ', value: '1 000 €' },
    { label: 'Siège social : ', value: '577 rue des Tamaris 30240 le Grau-Du-Roi' },
    { label: 'RCS : ', value: '853 874 428 R.C.S. Nimes' },
    { label: 'SIREN : ', value: data.cgvSiren, highlight: true },
    { label: 'Téléphone : ', value: '04 66 73 02 00' },
    { label: 'E-mail : ', value: 'contact.mabeautyplus@gmail.com' },
    { label: 'Site internet : ', value: 'www.mabeautyplus.fr' },
  ];

  for (const line of cgvLines) {
    y = ensureSpace(doc, y, SMALL_LINE_H);
    setFont(doc, 9);
    doc.setTextColor(26, 26, 26);
    const labelW = doc.getTextWidth(line.label);
    doc.text(line.label, MARGIN, y);
    if (line.highlight) {
      doc.setTextColor(180, 60, 60);
    }
    doc.text(line.value, MARGIN + labelW, y);
    doc.setTextColor(26, 26, 26);
    y += SMALL_LINE_H;
  }

  y = paragraph(doc, 'Ci-après dénommé « le Prestataire ».', y, SMALL_LINE_H);
  y += 3;

  // ARTICLE 2
  y = sectionTitle(doc, 'ARTICLE 2 – OBJET', y);
  y = paragraph(doc, 'Les présentes Conditions Générales de Vente ont pour objet de définir les conditions de réservation, de vente et d\'exécution des prestations proposées par MAbeautyplus.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Les prestations proposées comprennent notamment :', y, SMALL_LINE_H);
  y = bulletList(doc, [
    'Luxothérapie',
    'Électrostimulation',
    'Pressothérapie',
    'Soins minceur',
    'Soins anti-âge',
    'Soins visage et corps',
    'Accompagnement personnalisé',
    'Conseils en hygiène de vie et rééquilibrage alimentaire',
  ], y);
  y = paragraph(doc, 'Les présentes CGV s\'appliquent à toute réservation, signature de contrat ou achat de prestation effectué auprès de MAbeautyplus.', y, SMALL_LINE_H);
  y += 3;

  // ARTICLE 3
  y = sectionTitle(doc, 'ARTICLE 3 – ACCEPTATION DES CONDITIONS GÉNÉRALES DE VENTE', y);
  y = paragraph(doc, 'Toute réservation, signature de contrat ou validation d\'une prestation implique l\'acceptation pleine et entière des présentes Conditions Générales de Vente.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Le Client reconnaît avoir pris connaissance des présentes CGV préalablement à son engagement.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Les CGV peuvent être consultées :', y, SMALL_LINE_H);
  y = bulletList(doc, [
    'sur le site internet du Prestataire,',
    'par envoi électronique,',
    'ou sur simple demande.',
  ], y);
  y += 3;

  // ARTICLE 4
  y = sectionTitle(doc, 'ARTICLE 4 – NATURE DES PRESTATIONS', y);
  y = paragraph(doc, 'Les prestations proposées par MAbeautyplus s\'inscrivent dans une démarche de bien-être, d\'accompagnement esthétique et d\'hygiène de vie.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Les prestations proposées ne constituent en aucun cas des actes médicaux, paramédicaux ou thérapeutiques au sens du Code de la santé publique.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Le Prestataire est tenu à une obligation de moyens.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Le Prestataire s\'engage à mettre en œuvre l\'ensemble des moyens techniques, humains et matériels raisonnablement nécessaires à l\'accompagnement du Client.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Le Client reconnaît que les résultats peuvent varier selon différents facteurs personnels, notamment :', y, SMALL_LINE_H);
  y = bulletList(doc, [
    'le métabolisme,',
    'l\'alimentation,',
    'l\'hygiène de vie,',
    'la régularité dans le programme,',
    'l\'activité physique,',
    'le sommeil,',
    'le niveau de stress,',
    'ou l\'état de santé général.',
  ], y);
  y = paragraph(doc, 'Aucune garantie de résultat ne peut être donnée.', y, SMALL_LINE_H);
  y += 3;

  // ARTICLE 5
  y = sectionTitle(doc, 'ARTICLE 5 – TARIFS ET PAIEMENT', y);
  y = paragraph(doc, 'Les tarifs des prestations sont ceux en vigueur au moment de la réservation ou de la signature du contrat.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Le paiement peut être effectué par : chèque, espèces, carte bancaire, ou via un organisme de paiement fractionné partenaire (sous réserve d\'acceptation).', y, SMALL_LINE_H);
  y = paragraph(doc, 'En cas de paiement fractionné via un organisme partenaire, le Prestataire est considéré comme intégralement réglé dès la validation du financement. La relation financière est ensuite gérée directement entre le Client et l\'organisme concerné.', y, SMALL_LINE_H);
  y += 3;

  // ARTICLE 6
  y = sectionTitle(doc, 'ARTICLE 6 – DROIT DE RÉTRACTATION', y);
  y = paragraph(doc, 'Conformément aux articles L221-18 et suivants du Code de la consommation, le Client dispose d\'un droit de rétractation de 14 jours calendaires à compter de la signature du contrat.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Pour exercer ce droit, le Client doit notifier sa décision par écrit (courrier ou e-mail) avant l\'expiration du délai.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Si le Client a expressément demandé l\'exécution de la prestation avant l\'expiration du délai de rétractation et que des séances ont déjà été réalisées, le montant correspondant aux prestations effectuées restera dû au Prestataire.', y, SMALL_LINE_H);
  y += 3;

  // ARTICLE 7
  y = sectionTitle(doc, 'ARTICLE 7 – RÉSERVATION ET ANNULATION', y);
  y = paragraph(doc, 'Toute séance doit être préalablement réservée. Toute annulation doit être communiquée au moins 24 heures à l\'avance.', y, SMALL_LINE_H);
  y = paragraph(doc, 'En cas de non-présentation ou d\'annulation tardive, la séance sera décomptée du forfait, sauf cas de force majeure justifié.', y, SMALL_LINE_H);
  y += 3;

  // ARTICLE 8
  y = sectionTitle(doc, 'ARTICLE 8 – RESPONSABILITÉ', y);
  y = paragraph(doc, 'Le Prestataire ne pourra être tenu responsable en cas de non-respect des recommandations, d\'omission d\'informations relatives à l\'état de santé du Client, ou de résultats ne correspondant pas aux attentes du Client.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Le Client déclare être en bonne santé et ne pas présenter de contre-indication médicale aux prestations souscrites. En cas de doute, le Client est invité à consulter un professionnel de santé avant de débuter le programme.', y, SMALL_LINE_H);
  y += 3;

  // ARTICLE 9
  y = sectionTitle(doc, 'ARTICLE 9 – DONNÉES PERSONNELLES', y);
  y = paragraph(doc, 'Les données personnelles collectées sont utilisées exclusivement dans le cadre de l\'exécution des prestations et de la gestion de la relation client. Elles ne sont en aucun cas transmises à des tiers.', y, SMALL_LINE_H);
  y = paragraph(doc, 'Conformément au RGPD, le Client dispose d\'un droit d\'accès, de rectification et de suppression de ses données, exerçable par demande écrite à la direction.', y, SMALL_LINE_H);
  y += 3;

  // ARTICLE 10
  y = sectionTitle(doc, 'ARTICLE 10 – MÉDIATION ET LITIGES', y);
  y = paragraph(doc, 'En cas de litige, le Client peut recourir à un médiateur de la consommation conformément aux articles L.612-1 et suivants du Code de la consommation.', y, SMALL_LINE_H);
  y = paragraph(doc, 'À défaut de résolution amiable, tout litige sera soumis aux tribunaux compétents du ressort du siège social du Prestataire.', y, SMALL_LINE_H);

  /*
    Le pied de page numérote déjà : l'ancienne pagination centrée en bas
    faisait doublon, on la retire.
  */
  piedsDePage(
    doc,
    `MAbeautyplus ${data.centerName} · ${data.centerAddress}, ${data.centerPostalCode} ${data.centerCity} · ${data.centerPhone}`,
  );

  return doc.output('datauristring').split(',')[1];
}
