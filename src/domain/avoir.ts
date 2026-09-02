/*
  L'avoir : ce que le centre doit à une cliente.

  Il naît le plus souvent d'une cure arrêtée en cours de route. La cliente a
  réglé des échéances qui couvraient trente séances, elle en a fait huit :
  la différence lui revient.

  Ce module ne calcule qu'une chose, mais c'est la plus délicate — combien
  proposer. Le reste (le solde, l'historique) se lit en base, où l'avoir est
  une somme de mouvements et jamais un compteur recopié.

  Le montant proposé n'est jamais imposé : la thérapeute le corrige avant de
  valider. Un arrangement commercial, une séance offerte pour le geste, un
  produit gardé — rien de tout cela ne se devine depuis une table.
*/

import type { Echeance, LigneProgramme, Programme } from '../types/db';

/** Ce qu'on sait des séances réellement faites, par technologie. */
export interface SuiviSeances {
  technologie: string;
  seances_faites: number;
}

export interface Decompte {
  /** Ce qu'elle a effectivement réglé. */
  encaisse: number;
  /** Ce qu'elle a reçu : les séances faites, plus ce qu'elle a emporté. */
  consomme: number;
  /** Le détail de ce qui est consommé, pour l'expliquer à la cliente. */
  detail: { libelle: string; montant: number }[];
  /** Encaissé moins consommé, jamais négatif. */
  suggere: number;
  /** Elle a consommé plus qu'elle n'a payé : il reste un dû, pas un avoir. */
  duRestant: number;
}

/**
 * Ce qu'il resterait à encaisser sur une cure : la somme de ses échéances
 * ni réglées, ni offertes, ni annulées.
 *
 * On ne calcule pas « montant total moins encaissé » : après un avoir posé
 * sur l'échéancier, ou une échéance offerte, les deux ne disent plus la
 * même chose. C'est l'échéancier qui fait foi, puisque c'est lui qu'on
 * présente à la cliente.
 */
export function resteAEncaisser(echeances: Echeance[]): number {
  return echeances
    .filter((e) => e.statut === 'a_venir' || e.statut === 'impaye')
    .reduce((n, e) => n + Number(e.montant), 0);
}

/** Ce qui est déjà rentré en caisse sur cette cure. */
export function dejaEncaisse(echeances: Echeance[]): number {
  return echeances
    .filter((e) => e.statut === 'paye')
    .reduce((n, e) => n + Number(e.montant), 0);
}

/**
 * Le décompte d'un arrêt de cure.
 *
 * Le guide et la tenue comptent dès qu'ils ont été facturés : la cliente est
 * repartie avec le jour de la signature, ils ne reviendront pas.
 */
export function decompterArret(
  programme: Pick<Programme, 'prix_guide' | 'prix_tenue'>,
  lignes: Pick<LigneProgramme, 'technologie' | 'prix_unitaire'>[],
  suivi: SuiviSeances[],
  echeances: Echeance[],
  libelleTechnologie: (t: string) => string = (t) => t,
): Decompte {
  const detail: { libelle: string; montant: number }[] = [];

  for (const ligne of lignes) {
    const faites = suivi.find((s) => s.technologie === ligne.technologie)?.seances_faites ?? 0;
    if (faites <= 0) continue;
    const montant = faites * Number(ligne.prix_unitaire);
    if (montant <= 0) continue;
    detail.push({
      libelle: `${libelleTechnologie(ligne.technologie)} — ${faites} séance${faites > 1 ? 's' : ''} faite${faites > 1 ? 's' : ''}`,
      montant,
    });
  }

  if (Number(programme.prix_guide) > 0) {
    detail.push({ libelle: 'Guide de rééquilibrage, emporté', montant: Number(programme.prix_guide) });
  }
  if (Number(programme.prix_tenue) > 0) {
    detail.push({ libelle: 'Tenue I-Shape, emportée', montant: Number(programme.prix_tenue) });
  }

  const consomme = detail.reduce((n, d) => n + d.montant, 0);
  const encaisse = dejaEncaisse(echeances);
  const ecart = encaisse - consomme;

  return {
    encaisse,
    consomme,
    detail,
    suggere: Math.max(0, arrondi(ecart)),
    duRestant: Math.max(0, arrondi(-ecart)),
  };
}

/** Les euros s'arrêtent au centime : sans ça, 0.1 + 0.2 traîne partout. */
function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Le solde, tel que le renvoie la vue solde_avoir
// ---------------------------------------------------------------------------

export interface SoldeAvoir {
  cliente_id: string;
  accorde: number;
  utilise: number;
  rembourse: number;
  solde: number;
  dernier_mouvement: string | null;
}

export type SensAvoir = 'accorde' | 'utilise' | 'rembourse';

export const LIBELLE_SENS: Record<SensAvoir, string> = {
  accorde: 'Avoir accordé',
  utilise: 'Utilisé sur une cure',
  rembourse: 'Remboursé à la cliente',
};

/**
 * Combien d'avoir on peut poser sur une cure : jamais plus que le solde,
 * jamais plus que ce qu'il reste à y encaisser. Poser 500 € d'avoir sur une
 * cure qui n'attend plus que 300 € brûlerait 200 € pour rien.
 */
export function avoirPosable(solde: number, resteSurLaCure: number): number {
  return Math.max(0, arrondi(Math.min(solde, resteSurLaCure)));
}
