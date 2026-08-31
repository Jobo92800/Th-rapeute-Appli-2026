import { supabase } from '../lib/supabase';
import type { Cliente, ClienteSaisie, Therapeute } from '../types/db';

export async function listerClientes(centreId: string): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('centre_id', centreId)
    .is('archivee_le', null)
    .order('cree_le', { ascending: false });

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
  return data as Cliente;
}

/** On archive, on ne supprime jamais : l'historique commercial doit rester. */
export async function archiverCliente(id: string): Promise<void> {
  const { error } = await supabase
    .from('clientes')
    .update({ archivee_le: new Date().toISOString() })
    .eq('id', id);
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
