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
import { CENTRE_ANTI_AGE } from './antiAge';
import { signatureDisponible } from './profilSignature';

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

/**
 * Le Psio ne se tient qu'à Sérignan (Jonathan, 16 octobre 2026). Comme le
 * Dôme, **aucun bilan ne le prescrit** : la thérapeute l'ajoute à la main,
 * au devis du BioPortrait sous « Modifier » ou sur le formulaire d'une cure
 * suivante. Ailleurs, il n'apparaît nulle part — proposer un soin qu'un
 * centre ne tient pas revient à le vendre.
 */
export const CENTRES_AVEC_PSIO = ['serignan'];

export function psioDisponible(centreId: string | null | undefined): boolean {
  return Boolean(centreId) && CENTRES_AVEC_PSIO.includes(centreId!);
}

/**
 * LES SOINS QUI SE VENDENT PAR FORMULES, et les formules qui existent.
 *
 * Le Psio a deux formules et pas une de plus — 6 séances à 351 €, 8 à 468 €
 * (Jonathan, 16 octobre 2026). Partout ailleurs le « − » et le « + »
 * bougent d'une séance ; ici ils passent d'une formule à l'autre, et rien
 * ne sort de la liste : sept séances de Psio n'existent pas, et afficher
 * 409,50 € serait annoncer un prix que personne n'a fixé.
 *
 * **Cette liste est écrite une seule fois.** Les deux écrans qui composent
 * une cure la lisent — le devis du bilan par les paliers de la prescription,
 * le formulaire d'une cure suivante par `ajusterSeancesDuSoin`. Recopiée,
 * elle aurait fini par différer d'un écran à l'autre, et la même cure
 * n'aurait pas eu le même prix selon le chemin pris.
 */
export const FORMULES_PAR_SOIN: Partial<Record<Technologie, readonly number[]>> = {
  psio: [6, 8],
};

/**
 * Une séance de plus ou de moins sur le formulaire de cure, **zéro
 * compris** — contrairement au devis du bilan, ici un soin absent vaut
 * zéro et c'est ainsi qu'on ne le vend pas.
 *
 * Sur un soin à formules, on passe de zéro à la première formule, puis
 * d'une formule à l'autre, et on redescend à zéro depuis la première.
 */
export function ajusterSeancesDuSoin(t: Technologie, actuelle: number, delta: number): number {
  const formules = FORMULES_PAR_SOIN[t];
  if (!formules) return Math.max(0, actuelle + delta);

  const echelle = [0, ...formules];
  const rang = echelle.indexOf(actuelle);
  /* Un nombre hors formule — une vieille ligne, une reprise — se recale. */
  const depart = rang >= 0 ? rang : echelle.findIndex((v) => v >= actuelle);
  const ici = depart >= 0 ? depart : echelle.length - 1;
  const vise = ici + (delta > 0 ? 1 : delta < 0 ? -1 : 0);
  return echelle[Math.min(echelle.length - 1, Math.max(0, vise))];
}

/**
 * Les soins qui demandent une venue à eux seuls.
 *
 * La durée d'une cure se compte en venues, pas en soins : trois soins qui
 * font revenir ajoutent un mois, et ce mois ouvre un chèque de plus. Or on
 * n'encaisse pas un règlement après la dernière séance — compter une venue
 * de trop, c'est promettre un chèque que la cure ne couvre plus.
 *
 * Trois soins s'enchaînent après un autre, dans le même rendez-vous, et ne
 * font donc pas revenir : la **Relaxation**, qui n'a jamais compté ; le
 * **Psio** ; et l'**hydroporation**, qui se fait dans la foulée de la
 * radiofréquence — c'est le même appareil (Jonathan, 16 octobre 2026).
 *
 * La règle est ici et pas dans les deux écrans qui la posaient chacun de
 * leur côté — l'un l'aurait suivie, l'autre pas, et la même cure aurait
 * ouvert quatre chèques au bilan et cinq à la cure suivante.
 */
