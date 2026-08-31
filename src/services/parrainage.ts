import { supabase } from '../lib/supabase';
import type { Filleule } from '../domain/parrainage';

/** Prénom, nom et centre d'une cliente — rien de plus, et dans les 5 centres. */
export interface ApercuCliente {
  id: string;
  prenom: string;
  nom: string;
  centre_id: string;
  centre: string;
}

export async function chercherParrain(texte: string, sauf?: string): Promise<ApercuCliente[]> {
  if (texte.trim().length < 3) return [];

  const { data, error } = await supabase.rpc('chercher_parrain', {
    p_texte: texte.trim(),
    p_sauf: sauf ?? null,
  });

  if (error) throw error;
  return (data ?? []) as ApercuCliente[];
}

export async function apercuCliente(id: string): Promise<ApercuCliente | null> {
  const { data, error } = await supabase.rpc('apercu_cliente', { p_cliente: id });
  if (error) throw error;
  return ((data ?? []) as ApercuCliente[])[0] ?? null;
}

export async function filleulesDe(clienteId: string): Promise<Filleule[]> {
  const { data, error } = await supabase.rpc('filleules_de', { p_cliente: clienteId });
  if (error) throw error;
  return (data ?? []) as Filleule[];
}

/**
 * Les séances offertes déjà posées sur les cures de cette cliente. C'est la
 * seule chose qui soit écrite : le reste se déduit.
 */
export async function seancesOffertesUtilisees(clienteId: string): Promise<number> {
  const { data, error } = await supabase
    .from('programmes')
    .select('programme_lignes(seances_offertes)')
    .eq('cliente_id', clienteId);

  if (error) throw error;

  return (data ?? []).reduce(
    (total, p) =>
      total +
      ((p.programme_lignes ?? []) as { seances_offertes: number }[]).reduce(
        (n, l) => n + (l.seances_offertes ?? 0),
        0,
      ),
    0,
  );
}

/**
 * Rattache une filleule à sa marraine, ou l'en détache (marraine à null).
 * Passe par la base : la filleule peut être suivie dans un autre centre,
 * et sa fiche n'est alors pas modifiable directement.
 */
export async function rattacherFilleule(
  filleuleId: string,
  marraineId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('rattacher_filleule', {
    p_filleule: filleuleId,
    p_marraine: marraineId,
  });

  if (error) throw error;
}

/** La marraine n'a pas de fiche : on retient son nom, sans compter de séances. */
export async function definirParrainLibre(clienteId: string, nom: string): Promise<void> {
  const { error } = await supabase
    .from('clientes')
    .update({ parrain_libre: nom.trim(), parrain_id: null })
    .eq('id', clienteId);

  if (error) throw error;
}

/**
 * Les crédits de tout un centre en un seul aller-retour, pour la pastille de
 * la liste. La base ne renvoie que des compteurs — la règle des 2 séances
 * par filleule vit dans le domaine, avec les autres règles métier.
 */
export interface CreditsCliente {
  cliente_id: string;
  filleules_engagees: number;
  seances_utilisees: number;
}

export async function creditsDuCentre(centreId: string): Promise<CreditsCliente[]> {
  const { data, error } = await supabase.rpc('credits_parrainage_du_centre', {
    p_centre: centreId,
  });

  if (error) throw error;
  return (data ?? []) as CreditsCliente[];
}
