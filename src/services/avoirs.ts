/*
  Les avoirs et l'arrêt d'une cure.

  Rien n'est écrit directement dans les tables : chaque geste passe par une
  fonction en base, parce qu'aucun d'eux ne tient en une seule écriture.
  Arrêter une cure, c'est annuler ses échéances, changer son statut, créer
  l'avoir et prévenir le CRM — soit les quatre passent, soit aucune.

  Les messages d'erreur remontés ici viennent des fonctions SQL et sont déjà
  écrits en français, à destination de la thérapeute : on les affiche tels
  quels plutôt que d'en fabriquer un de plus.
*/

import { supabase } from '../lib/supabase';
import type { SensAvoir, SoldeAvoir } from '../domain/avoir';

export interface MouvementAvoir {
  id: string;
  cliente_id: string;
  centre_id: string;
  therapeute_id: string | null;
  sens: SensAvoir;
  montant: number;
  programme_id: string | null;
  moyen: string | null;
  motif: string;
  date_avoir: string;
  cree_le: string;
}

/** Le solde d'une cliente, tous centres confondus. Zéro si elle n'a rien. */
export async function soldeAvoir(clienteId: string): Promise<SoldeAvoir> {
  const { data, error } = await supabase
    .from('solde_avoir')
    .select('*')
    .eq('cliente_id', clienteId)
    .maybeSingle();

  if (error) throw error;

  return (
    (data as SoldeAvoir | null) ?? {
      cliente_id: clienteId,
      accorde: 0,
      utilise: 0,
      rembourse: 0,
      solde: 0,
      dernier_mouvement: null,
    }
  );
}

/** L'historique, du plus récent au plus ancien. */
export async function mouvementsAvoir(clienteId: string): Promise<MouvementAvoir[]> {
  const { data, error } = await supabase
    .from('avoirs')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('date_avoir', { ascending: false })
    .order('cree_le', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MouvementAvoir[];
}

export async function arreterCure(
  programmeId: string,
  motif: string,
  avoir: number,
  date: string,
): Promise<void> {
  const { error } = await supabase.rpc('arreter_cure', {
    p_programme_id: programmeId,
    p_motif: motif,
    p_avoir: avoir,
    p_date: date,
  });
  if (error) throw error;
}

export async function rouvrirCure(programmeId: string): Promise<void> {
  const { error } = await supabase.rpc('rouvrir_cure', { p_programme_id: programmeId });
  if (error) throw error;
}

export async function accorderAvoir(
  clienteId: string,
  montant: number,
  motif: string,
  date: string,
): Promise<void> {
  const { error } = await supabase.rpc('accorder_avoir', {
    p_cliente_id: clienteId,
    p_montant: montant,
    p_motif: motif,
    p_date: date,
  });
  if (error) throw error;
}

export async function utiliserAvoir(
  programmeId: string,
  montant: number,
  date: string,
): Promise<void> {
  const { error } = await supabase.rpc('utiliser_avoir', {
    p_programme_id: programmeId,
    p_montant: montant,
    p_date: date,
  });
  if (error) throw error;
}

export async function rembourserAvoir(
  clienteId: string,
  montant: number,
  moyen: string,
  date: string,
): Promise<void> {
  const { error } = await supabase.rpc('rembourser_avoir', {
    p_cliente_id: clienteId,
    p_montant: montant,
    p_moyen: moyen,
    p_date: date,
  });
  if (error) throw error;
}

/*
  Supprimer une cure — pas l'arrêter.

  Arrêter dit qu'elle a existé ; supprimer dit qu'elle n'aurait jamais dû.
  La base efface tout ce qu'elle a laissé (échéances, séances, contrat,
  sorties de stock, avoir) et refuse si l'avoir né de son arrêt a déjà été
  dépensé. Direction seulement, vérifié côté base.
*/
export interface ContenuCure {
  seances_faites: number;
  echeances_payees: number;
  montant_paye: number;
  contrats: number;
  sorties_stock: number;
  /** Les boîtes de compléments comprises dans la cure : elles reviennent au rayon. */
  complements_compris: number;
  avoir_accorde: number;
  avoir_utilise: number;
}

export async function contenuCure(programmeId: string): Promise<ContenuCure> {
  const { data, error } = await supabase.rpc('contenu_cure', { p_programme_id: programmeId });
  if (error) throw error;
  const l = (Array.isArray(data) ? data[0] : data) ?? {};
  return {
    seances_faites: Number(l.seances_faites) || 0,
    echeances_payees: Number(l.echeances_payees) || 0,
    montant_paye: Number(l.montant_paye) || 0,
    contrats: Number(l.contrats) || 0,
    sorties_stock: Number(l.sorties_stock) || 0,
    complements_compris: Number(l.complements_compris) || 0,
    avoir_accorde: Number(l.avoir_accorde) || 0,
    avoir_utilise: Number(l.avoir_utilise) || 0,
  };
}

/**
 * Efface la cure, puis demande au CRM de vider « Montant cure N ».
 *
 * La synchro n'écrit que les cures qui existent : sans cet appel, le
 * montant d'une cure effacée resterait dans Airtable pour toujours. Il
 * vient APRÈS l'effacement — c'est la base qui décide ; si le CRM ne
 * répond pas, la cure est bien partie et on le dit, plutôt que de laisser
 * en base une cure dont le montant a disparu du CRM.
 *
 * Rend `null` si tout est passé, sinon ce qu'il reste à faire à la main.
 */
export async function supprimerCure(
  programmeId: string,
  airtableRecordId: string | null,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('supprimer_cure', { p_programme_id: programmeId });
  if (error) throw error;

  const ligne = (Array.isArray(data) ? data[0] : data) as { numero?: number } | undefined;
  const numero = Number(ligne?.numero);
  if (!airtableRecordId || !numero) return null;

  const { data: reponse, error: erreurEdge } = await supabase.functions.invoke('synchro-airtable', {
    body: { action: 'vider_montant_cure', recordId: airtableRecordId, numero },
  });
  const champ = numero <= 1 ? 'Montant Cure' : `Montant cure ${numero}`;
  if (erreurEdge || (reponse && typeof reponse === 'object' && 'error' in reponse)) {
    return `La cure est supprimée, mais « ${champ} » n'a pas pu être vidé dans Airtable : à faire à la main sur la fiche du CRM.`;
  }
  return null;
}