export const SOINS_SANS_VENUE_PROPRE: readonly Technologie[] = [
  'relax',
  'psio',
  'hydroporation',
];

export function demandeUneVenue(t: Technologie): boolean {
  return !SOINS_SANS_VENUE_PROPRE.includes(t);
}

/**
 * Les soins anti-âge que ce centre tient.
 *
 * L'Advance Lift n'est qu'au Grau-du-Roi ; la radiofréquence Mesojet est au
 * Crès et à Sérignan, et **Sérignan tient en plus l'hydroporation**
 * (Jonathan, 16 octobre 2026). Pollestres et Avignon n'ont pas d'anti-âge.
 * **Proposer un soin qu'un centre ne tient pas, c'est le vendre** : la
 * cliente signe, et personne ne peut le lui donner. La règle vit donc ici,
 * au même endroit que les bilans qui prescrivent ces soins, et le banc
 * d'essai la tient.
 *
 * CE QUI RESTE VRAI : aucun centre ne fait l'Advance Lift **et** la
 * radiofréquence — ce sont deux façons concurrentes de traiter la même
 * chose. Un centre peut en revanche tenir plusieurs soins, et Sérignan en
 * tient deux : l'hydroporation ne remplace pas la radiofréquence, elle s'y
 * ajoute. Aucun bilan ne la préconise, la thérapeute l'ajoute à la main.
 */
export const CENTRES_AVEC_HYDROPORATION = ['serignan'];

export function hydroporationDisponible(centreId: string | null | undefined): boolean {
  return Boolean(centreId) && CENTRES_AVEC_HYDROPORATION.includes(centreId!);
}

export function soinsAntiAgeDuCentre(centreId: string | null | undefined): Technologie[] {
  if (!centreId) return [];
  if (centreId === CENTRE_ANTI_AGE) return ['advance_lift'];
  const soins: Technologie[] = [];
  if (signatureDisponible(centreId)) soins.push('radiofrequence');
  if (hydroporationDisponible(centreId)) soins.push('hydroporation');
  return soins;
}

/**
 * Les centres où un bilan anti-âge se facture 89 € à part.
 *
 * C'est le premier rendez-vous du Profil Signature (tarif `bilan_signature`,
 * migration 071), au Crès et à Sérignan. **Le Grau-du-Roi n'en a pas** : son
 * Bio-Portrait Anti-Âge ne facture pas de bilan, c'est la première séance
 * d'Advance Lift qui se règle, 85 €. La case du formulaire de cure ne
 * s'affiche donc que là où ces 89 € existent.
 */
export function bilanAntiAgeFacturable(centreId: string | null | undefined): boolean {
  return Boolean(centreId) && signatureDisponible(centreId!);
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
  /*
    Le Psio, à Sérignan : indigo. Il croise le violet de la radiofréquence
    dans ce centre — d'où un bleu franc plutôt qu'un violet de plus, et deux
    crans d'écart en saturation pour qu'ils se séparent d'un coup d'œil.
  */
  psio: {
    texte: 'text-indigo-700',
    bord: 'border-l-indigo-500',
    pastille: 'bg-indigo-100 text-indigo-800',
    carte: 'border-indigo-300 bg-indigo-50',
    entete: 'border-indigo-200 bg-indigo-100',
    bouton: 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100',
  },
  /*
    L'hydroporation, le second soin anti-âge de Sérignan : fuchsia. Elle
    côtoie le violet de la radiofréquence et l'indigo du Psio dans ce
    centre — d'où un rose franc, qui ne se confond avec ni l'un ni l'autre.
  */
  hydroporation: {
    texte: 'text-fuchsia-700',
    bord: 'border-l-fuchsia-500',
    pastille: 'bg-fuchsia-100 text-fuchsia-800',
    carte: 'border-fuchsia-300 bg-fuchsia-50',
    entete: 'border-fuchsia-200 bg-fuchsia-100',
    bouton: 'border-fuchsia-300 bg-fuchsia-50 hover:bg-fuchsia-100',
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
