/**
 * Du BioPortrait à la cure.
 *
 * Chaque réponse du bilan donne des points à un soin. Un barème à paliers
 * en déduit deux choses d'un coup : le nombre de séances, et le degré de
 * recommandation. Rien n'est décidé à la main — la thérapeute ajuste
 * ensuite si la situation le demande, mais elle part d'une proposition qui
 * découle des réponses.
 *
 * Les contre-indications, elles, ne s'ajustent pas : une réponse peut
 * retirer un soin de la prescription. Un pacemaker retire l'électro et la
 * pressodynamie, une grossesse retire tout. C'est le seul endroit de
 * l'application où une réponse interdit quelque chose.
 */

import type {
  Bareme,
  ContreIndication,
  PalierPrestation,
  Prestation,
  Reponses,
} from './bioportrait';
import { choix } from './bioportrait';

export const PRESTATIONS: Prestation[] = ['LUXO', 'RELAX', 'ISHAPE', 'PRESSO'];

export type NiveauPresta = 'prop' | 'fort' | 'oblig';

export const LIBELLES_NIVEAU: Record<NiveauPresta, string> = {
  prop: 'Proposé',
  fort: 'Fortement conseillé',
  oblig: 'Indispensable',
};

export interface LignePrescrite {
  presta: Prestation;
  niveau: NiveauPresta;
  seances: number;
  /** Null si rien ne s'y oppose. */
  contreIndication: ContreIndication | null;
  /**
   * Vrai quand la thérapeute a ajouté ce soin elle-même, alors que le bilan
   * ne le proposait pas. L'écran le dit : « proposé » serait un mensonge, et
   * la cliente doit savoir d'où vient chaque ligne de sa cure.
   */
  ajoute?: boolean;
}

export interface Depouillement {
  /** Points cumulés par prestation. */
  points: Record<Prestation, number>;
  /** Ce que les réponses de santé interdisent ou signalent. */
  contreIndications: Partial<Record<Prestation, ContreIndication>>;
  /** Engagement déclaré : LOW, MID, HIGH. Oriente le discours, pas le prix. */
  engagement: 'LOW' | 'MID' | 'HIGH';
  /** Index de la réponse au score InBody, quand il a été saisi. */
  scoreInbody: number | null;
}

/** Barème de repli, si le barème en base n'en porte pas. */
const PALIERS_DEFAUT: Record<Prestation, PalierPrestation[]> = {
  LUXO: [
    { min: 0, s: 12, l: 'prop' },
    { min: 6, s: 15, l: 'fort' },
    { min: 10, s: 20, l: 'oblig' },
  ],
  RELAX: [
    { min: 0, s: 0, l: null },
    { min: 6, s: 5, l: 'prop' },
    { min: 11, s: 10, l: 'fort' },
  ],
  ISHAPE: [
    { min: 0, s: 0, l: null },
    { min: 5, s: 6, l: 'prop' },
    { min: 9, s: 12, l: 'fort' },
    { min: 12, s: 15, l: 'oblig' },
    { min: 14, s: 20, l: 'oblig' },
  ],
  PRESSO: [
    { min: 0, s: 0, l: null },
    { min: 3, s: 6, l: 'prop' },
    { min: 5, s: 12, l: 'fort' },
  ],
};

/**
 * Dépouille les réponses : points par soin, contre-indications, engagement.
 * Une contre-indication franche ne se laisse jamais écraser par un simple
 * « avis médical » — c'est pour ça qu'on ne remplace que dans un sens.
 */
export function depouiller(bareme: Bareme, reponses: Reponses): Depouillement {
  const points = { LUXO: 0, RELAX: 0, ISHAPE: 0, PRESSO: 0 } as Record<Prestation, number>;
  const contreIndications: Partial<Record<Prestation, ContreIndication>> = {};
  let engagement: Depouillement['engagement'] = 'MID';
  let scoreInbody: number | null = null;

  bareme.STEPS.forEach((etape, index) => {
    if (!etape.o) return;

    for (const i of choix(reponses, index)) {
      const option = etape.o[i];
      if (!option) continue;

      for (const [presta, n] of Object.entries(option[2] ?? {})) {
        points[presta as Prestation] += n as number;
      }

      const drapeau = option[3];
      if (typeof drapeau === 'string') {
        if (drapeau === 'ENG_LOW') engagement = 'LOW';
        if (drapeau === 'ENG_HIGH') engagement = 'HIGH';
      } else if (drapeau) {
        for (const [presta, etat] of Object.entries(drapeau)) {
          const p = presta as Prestation;
          if (!contreIndications[p] || etat === 'rem') contreIndications[p] = etat as ContreIndication;
        }
      }

      if (etape.score) scoreInbody = i;
    }
  });

  return { points, contreIndications, engagement, scoreInbody };
}

