/*
  Ce qu'il y a derrière deux lignes de « ce qui est compris ».

  Le guide et l'application audio sont les deux éléments que la cliente ne
  voit pas au comptoir : l'un est un livre qu'on lui remettra, l'autre une
  application qu'elle installera chez elle. Les six autres lignes se
  comprennent d'elles-mêmes ; ces deux-là méritent qu'on les montre.

  D'où un « i » sur ces deux lignes seulement, et une bulle qui s'ouvre avec
  une image et deux paragraphes.

  POURQUOI CE TEXTE EST ICI ET NON DANS LE BARÈME. Le barème porte le
  questionnaire, ses points et ses paliers : le faire évoluer ne demande
  aucune modification de code, et c'est précieux. Ces deux textes-là ne
  décident de rien, ne se calculent pas, et changer une phrase de vente ne
  vaut pas une migration.

  Le rattachement se fait sur la clé d'icône (`i`) de l'entrée, pas sur son
  titre : le titre est du texte affiché, il se réécrira un jour.
*/

export interface DetailInclus {
  /** Titre de la bulle. */
  titre: string;
  /** L'accroche, en une ligne. */
  accroche: string;
  paragraphes: string[];
  /** Fichier servi depuis `public/`. Absent ou introuvable : la bulle s'ouvre sans image. */
  image: string;
  alt: string;
}

export const DETAILS: Record<string, DetailInclus> = {
  head: {
    titre: 'L’application MAbeautyplus Nutrition',
    accroche: 'Votre parcours audio, semaine après semaine.',
    paragraphes: [
      'Des étapes courtes, à écouter quand vous voulez : dans la voiture, en marchant, avant de dormir. Chacune se débloque quand la précédente est terminée — vous avancez à votre rythme, sans jamais être en retard.',
      'C’est là que se joue ce qu’aucune machine ne fait à votre place : comprendre pourquoi vous mangez comme vous mangez, et installer d’autres réflexes. Les séances travaillent le corps ; le parcours audio travaille ce qui vous a menée jusqu’ici.',
    ],
    image: '/illustrations/parcours-audio.png',
    alt: 'L’application Mon Parcours sur un téléphone : les étapes audio et la progression.',
  },
  book: {
    titre: 'Votre guide de rééquilibrage alimentaire',
    accroche: 'Votre programme alimentaire, en main.',
    paragraphes: [
      'Quatre semaines, quatre phases : la journée détox et l’attaque, la réintroduction des féculents, l’ajustement des quantités, puis l’équilibre qui s’installe. Avec les recettes, les repères de quantités et les astuces du quotidien.',
      'Ce n’est pas un régime à tenir, c’est une méthode à apprendre. Au bout des quatre semaines, vous composez vos repas sans y penser — et c’est ce qui fait que le poids perdu ne revient pas.',
    ],
    image: '/illustrations/guide-alimentaire.png',
    alt: 'Le guide de suivi MAbeautyplus, ouvert sur le planning des quatre semaines.',
  },
};

export function detailInclus(cleIcone: string | undefined): DetailInclus | null {
  return (cleIcone && DETAILS[cleIcone]) || null;
}
