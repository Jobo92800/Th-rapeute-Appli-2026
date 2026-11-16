/*
  LE CATALOGUE DES FOURNITURES.

  Ce qu'on achète pour faire tourner un centre, et où on l'achète. Chaque
  fourniture porte ses adresses par ordre de préférence : la première est
  celle qu'on achète, les suivantes servent le jour où elle est en rupture.

  POURQUOI ON NETTOIE LES LIENS. Un lien Amazon copié depuis le navigateur
  traîne le nom du produit, le rang dans les résultats, le mot-clé tapé et
  l'identifiant de session — deux cents caractères dont aucun ne sert, et
  qui rendent deux fois le même produit méconnaissable. On n'en garde que
  la référence, qui est l'identité du produit chez Amazon.

  CE N'EST PAS FORCÉMENT AMAZON. Une pharmacie, un grossiste, un
  fournisseur local : une adresse qu'on ne reconnaît pas est gardée telle
  quelle. On ne refuse rien, on ne réécrit que ce qu'on comprend.
*/

/* Les rayons sont définis une seule fois, avec la liste de courses. */
export type { CategorieDeFourniture } from './courses';
import type { CategorieDeFourniture } from './courses';

/** Une fourniture telle que l'éditeur de catalogue la voit. */
export interface FournitureDuCatalogue {
  id: string;
  nom: string;
  categorie: CategorieDeFourniture;
  unite: string;
  /** Où acheter, par ordre de préférence. */
  liens: string[];
  /** Les centres concernés. `null` = tous. */
  centres: string[] | null;
  actif: boolean;
  /** Combien de fois demandée, tous centres confondus, sur six mois. */
  demandes: number;
}

/* ------------------------------------------------------------------------ */
/* LES ADRESSES                                                              */
/* ------------------------------------------------------------------------ */

/**
 * La référence Amazon d'un produit — dix caractères, lettres et chiffres.
 * Elle apparaît sous plusieurs formes selon la page d'où le lien est copié.
 */
const FORMES_DE_REFERENCE = [
  /\/dp\/([a-z0-9]{10})(?:[/?#]|$)/i,
  /\/gp\/product\/([a-z0-9]{10})(?:[/?#]|$)/i,
  /\/gp\/aws\/d\/([a-z0-9]{10})(?:[/?#]|$)/i,
  /\/exec\/obidos\/asin\/([a-z0-9]{10})(?:[/?#]|$)/i,
  /\/o\/asin\/([a-z0-9]{10})(?:[/?#]|$)/i,
  /[?&]asin(?:\.\d+)?=([a-z0-9]{10})(?:[&#]|$)/i,
];

/** L'adresse, avec un protocole, prête pour `new URL`. Null si illisible. */
function adresseLisible(lien: string): URL | null {
  const propre = lien.trim();
  if (!propre) return null;
  try {
    return new URL(/^https?:\/\//i.test(propre) ? propre : `https://${propre}`);
  } catch {
    return null;
  }
}

/** Vrai pour amazon.fr, amazon.de, amzn.eu… et leurs sous-domaines. */
export function estUnLienAmazon(lien: string): boolean {
  const adresse = adresseLisible(lien);
  if (!adresse) return false;
  const hote = adresse.hostname.toLowerCase();
  return (
    /(^|\.)amazon\.[a-z]{2,}(\.[a-z]{2,})?$/.test(hote) ||
    /(^|\.)amzn\.[a-z]{2,}$/.test(hote)
  );
}

/**
 * La référence du produit, en majuscules. Null si l'adresse ne la porte
 * pas — c'est le cas des liens courts de l'application Amazon, qui ne la
 * révèlent qu'une fois suivis.
 */
export function referenceDuLien(lien: string): string | null {
  const adresse = adresseLisible(lien);
  if (!adresse || !estUnLienAmazon(lien)) return null;
  const chemin = `${adresse.pathname}${adresse.search}`;
  for (const forme of FORMES_DE_REFERENCE) {
    const trouve = chemin.match(forme);
    if (trouve) return trouve[1].toUpperCase();
  }
  return null;
}

/**
 * L'adresse réduite à l'essentiel. Un lien Amazon dont on reconnaît la
 * référence devient `https://www.amazon.fr/dp/RÉFÉRENCE`, en gardant le
 * pays d'origine. Tout le reste est rendu tel quel, simplement détouré.
 */
export function normaliserLeLien(lien: string): string {
  const propre = lien.trim();
  const reference = referenceDuLien(propre);
  if (!reference) return propre;

  const adresse = adresseLisible(propre);
  const hote = adresse?.hostname.toLowerCase() ?? '';
  const pays = hote.match(/amazon\.([a-z]{2,}(?:\.[a-z]{2,})?)$/);
  return `https://www.amazon.${pays ? pays[1] : 'fr'}/dp/${reference}`;
}

/**
 * Les adresses d'une fourniture, dans l'ordre donné : vides retirées,
 * liens Amazon réduits à leur référence, doublons écartés. Deux adresses
 * différentes qui pointent le même produit sont un doublon — c'est tout
 * l'intérêt de les réduire avant de comparer.
 */
export function nettoyerLesLiens(liens: readonly string[]): string[] {
  const gardes: string[] = [];
  const vues = new Set<string>();
  for (const brut of liens) {
    const lien = normaliserLeLien(brut ?? '');
    if (!lien) continue;
    const empreinte = referenceDuLien(lien) ?? lien.toLowerCase();
    if (vues.has(empreinte)) continue;
    vues.add(empreinte);
    gardes.push(lien);
  }
  return gardes;
}

/* ------------------------------------------------------------------------ */
/* CE QU'ON REFUSE D'ENREGISTRER                                             */
/* ------------------------------------------------------------------------ */

export interface BrouillonDeFourniture {
  nom: string;
  unite: string;
  liens: string[];
  /** `null` = tous les centres. */
  centres: string[] | null;
}

/**
 * Le message à montrer, ou null si la fourniture peut être enregistrée.
 * Chaque message dit ce qui manque et ce qu'il faut faire.
 */
export function refusDEnregistrement(brouillon: BrouillonDeFourniture): string | null {
  if (!brouillon.nom.trim()) {
    return "Donnez un nom à la fourniture : c'est ce que la thérapeute lira sur sa liste.";
  }
  if (brouillon.centres !== null && brouillon.centres.length === 0) {
    return 'Choisissez au moins un centre, ou laissez « tous les centres ».';
  }
  const illisible = brouillon.liens.find((l) => l.trim() !== '' && !adresseLisible(l));
  if (illisible) {
    return `« ${illisible.trim()} » n'est pas une adresse : collez le lien complet depuis la page du produit.`;
  }
  return null;
}

/**
 * Une fourniture sans adresse est une fourniture qu'il faudra acheter à la
 * main. Ce n'est pas une faute — c'est ce que le mail du dimanche signale.
 */
export function sansAdresse(f: { liens: string[] }): boolean {
  return f.liens.length === 0;
}
