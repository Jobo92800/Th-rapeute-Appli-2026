/*
  Les parcours de l'application « Mon Parcours ».

  Il y en avait trois, A, B et C. Le A n'a jamais servi et ne servira pas :
  restent le parcours de trois mois et celui de six.

  POURQUOI LES CODES RESTENT « B » ET « C ».

  Ce code part tel quel dans l'autre application, qui range ses contenus
  audio dessous. Le renommer « 3M » et « 6M » demanderait de modifier
  « Mon Parcours » et de redéployer les deux applications dans le même
  mouvement, sans rien apporter à personne : ce que la thérapeute lit, c'est
  le libellé. On change donc le libellé, pas le code.

  Les fiches d'avant portent parfois « A ». Rien ne les casse : elles
  l'affichent tel quel, et le choix ne le propose plus.
*/

/*
  L'adresse du site, écrite ici et nulle part ailleurs.

  Elle vivait en double — sur la fiche et dans la fenêtre de signature — et
  les deux disaient encore `applipodcast.netlify.app` le jour où le vrai nom
  est arrivé. Une adresse recopiée est une adresse qui finit par diverger.

  Il n'y a pas de lien personnel : le site est le même pour toutes les
  clientes, ce qui est personnel c'est le compte.
*/
export const ADRESSE_PARCOURS = 'https://parcours.mabeautyplus.fr';

/** Sans le protocole : ce qu'on dicte à une cliente, pas ce qu'on clique. */
export const ADRESSE_PARCOURS_DITE = 'parcours.mabeautyplus.fr';

export type CodeParcours = 'B' | 'C';

export const PARCOURS: { code: CodeParcours; libelle: string }[] = [
  { code: 'B', libelle: '3 mois' },
  { code: 'C', libelle: '6 mois' },
];

/** Ce qui s'affiche : « 3 mois », « 6 mois », ou le code brut s'il est ancien. */
export function libelleParcours(code: string | null | undefined): string {
  if (!code) return '—';
  return PARCOURS.find((p) => p.code === code)?.libelle ?? code;
}
