/*
  La couleur de chaque soin.

  La liste des séances réalisées mélange les quatre soins d'une cure, et
  c'est voulu : elle raconte les venues dans l'ordre, pas les soins un par
  un. Mais en noir sur blanc, quatre libellés qui commencent tous par
  « Luxothérapie » ou « Presso » se lisent ligne à ligne — il faut lire pour
  distinguer, au lieu de voir.

  D'où une couleur par soin, portée par le nom du soin et par un filet à
  gauche de la ligne. Le décompte reste en haut : ces couleurs ne comptent
  rien, elles séparent.

  LE CHOIX DES TEINTES. Elles ne doivent pas se confondre avec celles qui
  disent un état ailleurs dans l'application : le vert d'un règlement
  encaissé, le rouge d'un retard, l'ambre d'une mise en garde. Le teal de la
  charte revient au soin principal — la Luxothérapie Perte de poids est le
  cœur de la méthode, elle a droit à la couleur maison. Les autres prennent
  des teintes voisines assez distantes pour se séparer d'un coup d'œil, y
  compris pour un œil qui distingue mal le rouge du vert : violet, ambre et
  bleu ciel ne se ressemblent sur aucun type de vision.
*/

import type { Technologie } from './tarification';

export interface CouleurSoin {
  /** Le nom du soin, dans sa teinte. */
  texte: string;
  /** Le filet à gauche de la ligne. */
  bord: string;
  /** La pastille, quand la place manque pour le nom entier. */
  pastille: string;
}

export const COULEURS_SOIN: Record<Technologie, CouleurSoin> = {
  luxo: {
    texte: 'text-marine-700',
    bord: 'border-l-marine-500',
    pastille: 'bg-marine-100 text-marine-800',
  },
  relax: {
    texte: 'text-violet-700',
    bord: 'border-l-violet-500',
    pastille: 'bg-violet-100 text-violet-800',
  },
  ishape: {
    texte: 'text-amber-700',
    bord: 'border-l-amber-500',
    pastille: 'bg-amber-100 text-amber-800',
  },
  presso: {
    texte: 'text-sky-700',
    bord: 'border-l-sky-500',
    pastille: 'bg-sky-100 text-sky-800',
  },
  /* Le Dôme n'est plus prescrit : il reste lisible sur les cures passées. */
  dome: {
    texte: 'text-ardoise-600',
    bord: 'border-l-ardoise-400',
    pastille: 'bg-ardoise-100 text-ardoise-700',
  },
};

/** Teinte du soin, avec un repli neutre pour une valeur inconnue en base. */
export function couleurSoin(t: Technologie | string): CouleurSoin {
  return COULEURS_SOIN[t as Technologie] ?? COULEURS_SOIN.dome;
}
