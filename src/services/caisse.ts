import { supabase } from '../lib/supabase';
import type { LigneDeReglement } from '../domain/caisse';

/*
  Tout ce qu'il faut pour composer un ticket Z, en un seul appel. La base
  vérifie elle-même que le compte est celui de la direction : une
  thérapeute qui forcerait l'adresse de la page n'obtiendrait rien.
*/
export interface RestantDuCentre {
  centre_id: string;
  nb: number;
  montant: number;
}

export interface BilanSeul {
  centre_id: string;
  cliente: string;
  montant: number;
  date: string;
}

export interface VenteDeComplement {
  centre_id: string;
  cliente: string;
  produit: string;
  quantite: number;
  montant: number;
  date: string;
}

export interface ActiviteDuCentre {
  centre_id: string;
  seances: number;
  bilans: number;
  cures: number;
  signe: number;
}

export interface DonneesTicketZ {
  du: string;
  au: string;
  centres: Array<{ id: string; nom: string }>;
  reglements: LigneDeReglement[];
  restant: RestantDuCentre[];
  bilans_seuls: BilanSeul[];
  complements: VenteDeComplement[];
  activite: ActiviteDuCentre[];
}

export async function lireTicketZ(du: string, au: string): Promise<DonneesTicketZ> {
  const { data, error } = await supabase.rpc('ticket_z', { p_du: du, p_au: au });
  if (error) throw error;
  return data as DonneesTicketZ;
}
