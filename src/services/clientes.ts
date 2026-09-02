import { supabase } from '../lib/supabase';
import { declencherSynchro } from './metier';
import type { Cliente, ClienteSaisie, Therapeute } from '../types/db';

/**
 * Les clientes d'un centre, ou de tous quand centreId vaut null — c'est la
 * vue d'ensemble de la direction. Sans filtre, la RLS s'applique seule : une
 * thérapeute ne verrait que le sien de toute façon.
 */
export async function listerClientes(centreId: string | null): Promise<Cliente[]> {
  let requete = supabase.from('clientes').select('*').is('archivee_le', null);
  if (centreId) requete = requete.eq('centre_id', centreId);

  const { data, error } = await requete.order('cree_le', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Cliente[];
}

export async function lireCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Cliente) ?? null;
}

/**
 * Cherche des homonymes dans le centre. On prévient la thérapeute, on ne
 * bloque pas la création : la V1 refusait sèchement le doublon, ce qui
 * empêchait de créer deux clientes portant réellement le même nom.
 */
export async function chercherHomonymes(
  centreId: string,
  prenom: string,
  nom: string,
): Promise<Cliente[]> {
  if (!prenom.trim() || !nom.trim()) return [];

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('centre_id', centreId)
    .is('archivee_le', null)
    .ilike('prenom', prenom.trim())
    .ilike('nom', nom.trim());

  if (error) throw error;
  return (data ?? []) as Cliente[];
}

export async function creerCliente(centreId: string, saisie: ClienteSaisie): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...nettoyer(saisie), centre_id: centreId })
    .select()
    .single();

  if (error) throw error;
  declencherSynchro();
  return data as Cliente;
}

export async function modifierCliente(id: string, saisie: Partial<ClienteSaisie>): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .update(nettoyer(saisie))
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  declencherSynchro();
  return data as Cliente;
}

/** Sort la fiche des listes sans rien perdre. Se restaure. */
export async function archiverCliente(id: string): Promise<void> {
  const { error } = await supabase
    .from('clientes')
    .update({ archivee_le: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function restaurerCliente(id: string): Promise<void> {
  const { error } = await supabase.from('clientes').update({ archivee_le: null }).eq('id', id);
  if (error) throw error;
}

export async function listerArchivees(centreId: string | null): Promise<Cliente[]> {
  let requete = supabase.from('clientes').select('*').not('archivee_le', 'is', null);
  if (centreId) requete = requete.eq('centre_id', centreId);

  const { data, error } = await requete.order('archivee_le', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Cliente[];
}

export interface ContenuCliente {
  bilans: number;
  programmes: number;
  seances: number;
  mensurations: number;
  notes: number;
  contrats: number;
  ventes: number;
}

/** Ce qui disparaîtra avec la fiche, à montrer avant de confirmer. */
export async function contenuCliente(id: string): Promise<ContenuCliente> {
  const { data, error } = await supabase.rpc('contenu_cliente', { p_cliente: id });
  if (error) throw error;
  const l = Array.isArray(data) ? data[0] : data;
  return (l ?? {
    bilans: 0, programmes: 0, seances: 0, mensurations: 0, notes: 0, contrats: 0, ventes: 0,
  }) as ContenuCliente;
}

/**
 * Suppression définitive. Emporte bilan, cure, échéancier, séances,
 * mensurations, notes, contrats et consentements. Réservée à la direction
 * par les règles d'accès de la base.
 */
export async function supprimerCliente(
  id: string,
  options: { supprimerDansAirtable?: boolean; airtableRecordId?: string | null } = {},
): Promise<void> {
  // On nettoie Airtable d'abord : une fois la ligne locale partie, on n'a
  // plus l'identifiant du CRM.
  if (options.supprimerDansAirtable && options.airtableRecordId) {
    const { error } = await supabase.functions.invoke('synchro-airtable', {
      body: { action: 'supprimer_fiche', recordId: options.airtableRecordId },
    });
    if (error) throw new Error("La fiche Airtable n'a pas pu être supprimée. Rien n'a été effacé.");
  }

  const { error } = await supabase.from('clientes').delete().eq('id', id);
  if (error) throw error;
}

export async function listerTherapeutes(centreId: string): Promise<Therapeute[]> {
  const { data, error } = await supabase
    .from('therapeutes')
    .select('*')
    .eq('centre_id', centreId)
    .eq('actif', true)
    .order('ordre');

  if (error) throw error;
  return (data ?? []) as Therapeute[];
}

/** Les chaînes vides partent en NULL, pour ne pas polluer Airtable. */
function nettoyer<T extends Record<string, unknown>>(saisie: T): T {
  const sortie: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(saisie)) {
    sortie[cle] = typeof valeur === 'string' && valeur.trim() === '' ? null : valeur;
  }
  return sortie as T;
}
