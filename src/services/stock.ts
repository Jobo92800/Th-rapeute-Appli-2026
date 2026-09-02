import { supabase } from '../lib/supabase';
import type {
  EtatStock,
  MotifMouvement,
  MouvementStock,
  ProduitStock,
  SensMouvement,
} from '../types/db';

/**
 * Un mouvement, avec de quoi le lire sans ouvrir autre chose : le produit,
 * la thérapeute qui l'a saisi, et — quand il vient d'une vente ou d'une
 * signature — la cliente concernée.
 */
export interface MouvementDetaille extends MouvementStock {
  produit: { code: string; nom: string; unite: string } | null;
  therapeute: { prenom: string } | null;
  vente: { cliente: { prenom: string; nom: string } | null } | null;
  programme: { cliente: { prenom: string; nom: string } | null } | null;
}

const CHAMPS_MOUVEMENT =
  '*, produit:produits_stock(code, nom, unite), therapeute:therapeutes(prenom),' +
  ' vente:ventes_complements(cliente:clientes(prenom, nom)),' +
  ' programme:programmes(cliente:clientes(prenom, nom))';

/** « Camille Durand », ou rien si le mouvement ne concerne personne. */
export function clienteDuMouvement(m: MouvementDetaille): string | null {
  const c = m.vente?.cliente ?? m.programme?.cliente ?? null;
  return c ? `${c.prenom} ${c.nom}` : null;
}

export async function listerProduits(): Promise<ProduitStock[]> {
  const { data, error } = await supabase
    .from('produits_stock')
    .select('*')
    .eq('actif', true)
    .order('ordre');

  if (error) throw error;
  return (data ?? []) as ProduitStock[];
}

/** L'état du rayon d'un centre : une ligne par produit, quantité calculée. */
export async function etatDuCentre(centreId: string): Promise<EtatStock[]> {
  const { data, error } = await supabase
    .from('etat_stock')
    .select('*')
    .eq('centre_id', centreId)
    .order('ordre');

  if (error) throw error;
  return (data ?? []) as EtatStock[];
}

export async function mouvementsDuCentre(centreId: string, limite = 100): Promise<MouvementDetaille[]> {
  const { data, error } = await supabase
    .from('mouvements_stock')
    .select(CHAMPS_MOUVEMENT)
    .eq('centre_id', centreId)
    .order('fait_le', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return (data ?? []) as unknown as MouvementDetaille[];
}

export async function mouvementsDuProduit(
  centreId: string,
  produitId: string,
  limite = 50,
): Promise<MouvementDetaille[]> {
  const { data, error } = await supabase
    .from('mouvements_stock')
    .select(CHAMPS_MOUVEMENT)
    .eq('centre_id', centreId)
    .eq('produit_id', produitId)
    .order('fait_le', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return (data ?? []) as unknown as MouvementDetaille[];
}

export interface SaisieMouvement {
  centreId: string;
  produitId: string;
  sens: SensMouvement;
  quantite: number;
  motif: MotifMouvement;
  note?: string;
  auteur?: string;
}

export async function enregistrerMouvement(m: SaisieMouvement): Promise<void> {
  const { error } = await supabase.from('mouvements_stock').insert({
    centre_id: m.centreId,
    produit_id: m.produitId,
    sens: m.sens,
    quantite: m.quantite,
    motif: m.motif,
    note: m.note ?? '',
    auteur: m.auteur ?? '',
  });

  if (error) throw error;
}

/**
 * Inventaire : on saisit ce qu'on a compté, la base écrit l'écart comme un
 * mouvement. Renvoie cet écart (0 si le comptage tombait juste).
 */
export async function recalerStock(
  produitId: string,
  centreId: string,
  compte: number,
  note = '',
): Promise<number> {
  const { data, error } = await supabase.rpc('recaler_stock', {
    p_produit: produitId,
    p_centre: centreId,
    p_compte: compte,
    p_note: note,
  });

  if (error) throw error;
  return (data as number) ?? 0;
}

export async function definirSeuils(
  produitId: string,
  centreId: string,
  seuilBas: number,
  seuilCritique: number,
): Promise<void> {
  const { error } = await supabase.from('seuils_stock').upsert(
    {
      produit_id: produitId,
      centre_id: centreId,
      seuil_bas: seuilBas,
      seuil_critique: seuilCritique,
      maj_le: new Date().toISOString(),
    },
    { onConflict: 'produit_id,centre_id' },
  );

  if (error) throw error;
}
