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

/**
 * Les trois formules. La cure entière, ou allégée pour rester accessible —
 * sans jamais descendre sous un plancher qui la rendrait inefficace.
 */
export interface Formule {
  f: number;
  n: string;
  d: string;
  rec?: boolean;
}

export const FORMULES_DEFAUT: Formule[] = [
  { f: 1, n: 'Intégrale', d: 'Le programme complet, résultat optimal', rec: true },
  { f: 0.8, n: 'Équilibre', d: "L'essentiel, à un rythme plus accessible" },
  { f: 0.5, n: 'Découverte', d: 'Pour démarrer en douceur' },
];

const PLANCHER_LUXO = 10;
const PLANCHER_AUTRES = 4;

/** Applique une formule à la prescription, planchers compris. */
export function appliquerFormule(lignes: LignePrescrite[], facteur: number): LignePrescrite[] {
  return lignes.map((l) => {
    const plancher = l.presta === 'LUXO' ? PLANCHER_LUXO : PLANCHER_AUTRES;
    return { ...l, seances: Math.max(plancher, Math.round(l.seances * facteur)) };
  });
}

/** Ce qui reste après les contre-indications : la cure réellement faisable. */
export function lignesRetenues(lignes: LignePrescrite[]): LignePrescrite[] {
  return lignes.filter((l) => l.contreIndication !== 'rem' && l.seances > 0);
}