/** Le palier atteint pour un nombre de points donné. */
export function palier(bareme: Bareme, presta: Prestation, points: number): PalierPrestation {
  const paliers = bareme.BAREME_PRESTA?.[presta] ?? PALIERS_DEFAUT[presta];
  let atteint = paliers[0];
  for (const p of paliers) if (points >= p.min) atteint = p;
  return atteint;
}

/**
 * La prescription qui découle des réponses.
 *
 * La Luxothérapie est toujours là : c'est le soin de la perte de poids,
 * la raison même de la venue. Les autres n'apparaissent qu'au-dessus de
 * leur premier palier.
 */
export function prescrire(bareme: Bareme, d: Depouillement): LignePrescrite[] {
  const lignes: LignePrescrite[] = [];

  const luxo = palier(bareme, 'LUXO', d.points.LUXO);
  lignes.push({
    presta: 'LUXO',
    niveau: luxo.l ?? 'prop',
    seances: luxo.s,
    contreIndication: d.contreIndications.LUXO ?? null,
  });

  for (const presta of ['RELAX', 'ISHAPE', 'PRESSO'] as Prestation[]) {
    const p = palier(bareme, presta, d.points[presta]);
    if (p.s <= 0) continue;
    lignes.push({
      presta,
      niveau: p.l ?? 'prop',
      seances: p.s,
      contreIndication: d.contreIndications[presta] ?? null,
    });
  }

  return lignes;
}

/*
  ===========================================================================
  LES TROIS FORMULES
  ===========================================================================

  Elles partent toutes de la même prescription — celle que le BioPortrait a
  calculée — et n'en changent que la taille. Aucune ne compose une cure de
  son côté : c'est le bilan qui décide de ce qui est utile, la formule ne
  décide que de ce que la cliente peut se permettre.

  INTÉGRALE ne transforme rien. C'est la référence.

  ÉQUILIBRE vise −40 % et retombe sur un palier réel. Un nombre de séances
  ne se divise pas : 15 × 0,6 fait 9, et 9 séances de luxothérapie n'existent
  pas. On cherche donc le palier autorisé le plus proche de la cible, et la
  réduction obtenue oscille entre −35 % et −45 % selon les prestations.
  C'est assumé : on n'annonce pas un pourcentage à la cliente, on annonce un
  prix. Toutes les prestations sont conservées.

  DÉCOUVERTE ne réduit pas, elle choisit. Une seule prestation — la plus
  prioritaire — gardée au nombre de séances de l'Intégrale, pour que la
  cliente voie un vrai résultat sur un point plutôt qu'un demi-résultat
  partout. Sauf quand le bilan n'a prescrit qu'une seule prestation : là,
  choisir ne veut plus rien dire, et Découverte serait la copie conforme de
  l'Intégrale. Elle descend alors au palier minimum de cette prestation —
  sans quoi l'échelle des trois prix cesserait d'être décroissante.
*/

export type CodeFormule = 'integrale' | 'equilibre' | 'decouverte';

export interface Formule {
  code: CodeFormule;
  n: string;
  d: string;
  rec?: boolean;
}

export const FORMULES: Formule[] = [
  { code: 'integrale', n: 'Intégrale', d: 'Le programme complet, résultat optimal', rec: true },
  { code: 'equilibre', n: 'Équilibre', d: "L'essentiel, à un rythme plus accessible" },
  { code: 'decouverte', n: 'Découverte', d: 'Une prestation, pour un vrai résultat' },
];

/**
 * Les nombres de séances qui existent, prestation par prestation.
 *
 * Rien ne peut sortir de ces listes : ni une formule, ni un ajustement. Ce
 * sont des durées de protocole, pas des quantités qu'on découpe. Le premier
 * de chaque liste est le minimum — en dessous, le soin ne produit plus rien.
 */
export const PALIERS_SEANCES: Record<Prestation, number[]> = {
  LUXO: [10, 12, 15, 20],
  RELAX: [5, 10],
  ISHAPE: [6, 10, 12, 15, 20],
  PRESSO: [6, 10, 12],
};

/** Ce qu'on ne descend jamais : le premier palier de la prestation. */
export function minimumSeances(presta: Prestation): number {
  return PALIERS_SEANCES[presta][0];
}

/**
 * Le palier le plus proche d'une cible.
 *
 * À égalité de distance, on prend le plus bas : la formule Équilibre existe
 * pour faire baisser le prix, elle ne va pas arrondir vers le haut au
 * prétexte que c'est aussi près.
 */
export function palierLePlusProche(presta: Prestation, cible: number): number {
  const paliers = PALIERS_SEANCES[presta];
  let retenu = paliers[0];
  let ecart = Math.abs(cible - retenu);

  for (const p of paliers.slice(1)) {
    const e = Math.abs(cible - p);
    if (e < ecart) {
      retenu = p;
      ecart = e;
    }
  }
  return retenu;
}

/** Ce qu'Équilibre vise avant d'être recalé sur un palier. */
const PART_EQUILIBRE = 0.6;

