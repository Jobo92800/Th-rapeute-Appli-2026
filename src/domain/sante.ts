/*
  Le bilan santé de la fiche.

  Quatorze questions posées à la cliente, qui n'entrent dans aucun calcul :
  ni le BioPortrait, ni la prescription, ni le prix ne les regardent. Elles
  servent à la thérapeute, avant une séance, pour savoir à qui elle a affaire.

  Ce module ne connaît ni la base ni l'écran. Il dit quelles questions
  existent, dans quel ordre, et comment lire une réponse.
*/

/** Une question à laquelle on répond par oui ou par non. */
export interface QuestionOuiNon {
  cle: string;
  libelle: string;
  /** Ne se pose qu'aux femmes. */
  feminin?: true;
}

/** Une question à laquelle on répond en écrivant. */
export interface QuestionLibre {
  cle: string;
  libelle: string;
  exemple: string;
}

export const OUI_NON: QuestionOuiNon[] = [
  { cle: 'hypertension', libelle: 'Hypertension' },
  { cle: 'diabete', libelle: 'Diabète' },
  { cle: 'renale', libelle: 'Maladie rénale' },
  { cle: 'epilepsie', libelle: 'Troubles épileptiques' },
  { cle: 'enceinte', libelle: 'Enceinte', feminin: true },
  { cle: 'stress', libelle: 'Stress / anxiété' },
  { cle: 'retention', libelle: "Rétention d'eau" },
];

export const LIBRES: QuestionLibre[] = [
  { cle: 'thyroide', libelle: 'Problème de thyroïde', exemple: 'Hypothyroïdie, sous Levothyrox' },
  { cle: 'hormones', libelle: 'Hormones / ménopause', exemple: 'Ménopause depuis 2 ans' },
  { cle: 'transit', libelle: 'Troubles intestinaux / transit', exemple: 'Constipation chronique' },
  { cle: 'maladie', libelle: 'Maladie particulière', exemple: 'Fibromyalgie' },
  { cle: 'intolerance', libelle: 'Intolérance alimentaire', exemple: 'Lactose, gluten' },
  { cle: 'bariatrique', libelle: 'Chirurgie bariatrique récente', exemple: 'Sleeve en mars 2025' },
  { cle: 'medicaments', libelle: 'Médicament(s)', exemple: 'Anticoagulant' },
];

/**
 * Ce qu'on garde en base : chaque clé y est soit un oui/non, soit un texte.
 *
 * Une question sans réponse n'a pas de clé du tout — « non » et « on n'a pas
 * demandé » ne veulent pas dire la même chose, et c'est précisément le genre
 * de confusion qui fait passer une hypertension à la trappe.
 */
export type Sante = Record<string, boolean | string>;

export function reponseOuiNon(sante: Sante, cle: string): boolean | null {
  const v = sante[cle];
  return typeof v === 'boolean' ? v : null;
}

export function reponseLibre(sante: Sante, cle: string): string {
  const v = sante[cle];
  return typeof v === 'string' ? v : '';
}

/** Les questions à poser, selon la civilité. */
export function questionsOuiNon(estFeminin: boolean): QuestionOuiNon[] {
  return estFeminin ? OUI_NON : OUI_NON.filter((q) => !q.feminin);
}

/**
 * Ce qui mérite d'être vu tout de suite : les « oui », et les champs
 * remplis.
 *
 * Les « non » ne sont pas des informations, ce sont des absences
 * d'information. Les afficher noierait les trois lignes qui comptent.
 */
export function pointsDAttention(sante: Sante, estFeminin = true): string[] {
  const points: string[] = [];
  for (const q of questionsOuiNon(estFeminin)) {
    if (reponseOuiNon(sante, q.cle) === true) points.push(q.libelle);
  }
  for (const q of LIBRES) {
    const t = reponseLibre(sante, q.cle).trim();
    if (t) points.push(`${q.libelle} : ${t}`);
  }
  return points;
}

/** Vrai si la thérapeute a répondu à au moins une question. */
export function estRenseigne(sante: Sante): boolean {
  return Object.values(sante).some((v) => (typeof v === 'string' ? v.trim() !== '' : true));
}

/** Nettoie avant d'écrire : on ne garde ni les vides, ni les blancs. */
export function nettoyer(sante: Sante): Sante {
  const propre: Sante = {};
  for (const [cle, v] of Object.entries(sante)) {
    if (typeof v === 'boolean') propre[cle] = v;
    else if (v.trim() !== '') propre[cle] = v.trim();
  }
  return propre;
}
