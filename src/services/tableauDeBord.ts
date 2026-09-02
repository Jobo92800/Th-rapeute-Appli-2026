import { supabase } from '../lib/supabase';

/** Ce que renvoie la fonction tableau_de_bord, telle quelle. */
export interface LigneCentre {
  centre_id: string;
  centre: string;
  montant: number;
  nb: number;
}

export interface LigneTherapeute {
  therapeute_id: string | null;
  therapeute: string;
  centre_id: string;
  montant: number;
  nb: number;
}

export interface Vente {
  date: string;
  cliente_id: string;
  cliente: string;
  centre: string;
  therapeute: string;
  montant: number;
  numero: number;
}

export interface DonneesTableauDeBord {
  periode: {
    du: string;
    au: string;
    centre: string | null;
    du_precedent: string;
    au_precedent: string;
  };

  encaisse: {
    cures: number;
    complements: number;
    bilans: number;
    total: number;
    /** Encaissement de la période précédente, de même durée. */
    precedent: number;
    par_moyen: Array<{ moyen: string; montant: number; nb: number }>;
  };

  signe: {
    nb: number;
    montant: number;
    precedent: number;
    panier_moyen: number;
    panier_precedent: number;
    premieres: number;
    suivantes: number;
    par_mode: Array<{ mode: string; nb: number; montant: number }>;
  };

  activite: {
    seances: number;
    par_technologie: Array<{ technologie: string; nb: number }>;
    bilans: number;
    contrats_signes: number;
    nouvelles_clientes: number;
  };

  attendu: {
    reste: number;
    retard_montant: number;
    retard_nb: number;
    semaine_montant: number;
    semaine_nb: number;
  };

  empreinte: {
    profils: Array<{ code: string; nb: number }>;
    terrains: Array<{ code: string; nb: number }>;
  };

  parrainage: { marraines: number; a_poser: number };

  stock: {
    alertes: Array<{
      nom: string;
      centre_id: string;
      quantite: number;
      seuil_bas: number;
      seuil_critique: number;
    }>;
  };

  par_centre: LigneCentre[];
  par_therapeute: LigneTherapeute[];

  croise: {
    mois: string[];
    lignes: Array<{
      centre_id: string;
      centre: string;
      valeurs: Record<string, number>;
      total: number;
    }>;
  };

  dernieres_ventes: Vente[];

  mensuel: Array<{ mois: string; encaisse: number; signe: number }>;
}

/**
 * Tous les chiffres en un seul appel. La base vérifie elle-même que le
 * compte est bien celui de la direction : une thérapeute qui forcerait
 * l'adresse de la page n'obtiendrait rien.
 */
export async function lireTableauDeBord(
  centreId: string | null,
  du: string,
  au: string,
  therapeuteId: string | null = null,
): Promise<DonneesTableauDeBord> {
  const { data, error } = await supabase.rpc('tableau_de_bord', {
    p_centre: centreId,
    p_du: du,
    p_au: au,
    p_therapeute: therapeuteId,
  });

  if (error) throw error;
  return data as DonneesTableauDeBord;
}
