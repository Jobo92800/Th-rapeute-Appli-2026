/*
  La couleur de chaque soin.

  La liste des séances réalisées mélangeait les quatre soins d'une cure ;
  depuis le 15 septembre 2026 elle fait un bloc par soin, et la couleur
  reste utile : en tête de bloc, sur le filet des lignes, et sur les
  boutons de démarrage, où quatre libellés qui commencent tous par
  « Luxothérapie » ou « Presso » se lisent ligne à ligne — il faut lire
  pour distinguer, au lieu de voir.

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

/**
 * Le Dôme ne se tient qu'au Grau-du-Roi. Il n'est jamais prescrit par un
 * bilan : la thérapeute l'ajoute à la main, sous « Modifier », à 59 € la
 * séance comme les autres. Ailleurs, il n'apparaît nulle part.
 */
/**
 * Les soins où l'on choisit un programme sur l'appareil, et où la séance
 * le note à part du commentaire : la suivante doit savoir lequel pour
 * reprendre là où l'autre s'est arrêtée.
 */
export const SOINS_AVEC_PROGRAMME: readonly Technologie[] = ['ishape', 'presso'];

export function aUnProgrammeAppareil(t: Technologie): boolean {
  return SOINS_AVEC_PROGRAMME.includes(t);
}

export const CENTRES_AVEC_DOME = ['grau-du-roi'];

export function domeDisponible(centreId: string | null | undefined): boolean {
  return Boolean(centreId) && CENTRES_AVEC_DOME.includes(centreId!);
}

export interface CouleurSoin {
  /** Le nom du soin, dans sa teinte. */
  texte: string;
  /** Le filet à gauche de la ligne. */
  bord: string;
  /** La pastille, quand la place manque pour le nom entier. */
  pastille: string;
  /**
   * La carte entière du soin, dans l'onglet Séances : un fond pâle et un
   * cadre de sa teinte. Le filet et le nom coloré restaient trop discrets
   * pour séparer les blocs d'un coup d'œil (Jonathan, 15 septembre 2026).
   */
  carte: string;
  /** L'en-tête de cette carte, un ton plus soutenu que le fond. */
  entete: string;
  /** Un bouton de démarrage, dans la teinte du soin. */
  bouton: string;
}

export const COULEURS_SOIN: Record<Technologie, CouleurSoin> = {
  luxo: {
    texte: 'text-marine-700',
    bord: 'border-l-marine-500',
    pastille: 'bg-marine-100 text-marine-800',
    carte: 'border-marine-300 bg-marine-50',
    entete: 'border-marine-200 bg-marine-100',
    bouton: 'border-marine-300 bg-marine-50 hover:bg-marine-100',
  },
  relax: {
    texte: 'text-violet-700',
    bord: 'border-l-violet-500',
    pastille: 'bg-violet-100 text-violet-800',
    carte: 'border-violet-300 bg-violet-50',
    entete: 'border-violet-200 bg-violet-100',
    bouton: 'border-violet-300 bg-violet-50 hover:bg-violet-100',
  },
  ishape: {
    texte: 'text-amber-700',
    bord: 'border-l-amber-500',
    pastille: 'bg-amber-100 text-amber-800',
    carte: 'border-amber-300 bg-amber-50',
    entete: 'border-amber-200 bg-amber-100',
    bouton: 'border-amber-300 bg-amber-50 hover:bg-amber-100',
  },
  presso: {
    texte: 'text-sky-700',
    bord: 'border-l-sky-500',
    pastille: 'bg-sky-100 text-sky-800',
    carte: 'border-sky-300 bg-sky-50',
    entete: 'border-sky-200 bg-sky-100',
    bouton: 'border-sky-300 bg-sky-50 hover:bg-sky-100',
  },
  /*
    L'Advance Lift, le soin de l'anti-âge : rose, la teinte du terrain sur le
    BioPortrait. Il ne se mélange jamais aux soins de la perte de poids dans
    une même cure, mais une cliente peut avoir les deux sur sa fiche.
  */
  advance_lift: {
    texte: 'text-rose-700',
    bord: 'border-l-rose-500',
    pastille: 'bg-rose-100 text-rose-800',
    carte: 'border-rose-300 bg-rose-50',
    entete: 'border-rose-200 bg-rose-100',
    bouton: 'border-rose-300 bg-rose-50 hover:bg-rose-100',
  },
  /* Le Dôme n'est plus prescrit : il reste lisible sur les cures passées. */
  dome: {
    texte: 'text-ardoise-600',
    bord: 'border-l-ardoise-400',
    pastille: 'bg-ardoise-100 text-ardoise-700',
    carte: 'border-ardoise-300 bg-ardoise-50',
    entete: 'border-ardoise-200 bg-ardoise-100',
    bouton: 'border-ardoise-300 bg-ardoise-50 hover:bg-ardoise-100',
  },
};

/** Teinte du soin, avec un repli neutre pour une valeur inconnue en base. */
export function couleurSoin(t: Technologie | string): CouleurSoin {
  return COULEURS_SOIN[t as Technologie] ?? COULEURS_SOIN.dome;
}
