import { supabase } from '../lib/supabase';
import type { Fourniture } from '../domain/courses';

/** Une ligne tapée à la main, hors catalogue. */
export interface CourseLibre {
  id: string;
  libelle: string;
  quantite: number;
  demandee_par: string | null;
}

export interface ListeDeCourses {
  centre_id: string;
  semaine: string;
  ouverte: boolean;
  validee_le: string | null;
  validee_par: string | null;
  commandee_le: string | null;
  catalogue: Fourniture[];
  libres: CourseLibre[];
}

export async function lireLaListe(centreId: string, semaine?: string): Promise<ListeDeCourses> {
  const { data, error } = await supabase.rpc('liste_de_courses', {
    p_centre_id: centreId,
    p_semaine: semaine ?? null,
  });
  if (error) throw error;
  return data as ListeDeCourses;
}

/** Cocher, ou changer la quantité. Zéro décoche. */
export async function cocher(centreId: string, fournitureId: string, quantite: number) {
  const { error } = await supabase.rpc('cocher_la_fourniture', {
    p_centre_id: centreId,
    p_fourniture_id: fournitureId,
    p_quantite: quantite,
  });
  if (error) throw error;
}

export async function ajouter(centreId: string, libelle: string, quantite = 1) {
  const { error } = await supabase.rpc('ajouter_une_course', {
    p_centre_id: centreId,
    p_libelle: libelle,
    p_quantite: quantite,
  });
  if (error) throw error;
}

export async function retirer(ligneId: string) {
  const { error } = await supabase.rpc('retirer_la_course', { p_ligne_id: ligneId });
  if (error) throw error;
}

/** Réservé à la direction, vérifié côté base. */
export async function valider(centreId: string, semaine: string, validee: boolean) {
  const { error } = await supabase.rpc('valider_la_liste', {
    p_centre_id: centreId,
    p_semaine: semaine,
    p_validee: validee,
  });
  if (error) throw error;
}

export async function marquerCommandee(centreId: string, semaine: string) {
  const { error } = await supabase.rpc('marquer_commandee', {
    p_centre_id: centreId,
    p_semaine: semaine,
  });
  if (error) throw error;
}
