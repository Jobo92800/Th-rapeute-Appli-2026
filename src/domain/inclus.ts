/*
  Ce qu'il y a derrière deux lignes de « ce qui est compris ».

  Le guide et l'application audio sont les deux éléments que la cliente ne
  voit pas au comptoir : l'un est un livre qu'on lui remettra, l'autre une
  application qu'elle installera chez elle. Les six autres lignes se
  comprennent d'elles-mêmes ; ces deux-là méritent qu'on les montre.

  D'où un « i » sur ces deux lignes seulement, et une bulle qui s'ouvre.

  DEUX FAÇONS DE MONTRER, ET C'EST DÉLIBÉRÉ.

    Le guide est un objet : une photo le dit mieux que n'importe quel
    dessin, on voit le papier, l'épaisseur, les pages.

    L'application est un écran. Une capture d'écran réduite à la taille
    d'une vignette ne montre rien — du texte gris de deux pixels sur fond
    blanc. On la redessine donc en vrai, à l'échelle, avec des vraies
    tailles de texte : ce qu'on perd en fidélité au pixel, on le gagne en
    lisibilité, et c'est tout ce qui compte devant une cliente.

  POURQUOI CE TEXTE N'EST PAS DANS LE BARÈME. Le barème porte le
  questionnaire, ses points et ses paliers : le faire évoluer ne demande
  aucune modification de code, et c'est précieux. Ces textes-ci ne décident
  de rien et ne se calculent pas — retoucher une phrase de vente ne vaut
  pas une migration.

  Ce module reste sans dépendance à l'interface : les icônes sont nommées,
  pas importées. C'est l'écran qui sait à quoi ressemble un casque.
*/

/** Un atout, en pastille : une icône nommée et trois ou quatre mots. */
export interface Atout {
  icone: 'casque' | 'cadenas' | 'progression' | 'lune' | 'phases' | 'recettes' | 'balance';
  texte: string;
}

export interface DetailInclus {
  titre: string;
  /** L'accroche, en une ligne. */
  accroche: string;
  atouts: Atout[];
  paragraphes: string[];
  /** Une photo, servie depuis `public/`. Introuvable : la bulle s'ouvre sans. */
  image?: string;
  alt?: string;
  /** Ou un dessin de l'écran, fait à la main dans l'application. */
  maquette?: 'parcours';
}

export const DETAILS: Record<string, DetailInclus> = {
  head: {
    titre: 'L’application MAbeautyplus Nutrition',
    accroche: 'Votre coach dans l’oreille, entre deux séances.',
    atouts: [
      { icone: 'casque', texte: '7 à 10 minutes par étape' },
      { icone: 'cadenas', texte: 'Une étape à la fois' },
      { icone: 'progression', texte: 'Votre progression visible' },
      { icone: 'lune', texte: 'Où vous voulez, quand vous voulez' },
    ],
    paragraphes: [
      'Chaque étape se débloque quand la précédente est terminée. Vous reprenez où vous vous étiez arrêtée, sur votre téléphone, quand cela vous arrange.',
      'C’est là que se joue ce qu’aucune machine ne fait à votre place : comprendre pourquoi vous mangez comme vous mangez, et installer d’autres réflexes. Les séances travaillent le corps ; le parcours audio travaille ce qui vous a menée jusqu’ici.',
    ],
    maquette: 'parcours',
  },
  book: {
    titre: 'Votre guide de rééquilibrage alimentaire',
    accroche: 'Votre programme alimentaire, en main.',
    atouts: [
      { icone: 'phases', texte: '4 phases sur 4 semaines' },
      { icone: 'recettes', texte: 'Recettes et quantités' },
      { icone: 'balance', texte: 'Fait pour durer' },
    ],
    paragraphes: [
      'La journée détox et l’attaque, la réintroduction des féculents, l’ajustement des quantités, puis l’équilibre qui s’installe. Avec les astuces du quotidien, semaine après semaine.',
      'Ce n’est pas un régime à tenir, c’est une méthode à apprendre. Au bout des quatre semaines, vous composez vos repas sans y penser — et c’est ce qui fait que le poids perdu ne revient pas.',
    ],
    image: '/illustrations/guide-alimentaire.png',
    alt: 'Le guide de suivi MAbeautyplus, ouvert sur le planning des quatre semaines.',
  },
};

export function detailInclus(cleIcone: string | undefined): DetailInclus | null {
  return (cleIcone && DETAILS[cleIcone]) || null;
}
