import { supabase } from '../lib/supabase';
import type { CategorieDeFourniture, FournitureDuCatalogue } from '../domain/fournitures';

/** Un produit tapé à la main qui revient : candidat au catalogue. */
export interface CourseAPromouvoir {
  libelle: string;
  /** Combien de fois demandé, tous centres confondus, sur six mois. */
  demandes: number;
  centres: string[];
  /** Demandé cette semaine : la promotion rattachera la demande en cours. */
  en_cours: boolean;
}

export interface Catalogue {
  fournitures: FournitureDuCatalogue[];
  a_promouvoir: CourseAPromouvoir[];
  centres: Array<{ id: string; nom: string }>;
}

/** Réservé à la direction, vérifié côté base. */
export async function lireLeCatalogue(): Promise<Catalogue> {
  const { data, error } = await supabase.rpc('catalogue_des_fournitures');
  if (error) throw error;
  return data as Catalogue;
}

export interface FournitureAEnregistrer {
  /** Null pour une création. */
  id: string | null;
  nom: string;
  categorie: CategorieDeFourniture;
  unite: string;
  liens: string[];
  /** Null = tous les centres. */
  centres: string[] | null;
  actif: boolean;
}

export async function enregistrerLaFourniture(f: FournitureAEnregistrer): Promise<string> {
  const { data, error } = await supabase.rpc('enregistrer_la_fourniture', {
    p_id: f.id,
    p_nom: f.nom,
    p_categorie: f.categorie,
    p_unite: f.unite,
    p_liens: f.liens,
    p_centres: f.centres,
    p_actif: f.actif,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Faire entrer au catalogue un produit tapé à la main. Les demandes de la
 * semaine en cours suivent le produit créé.
 */
export async function promouvoirLaCourse(
  libelle: string,
  categorie: CategorieDeFourniture = 'autre',
  unite = 'unité',
  liens: string[] = [],
  centres: string[] | null = null,
): Promise<string> {
  const { data, error } = await supabase.rpc('promouvoir_la_course', {
    p_libelle: libelle,
    p_categorie: categorie,
    p_unite: unite,
    p_liens: liens,
    p_centres: centres,
  });
  if (error) throw error;
  return data as string;
}
