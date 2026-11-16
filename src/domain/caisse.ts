/*
  LA CAISSE — ce qui est réellement entré, sur une période, dans un centre.

  Un ticket Z n'est pas un chiffre d'affaires : c'est un arrêté de caisse.
  Il range l'argent par moyen de règlement, parce que c'est ainsi qu'on fait
  la banque, et il le date du jour où il est entré, jamais du jour où il
  était dû.

  Deux particularités du métier vivent ici :

    — une cure Alma est encaissée EN ENTIER le jour de la signature. Ses
      douze échéances portent la même date de règlement, et les afficher
      une par une noierait le ticket : elles se regroupent en une seule
      entrée au nom de la cliente.

    — les échéances Alma portent ce que règle la cliente, frais du crédit
      compris. Ces frais vont à l'organisme, pas au centre. On les déduit
      pour donner le net — et seulement de la part passée par Alma : un
      acompte réglé en carte sur une cure financée n'a supporté aucun frais.
*/

import { arrondir } from './tarification.ts';

export type MoyenDeReglement = 'cheque' | 'especes' | 'cb' | 'virement' | 'alma';

/** Une échéance pointée payée, telle que la base la rend. */
export interface LigneDeReglement {
  centre_id: string;
  cliente: string;
  cliente_id: string;
  date_reglement: string;
  moyen: MoyenDeReglement | null;
  type: string;
  rang: number;
  montant: number;
  programme_id: string;
  montant_cure: number;
  frais: number;
  mode_reglement: string | null;
  nb_echeances: number;
  montant_alma: number;
}

/** Une entrée de caisse : ce qu'on lit sur le ticket, une ligne par règlement. */
export interface EntreeDeCaisse {
  cliente: string;
  date: string;
  moyen: MoyenDeReglement | null;
  /** Ce qui est entré, frais du crédit compris. */
  montant: number;
  /** La part qui repart à l'organisme de crédit. Zéro hors Alma. */
  frais: number;
  /** Combien d'échéances ce regroupement rassemble. */
  echeances: number;
  rang: number;
  nbEcheances: number;
  montantCure: number;
  modeReglement: string | null;
}

export const LIBELLES_MOYEN: Record<MoyenDeReglement, string> = {
  cheque: 'Chèque',
  especes: 'Espèces',
  cb: 'Carte bancaire',
  virement: 'Virement',
  alma: 'Alma',
};

/** Le nom à afficher pour un moyen, y compris quand personne ne l'a renseigné. */
export function libelleDuMoyen(moyen: MoyenDeReglement | null): string {
  return moyen ? LIBELLES_MOYEN[moyen] : 'Moyen non renseigné';
}

/*
  L'ordre du ticket : l'argent qui dort en caisse d'abord, le crédit
  ensuite, et ce qu'on n'a pas su nommer tout à la fin — c'est celui-là
  qu'on vient corriger.
*/
const ORDRE_DES_MOYENS: Array<MoyenDeReglement | null> = [
  'especes',
  'cheque',
  'cb',
  'virement',
  'alma',
  null,
];

export function parOrdreDesMoyens(
  a: MoyenDeReglement | null,
  b: MoyenDeReglement | null,
): number {
  return ORDRE_DES_MOYENS.indexOf(a) - ORDRE_DES_MOYENS.indexOf(b);
}

/**
 * Les frais du crédit à imputer à la part d'une cure vue dans la période.
 *
 * Toute la cure est passée : les frais entiers. Une partie seulement : au
 * prorata de ce qui est passé. Rien par Alma : rien.
 */
export function fraisImputables(
  montantAlmaVu: number,
  montantAlmaTotal: number,
  fraisDeLaCure: number,
): number {
  if (fraisDeLaCure <= 0 || montantAlmaTotal <= 0 || montantAlmaVu <= 0) return 0;
  if (montantAlmaVu >= montantAlmaTotal) return arrondir(fraisDeLaCure);
  return arrondir((fraisDeLaCure * montantAlmaVu) / montantAlmaTotal);
}

/*
  Le regroupement. Les échéances Alma d'une même cure réglées le même jour
  ne font qu'une entrée ; tout le reste reste ligne à ligne, parce que
  chaque règlement est un geste distinct au comptoir.
*/
export function regrouperLesReglements(lignes: LigneDeReglement[]): EntreeDeCaisse[] {
  const groupes = new Map<string, EntreeDeCaisse & { almaVu: number; almaTotal: number; fraisCure: number }>();
  const entrees: EntreeDeCaisse[] = [];

  for (const l of lignes) {
    if (l.moyen !== 'alma') {
      entrees.push({
        cliente: l.cliente,
        date: l.date_reglement,
        moyen: l.moyen,
        montant: l.montant,
        frais: 0,
        echeances: 1,
        rang: l.rang,
        nbEcheances: l.nb_echeances,
        montantCure: l.montant_cure,
        modeReglement: l.mode_reglement,
      });
      continue;
    }

    const cle = `${l.programme_id}|${l.date_reglement}`;
    const deja = groupes.get(cle);
    if (deja) {
      deja.montant += l.montant;
      deja.almaVu += l.montant;
      deja.echeances += 1;
      continue;
    }

    const neuve = {
      cliente: l.cliente,
      date: l.date_reglement,
      moyen: l.moyen,
      montant: l.montant,
      frais: 0,
      echeances: 1,
      rang: l.rang,
      nbEcheances: l.nb_echeances,
      montantCure: l.montant_cure,
      modeReglement: l.mode_reglement,
      almaVu: l.montant,
      almaTotal: l.montant_alma,
      fraisCure: l.frais,
    };
    groupes.set(cle, neuve);
    entrees.push(neuve);
  }

  /*
    L'arrondi n'arrive qu'ici. Arrondir chaque addition ferait dériver le
    total d'un centime par échéance : sur une cure en douze fois, le ticket
    ne retomberait plus sur le relevé bancaire.
  */
  for (const g of groupes.values()) {
    g.frais = fraisImputables(g.almaVu, g.almaTotal, g.fraisCure);
    g.montant = arrondir(g.montant);
  }

  return entrees;
}

export interface TotalParMoyen {
  moyen: MoyenDeReglement | null;
  nb: number;
  montant: number;
}

/** Ce qu'on additionne au moment de faire la banque. */
export function totauxParMoyen(entrees: EntreeDeCaisse[]): TotalParMoyen[] {
  const par = new Map<string, TotalParMoyen>();

  for (const e of entrees) {
    const cle = e.moyen ?? '';
    const deja = par.get(cle);
    if (deja) {
      deja.nb += 1;
      deja.montant += e.montant;
    } else {
      par.set(cle, { moyen: e.moyen, nb: 1, montant: e.montant });
    }
  }

  return [...par.values()]
    .map((t) => ({ ...t, montant: arrondir(t.montant) }))
    .sort((a, b) => parOrdreDesMoyens(a.moyen, b.moyen));
}

export interface ArreteDeCaisse {
  encaisse: number;
  frais: number;
  net: number;
}

/** L'arrêté : ce qui est entré, ce qui repart, ce qui reste au centre. */
export function arreterLaCaisse(entrees: EntreeDeCaisse[]): ArreteDeCaisse {
  const encaisse = arrondir(entrees.reduce((t, e) => t + e.montant, 0));
  const frais = arrondir(entrees.reduce((t, e) => t + e.frais, 0));
  return { encaisse, frais, net: arrondir(encaisse - frais) };
}
