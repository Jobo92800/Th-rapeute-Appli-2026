import { supabase } from '../lib/supabase';

export interface RapportHistorique {
  mode: 'simulation' | 'écriture';
  firebase: { clientes: number; pesees: number; mensurations: number; fiches_de_notes: number; exceptions: number };
  v2: { fiches_avec_cure: number };
  rapprochement: { par_telephone: number; par_nom: number; ambigues: number; sans_fiche_ou_sans_cure: number };
  a_reprendre: { clientes_reliees: number; seances: number; mensurations: number; notes: number; exceptions: number; cures_avec_nombre_de_seances: number };
  laisse_de_cote: {
    pesees_lues: number;
    pesees_sans_fiche: number;
    pesees_date_invalide: number;
    pesees_sans_poids_plausible: number;
    mensurations_sans_fiche: number;
  };
  ambigues: string[];
  ecrit: { seances: number; mensurations: number; notes: number; exceptions: number; cures_avec_nombre_de_seances: number };
  erreurs: string[];
}

/**
 * Reprise de l'historique de l'ancienne application. Sans « ecrire », la
 * fonction lit Firebase, rapproche, compte, et n'écrit rien.
 */
export async function reprendreHistoriqueV1(ecrire = false): Promise<RapportHistorique> {
  const { data, error } = await supabase.functions.invoke('importer-firebase', { body: { ecrire } });

  if (error) {
    const message = (data as { error?: string })?.error;
    throw new Error(message ?? "La reprise n'a pas pu être lancée.");
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);

  return data as RapportHistorique;
}
