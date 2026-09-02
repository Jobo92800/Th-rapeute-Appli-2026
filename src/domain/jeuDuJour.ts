/*
  Moteur du jeu du jour.

  La thérapeute ne choisit ni la phase, ni la thématique, ni le jeu. À
  l'ouverture d'une séance, le moteur croise trois choses :

    QUAND ?   la phase A / B / C, déduite de l'avancement réel du programme
    POUR QUI ? le profil comportemental dominant du BioPortrait
    QUOI ?     ce qui n'a pas encore été fait avec cette cliente

  Le terrain n'intervient pas ici : il oriente le protocole physique et les
  compléments. C'est le profil qui pilote l'humain et le ludique.
*/

import type { Jeu, PhaseJeu } from '../types/db';
import type { AxeProfil } from './bioportrait';

/**
 * Répartition indicative de la méthode : environ un tiers des séances en
 * phase A, 40 % en phase B, le dernier quart en phase C.
 */
const BASCULE_VERS_B = 1 / 3;
const BASCULE_VERS_C = 0.73;

/** Thèmes que chaque profil dominant fait remonter en priorité. */
const THEMES_PAR_PROFIL: Record<AxeProfil, string[]> = {
  P1: ['Comportements', 'Alimentation', 'Micronutrition'],
  P2: ['Stress', 'Sommeil', 'Récupération', 'Énergie'],
  P3: ['Confiance', 'Corps', 'Motivation', 'Point B'],
  P4: ['Mouvement', 'Énergie', 'Habitudes', 'Hydratation'],
  P5: ['Progression', 'Habitudes', 'Autonomie', 'Organisation'],
};

export function phaseDuProgramme(seancesFaites: number, seancesPrevues: number): PhaseJeu {
  if (seancesPrevues <= 0) return 'A';
  const avancement = seancesFaites / seancesPrevues;
  if (avancement < BASCULE_VERS_B) return 'A';
  if (avancement < BASCULE_VERS_C) return 'B';
  return 'C';
}

export interface ContexteJeu {
  /** Toute la bibliothèque, triée ou non. */
  bibliotheque: Jeu[];
  /** Codes déjà réalisés avec cette cliente. */
  dejaFaits: string[];
  seancesFaites: number;
  seancesPrevues: number;
  profilDominant: AxeProfil | null;
  /** Nature du jeu de la séance précédente, si elle a eu lieu la même semaine. */
  natureAEviter?: 'pedagogique' | 'action' | null;
}

export interface ChoixJeu {
  jeu: Jeu | null;
  phase: PhaseJeu;
  /** Pourquoi ce jeu-là, en une phrase, pour la thérapeute. */
  motif: string;
}

/**
 * Choisit le prochain jeu. Renvoie toujours un résultat exploitable :
 * si la phase attendue est épuisée, on puise dans les suivantes puis dans
 * les précédentes plutôt que de laisser la thérapeute sans support.
 */
export function choisirJeu(ctx: ContexteJeu): ChoixJeu {
  const phase = phaseDuProgramme(ctx.seancesFaites, ctx.seancesPrevues);
  const faits = new Set(ctx.dejaFaits);
  const restants = ctx.bibliotheque.filter((j) => !faits.has(j.code));

  if (restants.length === 0) {
    return { jeu: null, phase, motif: 'Tous les jeux ont déjà été réalisés avec cette cliente.' };
  }

  // On balaie la phase attendue, puis les suivantes, puis les précédentes.
  const ordreDeRecherche = ordonnerPhases(phase);

  for (const p of ordreDeRecherche) {
    const candidats = restants.filter((j) => j.phase === p);
    if (candidats.length === 0) continue;

    const choisi = meilleurCandidat(candidats, ctx);
    return {
      jeu: choisi.jeu,
      phase: p,
      motif:
        p === phase
          ? choisi.motif
          : `${choisi.motif} La phase ${phase} est épuisée, on enchaîne sur la phase ${p}.`,
    };
  }

  return { jeu: null, phase, motif: 'Aucun jeu disponible.' };
}

function ordonnerPhases(depart: PhaseJeu): PhaseJeu[] {
  if (depart === 'A') return ['A', 'B', 'C'];
  if (depart === 'B') return ['B', 'C', 'A'];
  return ['C', 'B', 'A'];
}

function meilleurCandidat(candidats: Jeu[], ctx: ContexteJeu): { jeu: Jeu; motif: string } {
  const themes = ctx.profilDominant ? THEMES_PAR_PROFIL[ctx.profilDominant] : [];

  // Deux venues la même semaine : on alterne pédagogique et action pour
  // éviter l'effet « cours » deux fois de suite.
  const alternance = ctx.natureAEviter
    ? candidats.filter((j) => j.nature !== ctx.natureAEviter)
    : [];
  const base = alternance.length > 0 ? alternance : candidats;

  const parProfil = base.filter((j) => themes.includes(j.theme));
  const prioritaires = base.filter((j) => j.prioritaire);

  const retenu =
    premierParOrdre(parProfil) ?? premierParOrdre(prioritaires) ?? premierParOrdre(base)!;

  const motifs: string[] = [];
  if (parProfil.includes(retenu)) motifs.push(`thème adapté au profil dominant`);
  if (alternance.length > 0) motifs.push(`alterne avec le jeu de la séance précédente`);
  if (motifs.length === 0) motifs.push('prochain jeu de la progression');

  return { jeu: retenu, motif: capitaliser(motifs.join(', ')) + '.' };
}

function premierParOrdre(liste: Jeu[]): Jeu | undefined {
  if (liste.length === 0) return undefined;
  return [...liste].sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code))[0];
}

function capitaliser(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const LIBELLES_PHASE: Record<PhaseJeu, string> = {
  A: 'Phase A · Rééquilibrer le terrain',
  B: 'Phase B · Transformation durable',
  C: 'Phase C · Stabiliser et revivre',
};