/**
 * L'ordre dans lequel on départage deux prestations de même niveau.
 *
 * La luxothérapie perte de poids d'abord : c'est le cœur de la méthode, et
 * une cliente qui ne prend qu'une chose doit prendre celle-là. Le reste suit
 * l'ordre de la spécification.
 */
const ORDRE_PRIORITE: Prestation[] = ['LUXO', 'ISHAPE', 'PRESSO', 'RELAX'];

const RANG_NIVEAU: Record<NiveauPresta, number> = { oblig: 3, fort: 2, prop: 1 };

/**
 * La prestation que Découverte retient : le niveau le plus haut, puis
 * l'ordre de priorité. On ne choisit que parmi ce qui est réellement
 * faisable — une prestation écartée pour raison de santé ne peut pas
 * devenir la vitrine de la cure.
 */
export function prestationPrioritaire(lignes: LignePrescrite[]): LignePrescrite | null {
  const candidates = lignesRetenues(lignes);
  if (candidates.length === 0) return null;

  return candidates.reduce((meilleure, l) => {
    const ecartNiveau = RANG_NIVEAU[l.niveau] - RANG_NIVEAU[meilleure.niveau];
    if (ecartNiveau !== 0) return ecartNiveau > 0 ? l : meilleure;
    return ORDRE_PRIORITE.indexOf(l.presta) < ORDRE_PRIORITE.indexOf(meilleure.presta)
      ? l
      : meilleure;
  });
}

/** Applique une formule à la prescription. */
export function appliquerFormule(
  lignes: LignePrescrite[],
  formule: CodeFormule,
): LignePrescrite[] {
  if (formule === 'integrale') return lignes;

  if (formule === 'equilibre') {
    return lignes.map((l) =>
      l.seances > 0
        ? { ...l, seances: palierLePlusProche(l.presta, l.seances * PART_EQUILIBRE) }
        : l,
    );
  }

  const gardee = prestationPrioritaire(lignes);
  if (!gardee) return lignes;

  /*
    Une seule prestation prescrite : Découverte n'a personne à écarter, elle
    serait l'Intégrale sous un autre nom. Elle descend donc au minimum de la
    prestation — c'est la seule façon qu'il lui reste d'être une porte
    d'entrée moins chère.
  */
  const seule = lignesRetenues(lignes).length === 1;

  return lignes.map((l) => {
    if (l.presta !== gardee.presta) return { ...l, seances: 0 };
    return seule ? { ...l, seances: minimumSeances(l.presta) } : l;
  });
}

/** Ce qui reste après les contre-indications : la cure réellement faisable. */
export function lignesRetenues(lignes: LignePrescrite[]): LignePrescrite[] {
  return lignes.filter((l) => l.contreIndication !== 'rem' && l.seances > 0);
}

/*
  AJOUTER UN SOIN QUE LE BILAN N'A PAS PROPOSÉ.

  Le barème décide de ce qui est prescrit, et il a raison le plus souvent.
  Mais il ne voit que les réponses : une cliente peut dire en s'asseyant
  quelque chose qu'aucune question n'a posé. La thérapeute doit pouvoir
  ajouter le soin correspondant.

  UNE SEULE CHOSE RESTE INTERDITE : un soin retiré par une réponse de santé.
  Celui-là n'est pas « non proposé », il est contre-indiqué — et aucune
  conversation au comptoir ne doit pouvoir le remettre. C'est la seule ligne
  que ce module ne laisse pas franchir.

  Un soin sous « avis médical » reste ajoutable : il l'était déjà quand le
  bilan le proposait, et la mise en garde s'affiche de la même façon.
*/

export const PRESTATIONS_CURE: Prestation[] = ['LUXO', 'RELAX', 'ISHAPE', 'PRESSO'];

/**
 * Ce qu'on met dans un soin ajouté à la main : son premier palier.
 *
 * Le minimum, jamais un chiffre choisi ailleurs : un soin qu'on ajoute est
 * un soin dont on n'est pas sûr, et la thérapeute peut toujours monter.
 */
export function seancesALAjout(presta: Prestation): number {
  return minimumSeances(presta);
}

/**
 * Les soins absents de la cure et qu'on peut y ajouter.
 *
 * Absents veut dire « pas dans la liste » : un soin déjà présent, même
 * ramené à zéro séance, ne se propose pas à l'ajout — il se remonte avec
 * son bouton plus.
 */
export function prestationsAjoutables(
  d: Depouillement,
  cure: LignePrescrite[],
): Prestation[] {
  const presentes = new Set(cure.map((l) => l.presta));
  return PRESTATIONS_CURE.filter(
    (p) => !presentes.has(p) && d.contreIndications[p] !== 'rem',
  );
}

/** La ligne d'un soin ajouté à la main, prête à rejoindre la cure. */
export function ligneAjoutee(d: Depouillement, presta: Prestation): LignePrescrite {
  return {
    presta,
    niveau: 'prop',
    seances: seancesALAjout(presta),
    contreIndication: d.contreIndications[presta] ?? null,
    ajoute: true,
  };
}
