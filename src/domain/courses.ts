/*
  LA LISTE DE COURSES D'UN CENTRE.

  Ce qui fait tourner un centre — papier, produit d'entretien, mouchoirs,
  thé. Les thérapeutes cochent au fil de la semaine, la direction valide,
  et c'est elle qui achète.

  La clôture ne se saisit pas : une liste appartient à une semaine, et la
  semaine passée elle est close. Rien à cliquer le dimanche soir, rien à
  rattraper si personne ne l'a fait.
*/

export type CategorieDeFourniture =
  | 'hygiene'
  | 'entretien'
  /* Les consommables des appareils : crèmes, gels. */
  | 'soin'
  | 'accueil'
  | 'bureau'
  | 'autre';

export interface Fourniture {
  id: string;
  nom: string;
  categorie: CategorieDeFourniture;
  unite: string;
  /** Où acheter, par ordre de préférence. Vide = à acheter à la main. */
  liens: string[];
  /** Combien on en veut cette semaine. Zéro = pas cochée. */
  quantite: number;
  demandee_par: string | null;
  /** Combien de fois ce centre l'a demandée ces six derniers mois. */
  habitude: number;
}

/* L'ordre des rayons : on commence par ce qui manque le plus vite. */
export const CATEGORIES: Array<{ id: CategorieDeFourniture; libelle: string }> = [
  { id: 'hygiene', libelle: 'Hygiène' },
  { id: 'entretien', libelle: 'Entretien' },
  { id: 'soin', libelle: 'Soins' },
  { id: 'accueil', libelle: 'Accueil' },
  { id: 'bureau', libelle: 'Bureau' },
  { id: 'autre', libelle: 'Autre' },
];

/** Le lundi de la semaine d'une date, en ISO. C'est l'identité d'une liste. */
export function lundiDeLaSemaine(quand: Date): string {
  const d = new Date(Date.UTC(quand.getFullYear(), quand.getMonth(), quand.getDate()));
  /* getUTCDay : 0 = dimanche. Le lundi est à 1, donc le dimanche recule de 6. */
  const recul = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - recul);
  return d.toISOString().slice(0, 10);
}

/**
 * Une liste se modifie tant que sa semaine est celle d'aujourd'hui et que
 * la direction ne l'a pas validée. Après, elle est close — on ne retouche
 * pas une liste qu'on est en train d'acheter.
 */
export function listeModifiable(semaine: string, valideeLe: string | null, aujourdhui: Date): boolean {
  if (valideeLe) return false;
  return semaine === lundiDeLaSemaine(aujourdhui);
}

/** Les rayons, dans l'ordre, vides compris : un rayon qui disparaît se cherche. */
export function rangerParCategorie(
  catalogue: Fourniture[],
): Array<{ id: CategorieDeFourniture; libelle: string; fournitures: Fourniture[] }> {
  return CATEGORIES.map((c) => ({
    ...c,
    fournitures: catalogue.filter((f) => f.categorie === c.id),
  })).filter((c) => c.fournitures.length > 0);
}

/** Ce qui est coché, c'est ce qu'on achète. */
export function cochees(catalogue: Fourniture[]): Fourniture[] {
  return catalogue.filter((f) => f.quantite > 0);
}

/**
 * Les habituelles : demandées au moins trois fois en six mois. En dessous,
 * c'est un achat de circonstance, pas une habitude du centre.
 */
export const SEUIL_D_HABITUDE = 3;

export function estHabituelle(f: Fourniture): boolean {
  return f.habitude >= SEUIL_D_HABITUDE;
}

/** Les plus demandées d'abord, puis l'ordre du catalogue. */
export function parHabitude(a: Fourniture, b: Fourniture): number {
  return b.habitude - a.habitude;
}
