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

  LE CHOIX DES TEINTES (Jonathan, 15 septembre 2026) : **bleu** pour la
  Luxothérapie Perte de poids, **bleu ciel** pour la Relaxation — les deux
  luxo se ressemblent, c'est voulu, l'une est la version soutenue de
  l'autre —, **ambre** pour l'I-Shape, **vert** pour la Pressodynamie,
  rose pour l'Advance Lift. La première palette gardait le teal de la
  charte pour la luxo et le violet pour la relaxation ; le teal se
  confondait avec l'interface, et le violet ne disait rien. Le vert de la
  presso est celui du drainage et de la circulation, pas celui d'un
  règlement encaissé : ils ne se rencontrent jamais sur le même écran.
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

/**
 * Les soins où la séance sépare CE QUE LA THÉRAPEUTE OBSERVE de CE QUE LA
 * CLIENTE RESSENT (Jonathan, 23 septembre 2026).
 *
 * Sur la radiofréquence, les deux ne se confondent pas : la thérapeute note
 * la chaleur supportée, les zones passées, la réaction de la peau ; la
 * cliente dit si ça a tiré, chauffé, si elle a vu quelque chose depuis la
 * dernière fois. Mélangées dans une seule case, la seconde disparaît —
 * c'est toujours la technique qu'on écrit en premier.
 */
export const SOINS_AVEC_RESSENTI: readonly Technologie[] = ['radiofrequence'];

export function aUnRessentiSepare(t: Technologie): boolean {
  return SOINS_AVEC_RESSENTI.includes(t);
}

/**
 * Les soins qui se clôturent sans pesée : les deux anti-âge. On ne monte
 * pas sur la balance pour un soin du visage.
 */
export function aUnePesee(t: Technologie): boolean {
  return t !== 'advance_lift' && t !== 'radiofrequence';
}

/**
 * La Mission Déclic n'accompagne que la Luxothérapie perte de poids
 * (Jonathan, 21 septembre 2026). C'est un exercice par venue pour ancrer
 * le changement d'habitudes, et c'est la luxo qui porte cet accompagnement :
 * sur l'I-Shape, la presso, la relaxation, le Dôme et l'Advance Lift, la
 * séance se clôture sur ses relevés et son commentaire, sans mission.
 * Jusque-là, seul l'Advance Lift en était dispensé.
 */
export function aUneMissionDeclic(t: Technologie): boolean {
  return t === 'luxo';
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
    texte: 'text-blue-700',
    bord: 'border-l-blue-500',
    pastille: 'bg-blue-100 text-blue-800',
    carte: 'border-blue-300 bg-blue-50',
    entete: 'border-blue-200 bg-blue-100',
    bouton: 'border-blue-300 bg-blue-50 hover:bg-blue-100',
  },
  relax: {
    texte: 'text-sky-700',
    bord: 'border-l-sky-500',
    pastille: 'bg-sky-100 text-sky-800',
    carte: 'border-sky-300 bg-sky-50',
    entete: 'border-sky-200 bg-sky-100',
    bouton: 'border-sky-300 bg-sky-50 hover:bg-sky-100',
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
    texte: 'text-emerald-700',
    bord: 'border-l-emerald-500',
    pastille: 'bg-emerald-100 text-emerald-800',
    carte: 'border-emerald-300 bg-emerald-50',
    entete: 'border-emerald-200 bg-emerald-100',
    bouton: 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100',
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
  /*
    La radiofréquence du Profil Signature, au Crès et à Sérignan : violet,
    la troisième couleur de la charte. Elle ne croise jamais l'Advance Lift
    dans un centre, mais le violet la distingue du rose des gestes qui
    engagent — une couleur de soin ne dit aucun état.
  */
  radiofrequence: {
    texte: 'text-violet-600',
    bord: 'border-l-violet-500',
    pastille: 'bg-violet-50 text-violet-600',
    carte: 'border-violet-200 bg-violet-50',
    entete: 'border-violet-200 bg-violet-50',
    bouton: 'border-violet-200 bg-violet-50 hover:bg-violet-100',
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
