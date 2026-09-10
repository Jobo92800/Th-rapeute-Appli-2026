/*
  État d'une échéance, tel qu'il est montré à la thérapeute.

  Le retard n'est jamais saisi : il se déduit de la date. Une échéance non
  réglée dont la date est passée est en retard, sans que personne ait à
  cocher quoi que ce soit.
*/

import { addDays, addMonths, differenceInCalendarDays } from 'date-fns';
import type { Echeance, StatutEcheance } from '../types/db';

export type EtatEcheance = 'paye' | 'donne' | 'annule' | 'retard' | 'aujourdhui' | 'a_venir';

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
    gris   = donné, offert, ou annulé — rien à faire, rien à réclamer
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

  if (e.statut === 'annule') {
    return {
      etat: 'annule',
      libelle: 'Annulée',
      jours: 0,
      classe: 'border-ardoise-200 bg-ardoise-50',
      pastille: 'bg-ardoise-100 text-ardoise-500 line-through',
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

/*
  Les statuts qu'une thérapeute pose elle-même, dans l'ordre du menu.

  « Annulée » n'y est pas : une échéance ne s'annule pas à la main. Elle
  l'a été parce que la cure s'est arrêtée, ou parce qu'un avoir l'a
  couverte. On rouvre la cure, ou on reprend l'avoir — deux gestes qui se
  disent et se datent.

  « En retard » et « À encaisser aujourd'hui » n'y sont pas non plus, et pour
  une raison plus profonde : ce ne sont pas des statuts. Ils se déduisent de
  la date, ils changent tout seuls d'un jour à l'autre, et personne ne doit
  pouvoir les poser ou les retirer.
*/
export const STATUTS_SAISISSABLES: { valeur: StatutEcheance; libelle: string }[] = [
  { valeur: 'a_venir', libelle: 'À venir' },
  { valeur: 'paye', libelle: 'Payé' },
  { valeur: 'donne', libelle: 'Donné' },
  { valeur: 'impaye', libelle: 'Impayé' },
];

/**
 * La teinte du menu de statut.
 *
 * Elle suit ce qui est **enregistré**, jamais ce que la date implique : un
 * menu rouge affichant « À venir » se lirait comme une contradiction. Le
 * retard, lui, se voit sur la ligne entière et sur l'étiquette qui l'annonce.
 */
export const TEINTE_STATUT: Record<StatutEcheance, string> = {
  a_venir: 'border-ardoise-300 bg-white text-ardoise-800',
  paye: 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-900',
  donne: 'border-ardoise-400 bg-ardoise-100 text-ardoise-700',
  impaye: 'border-rose-400 bg-rose-50 font-semibold text-rose-900',
  annule: 'border-ardoise-200 bg-ardoise-50 text-ardoise-400 line-through',
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

/**
 * Le délai entre l'acompte et la première échéance, en jours.
 *
 * Une cliente qui verse un acompte n'a pas pu tout régler aujourd'hui : lui
 * réclamer le premier chèque dans la foulée n'aurait pas de sens, et
 * attendre un mois entier laisse partir la seule qui, par définition, ne
 * pouvait pas payer. Quinze jours.
 */
export const JOURS_AVANT_PREMIERE_ECHEANCE = 15;

/**
 * Le calendrier quand un acompte est versé le jour de la cure. `nombre`
 * compte l'acompte, et la date rendue en tête est la sienne.
 *
 * Le calendrier de la cure ne bouge pas : les échéances gardent le rythme
 * mensuel qu'elles auraient eu sans acompte — le 10 de chaque mois reste le
 * 10 de chaque mois. Seule la première glisse, de quinze jours, parce
 * qu'elle serait tombée le jour même, en même temps que l'acompte.
 */
export function datesEcheancierApresAcompte(depart: Date, nombre: number): string[] {
  if (nombre <= 0) return [];

  const cure = datesEcheancier(depart, nombre - 1);
  if (cure.length > 0) {
    cure[0] = addDays(depart, JOURS_AVANT_PREMIERE_ECHEANCE).toISOString().slice(0, 10);
  }

  return [depart.toISOString().slice(0, 10), ...cure];
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

// ---------------------------------------------------------------------------
// RÉÉCHELONNER UNE CURE DÉJÀ SIGNÉE
// ---------------------------------------------------------------------------

/*
  Changer le nombre de chèques après coup.

  Ça arrive au comptoir : la cliente a signé en quatre fois, elle rappelle
  trois jours plus tard pour demander trois, ou l'inverse. Jusqu'ici il
  fallait arrêter la cure et la refaire — un geste lourd, qui crée un avoir
  et fausse le tableau de bord pour une histoire de chèques.

  QUATRE RÈGLES, ET AUCUNE N'EST NÉGOCIABLE.

  Le montant total ne bouge pas. On ne rééchelonne pas un prix : on
  redécoupe ce qui reste dû. La somme des échéances vaut toujours ce que la
  cliente doit, avant comme après.

  Ce qui est réglé ne se touche pas. Un chèque encaissé, une échéance
  offerte, le bilan déjà payé en ligne : ce sont des faits, pas des
  prévisions. On ne redécoupe que ce qui est encore à venir ou impayé.

  Au centre seulement. Chez Alma, le calendrier appartient à l'organisme de
  crédit : le redécouper ici ne changerait rien à ce qu'il prélève, et
  l'écran mentirait à la cliente.

  Les dates repartent du mois prochain. Une échéance qu'on vient de créer
  n'est pas en retard, et la première du nouveau découpage tombe à la
  prochaine date prévue — celle qui était déjà annoncée.
*/

export interface Reechelonnement {
  /** Ce qu'on écrit à la place des échéances encore dues. */
  echeances: Array<{ rang: number; montant: number; date_prevue: string }>;
  /** La somme redécoupée, pour que l'appelant puisse la vérifier. */
  totalRedecoupe: number;
}

/** Ce qu'on ne redécoupe jamais : ce qui est déjà réglé, ou déjà encaissé. */
export function echeanceIntouchable(e: Echeance): boolean {
  return e.statut === 'paye' || e.statut === 'donne' || e.type === 'bilan' || e.type === 'acompte';
}

/**
 * Redécoupe en `n` fois ce qui reste dû sur une cure.
 *
 * La répartition se fait en parts égales, le reliquat d'arrondi sur la
 * première. Le devis, lui, répartit au prorata des séances — mais ici une
 * partie a pu être réglée, et « la première échéance porte le guide et la
 * tenue » n'a plus de sens : ils sont déjà payés.
 */
export function reechelonner(
  echeances: Echeance[],
  n: number,
  premiereDate: Date,
): Reechelonnement {
  const nombre = Math.max(1, Math.floor(n));
  const aRedecouper = echeances.filter((e) => !echeanceIntouchable(e));
  const total = Math.round(aRedecouper.reduce((s, e) => s + Number(e.montant), 0) * 100) / 100;

  const part = Math.floor((total / nombre) * 100) / 100;
  const reliquat = Math.round((total - part * nombre) * 100) / 100;
  const dates = datesEcheancier(premiereDate, nombre);

  return {
    totalRedecoupe: total,
    echeances: Array.from({ length: nombre }, (_, i) => ({
      rang: i + 1,
      montant: Math.round((part + (i === 0 ? reliquat : 0)) * 100) / 100,
      date_prevue: dates[i],
    })),
  };
}

/**
 * Peut-on rééchelonner cette cure, et sinon pourquoi ?
 *
 * La phrase revient à l'écran telle quelle : une thérapeute doit comprendre
 * ce qui bloque sans avoir à deviner.
 */
export function refusDeReechelonner(args: {
  modeReglement: string;
  statutCure: string;
  echeances: Echeance[];
}): string | null {
  if (args.statutCure === 'abandonne') {
    return 'Cette cure est arrêtée : son échéancier ne se redécoupe plus.';
  }
  if (args.modeReglement.startsWith('alma')) {
    return 'Réglée par Alma : le calendrier appartient à l’organisme de crédit, le changer ici ne changerait rien à ce qu’il prélève.';
  }
  if (args.modeReglement === 'inconnu') {
    return 'Cure reprise du CRM : son mode de règlement n’est pas connu, et son échéancier ne vient pas de nous.';
  }
  if (args.echeances.filter((e) => !echeanceIntouchable(e)).length === 0) {
    return 'Tout est réglé sur cette cure : il n’y a plus rien à redécouper.';
  }
  return null;
}
