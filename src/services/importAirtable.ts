import { supabase } from '../lib/supabase';

export interface RapportImport {
  simulation: boolean;
  fiches: { lues: number; a_creer: number; deja_presentes: number; ecartees: number };
  cures: { a_creer: number; montant_total: number };
  anomalies: {
    deja_presentes: number;
    sans_nom: number;
    sans_centre: number;
    centre_inconnu: string[];
    sans_cure: number;
    sans_therapeute: number;
    sans_telephone: number;
    age_recalcule: number;
  };
  creees: { fiches: number; cures: number };
  erreurs: string[];
}

/**
 * Reprise des fiches du CRM. Sans « ecrire », rien n'est écrit : la fonction
 * compte et rapporte. C'est le mode par défaut, et le seul raisonnable tant
 * qu'on n'a pas regardé le décompte.
 */
export async function reprendreFichesAirtable(ecrire = false): Promise<RapportImport> {
  const { data, error } = await supabase.functions.invoke('importer-airtable', {
    body: { ecrire },
  });

  if (error) {
    const message = (data as { error?: string })?.error;
    throw new Error(message ?? "La reprise n'a pas pu être lancée.");
  }

  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error);
  }

  return data as RapportImport;
}
