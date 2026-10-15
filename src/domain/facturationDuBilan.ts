/*
  Ce qu'on facture d'un bilan.

  Quatre issues à la sortie du rendez-vous, et elles ne parlent pas d'argent
  de la même façon. La règle tenait dans un ternaire au milieu de la page du
  bilan, où elle décidait du prix sans que rien ne la nomme ; la promotion y
  ajoutait un troisième cas, et c'était le moment de la sortir.

  Les PHRASES, elles, restent dans les écrans : les trois bilans n'emploient
  pas les mêmes mots — « Bilan facturé », « Première séance facturée »,
  « Premier rendez-vous facturé » — et c'est voulu. Les mettre en commun
  aurait effacé une différence que la maison fait exprès.
*/
import type { Facturation } from '../types/db';

export interface IssueDuBilan {
  /** Une cure est validée dans le même mouvement. */
  avecCure: boolean;
  /** Un point de suivi : on refait le point, on ne vend rien. */
  pointDeSuivi: boolean;
  /** La promotion : offert alors qu'elle ne prend pas de cure (079). */
  offertEnPromo: boolean;
}

/**
 * L'état et le montant d'un bilan, d'après ce que la cliente a décidé.
 *
 * **Avec une cure, le bilan ne se facture pas à part** : il est dans le
 * montant de la cure, et le facturer deux fois le compterait deux fois au
 * tableau de bord. **Un point de suivi ne se facture pas non plus** — ce
 * n'est pas un bilan d'entrée. **La promotion ne se facture pas et le dit**,
 * pour que la fiche n'annonce pas un accompagnement qui n'a pas commencé et
 * que la liste des clientes ne la perde pas. **Sinon, elle règle son
 * bilan.**
 *
 * L'ordre compte : une cure validée l'emporte sur tout le reste. Si la
 * thérapeute a validé une cure, le bilan est dedans, promotion ou pas.
 */
export function facturationDuBilan(
  issue: IssueDuBilan,
  prixDuBilan: number,
): { facturation: Facturation; montant: number } {
  if (issue.avecCure || issue.pointDeSuivi) return { facturation: 'offert', montant: 0 };
  if (issue.offertEnPromo) return { facturation: 'offert_promo', montant: 0 };
  return { facturation: 'facture', montant: prixDuBilan };
}
