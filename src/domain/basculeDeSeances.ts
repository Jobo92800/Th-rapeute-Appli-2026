/*
  Basculer des séances d'un soin à un autre, en cours de cure.

  Une cure se vend d'un bloc, et la cliente change d'avis en route : elle
  arrête la relaxation au bout de deux séances et veut de l'I-Shape à la
  place (Jonathan, 22 octobre 2026). Il fallait sinon arrêter la cure et la
  refaire — un geste qui crée un avoir, déplace la date de validation et
  fausse le tableau de bord, pour un échange qui ne coûte rien à personne.

  LE MONTANT DE LA CURE NE BOUGE JAMAIS. Elle est vendue et signée ; on
  échange des séances, pas de l'argent. Pour toucher au prix, « Corriger les
  montants » existe, et ça se décide exprès.

  Ce module dit ce qu'on a le droit de déplacer. La base refait les mêmes
  contrôles (migration 082) : un écran peut se tromper, et ce qu'une cliente
  a droit de recevoir ne se décide pas à l'affichage.
*/
import type { Technologie } from './tarification';

export interface SoinDeLaCure {
  technologie: Technologie;
  /** Séances encore à faire : vendues + offertes − réalisées. */
  restantes: number;
  /** Séances vendues, hors parrainage. Seules celles-là se déplacent. */
  vendues: number;
}

/**
 * Ce qu'on peut au plus déplacer depuis ce soin.
 *
 * **Jamais ce qui est déjà fait** : les séances réalisées racontent ce qui
 * s'est passé, et ça ne se réécrit pas d'ici. **Jamais les séances offertes**
 * par parrainage non plus : elles ont été posées sur un soin à la vente, et
 * les emporter ferait passer le nombre vendu sous zéro.
 */
export function maximumBasculable(soin: SoinDeLaCure): number {
  return Math.max(0, Math.min(soin.restantes, soin.vendues));
}

/**
 * Pourquoi ce transfert est refusé, ou `null` s'il passe.
 *
 * La phrase est celle que l'écran affiche : elle dit ce qui ne va pas **et**
 * ce qu'il reste possible, parce qu'un refus qui n'indique pas la sortie
 * oblige à deviner.
 */
export function refusDeBasculer(args: {
  source: SoinDeLaCure | undefined;
  vers: Technologie | null;
  nombre: number;
  cureArretee: boolean;
}): string | null {
  const { source, vers, nombre, cureArretee } = args;

  if (cureArretee) {
    return 'Cette cure est arrêtée : son avoir a été calculé sur ce qu’elle contenait.';
  }
  if (!source) return 'Choisissez le soin d’où viennent les séances.';
  if (!vers) return 'Choisissez le soin qui les reçoit.';
  if (vers === source.technologie) return 'Il faut deux soins différents.';
  if (!Number.isInteger(nombre) || nombre < 1) return 'Indiquez au moins une séance.';

  const maxi = maximumBasculable(source);
  if (maxi === 0) {
    return source.restantes <= 0
      ? 'Toutes les séances de ce soin ont été réalisées.'
      : 'Les séances qui restent sur ce soin ont été offertes : elles ne se déplacent pas.';
  }
  if (nombre > maxi) {
    return `On ne peut en déplacer que ${maxi} au plus depuis ce soin.`;
  }
  return null;
}
