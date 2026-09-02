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
