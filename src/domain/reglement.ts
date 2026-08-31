/*
  État d'une échéance, tel qu'il est montré à la thérapeute.

  Le retard n'est jamais saisi : il se déduit de la date. Une échéance non
  réglée dont la date est passée est en retard, sans que personne ait à
  cocher quoi que ce soit.
*/

import { addMonths, differenceInCalendarDays } from 'date-fns';
import type { Echeance, StatutEcheance } from '../types/db';

export type EtatEcheance = 'paye' | 'donne' | 'retard' | 'aujourdhui' | 'a_venir';

export interface Etat {
  etat: EtatEcheance;
  libelle: string;
  /** Nombre de jours de retard, si retard il y a. */
  jours: number;
  /** Classes du bloc : fond, bordure, texte. */
  classe: string;
  /** Classe de la pastille de statut. */
  pastille: string;
}

/*
  Couleurs sémantiques, distinctes de l'accent de l'interface :
    vert   = encaissé
    gris   = donné, offert
    rouge  = en retard ou impayé, ce qui demande une action
    bleu   = à encaisser aujourd'hui
    neutre = à venir, rien à faire
*/
export function etatEcheance(e: Echeance, aujourdhui = new Date()): Etat {
  if (e.statut === 'paye') {
    return {
      etat: 'paye',
      libelle: 'Payé',
      jours: 0,
      classe: 'border-emerald-300 bg-emerald-50',
      pastille: 'bg-emerald-100 text-emerald-800',
    };
  }

  if (e.statut === 'donne') {
    return {
      etat: 'donne',
      libelle: 'Donné',
      jours: 0,
      classe: 'border-ardoise-300 bg-ardoise-100',
      pastille: 'bg-ardoise-200 text-ardoise-700',
    };
  }

  const jours = e.date_prevue
    ? differenceInCalendarDays(aujourdhui, new Date(e.date_prevue))
    : 0;

  if (e.statut === 'impaye' || (e.date_prevue && jours > 0)) {
    return {
      etat: 'retard',
      libelle:
        e.statut === 'impaye' && jours <= 0
          ? 'Impayé'
          : jours === 1
            ? '1 jour de retard'
            : `${jours} jours de retard`,
      jours: Math.max(0, jours),
      classe: 'border-rose-300 bg-rose-50',
      pastille: 'bg-rose-100 text-rose-800',
    };
  }

  if (e.date_prevue && jours === 0) {
    return {
      etat: 'aujourdhui',
      libelle: "À encaisser aujourd'hui",
      jours: 0,
      classe: 'border-marine-400 bg-marine-50',
      pastille: 'bg-marine-100 text-marine-800',
    };
  }

  return {
    etat: 'a_venir',
    libelle: 'À venir',
    jours: 0,
    classe: 'border-ardoise-200 bg-white',
    pastille: 'bg-ardoise-100 text-ardoise-600',
  };
}

/** Le clic sur la pastille fait tourner les statuts saisissables. */
export const STATUT_SUIVANT: Record<StatutEcheance, StatutEcheance> = {
  a_venir: 'paye',
  paye: 'donne',
  donne: 'impaye',
  impaye: 'a_venir',
};

/**
 * Les dates d'un échéancier : la première le jour même, puis une par mois.
 * Elles restent modifiables une par une sur la fiche.
 */
export function datesEcheancier(depart: Date, nombre: number): string[] {
  return Array.from({ length: nombre }, (_, i) =>
    addMonths(depart, i).toISOString().slice(0, 10),
  );
}

// ---------------------------------------------------------------------------
// Situation agrégée, telle que la renvoie la vue situation_reglement
// ---------------------------------------------------------------------------

export interface SituationReglement {
  cliente_id: string;
  centre_id: string;
  nb_en_retard: number;
  montant_en_retard: number;
  montant_encaisse: number;
  montant_donne: number;
  montant_restant: number;
  prochaine_echeance: string | null;
  nb_echeances: number;
  nb_payees: number;
}

export type EtatCliente = 'retard' | 'solde' | 'en_cours' | 'aucun';

export function etatCliente(s: SituationReglement | undefined): {
  etat: EtatCliente;
  libelle: string;
  classe: string;
} {
  if (!s || s.nb_echeances === 0) {
    return { etat: 'aucun', libelle: '—', classe: 'text-ardoise-400' };
  }
  if (s.nb_en_retard > 0) {
    return {
      etat: 'retard',
      libelle: `${s.nb_en_retard} en retard`,
      classe: 'border-rose-300 bg-rose-50 text-rose-800',
    };
  }
  if (Number(s.montant_restant) <= 0) {
    return {
      etat: 'solde',
      libelle: 'Soldé',
      classe: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    };
  }
  return {
    etat: 'en_cours',
    libelle: `${s.nb_payees} / ${s.nb_echeances} réglées`,
    classe: 'border-ardoise-200 bg-white text-ardoise-700',
  };
}
