import { supabase } from '../lib/supabase';

/*
  Les comptes de connexion des thérapeutes. Direction seule, des deux côtés :
  la fonction SQL refuse de répondre à quelqu'un d'autre, la fonction Edge
  refuse d'agir. L'écran ne fait que cacher un menu — ce n'est pas une
  protection, c'est une politesse.
*/

export interface EtatCompte {
  therapeute_id: string;
  prenom: string;
  nom: string | null;
  email: string | null;
  centre_id: string | null;
  centre_nom: string | null;
  role: 'therapeute' | 'direction';
  actif: boolean;
  a_un_compte: boolean;
  email_confirme: boolean;
  derniere_connexion: string | null;
  /** « ok », ou la phrase qui dit ce qui bloque et quoi faire. */
  diagnostic: string;
}

export async function etatDesComptes(): Promise<EtatCompte[]> {
  const { data, error } = await supabase.rpc('etat_des_comptes');
  if (error) throw error;
  return (data ?? []) as EtatCompte[];
}

/** Le plancher, redit ici pour que l'écran puisse prévenir avant l'envoi. */
export const MOT_DE_PASSE_MIN = 8;

/**
 * Change le mot de passe d'une thérapeute.
 *
 * Le mot de passe traverse cette fonction et n'est écrit nulle part : ni
 * journal, ni base, ni Airtable. Il est dicté à la thérapeute, elle le
 * change ensuite si elle veut.
 */
export async function changerLeMotDePasse(
  therapeuteId: string,
  motDePasse: string,
): Promise<{ prenom: string }> {
  const { data, error } = await supabase.functions.invoke('gerer-les-comptes', {
    body: { therapeuteId, motDePasse },
  });

  const reponse = data as { ok?: boolean; prenom?: string; error?: string } | null;

  if (error || !reponse?.ok) {
    throw new Error(reponse?.error ?? "Le mot de passe n'a pas pu être changé.");
  }
  return { prenom: reponse.prenom ?? '' };
}

/**
 * Son propre mot de passe. Pas besoin de la clé de service pour ça : Supabase
 * accepte qu'une personne connectée change le sien, et c'est tout ce qu'elle
 * peut changer.
 */
export async function changerMonMotDePasse(motDePasse: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) throw new Error(error.message);
}

/**
 * Retirer une thérapeute du service, ou l'y remettre.
 *
 * On désactive, on ne supprime pas — et ce n'est pas de la prudence de
 * principe : dix tables portent son identifiant, dont les séances, les
 * bilans, les contrats et les mouvements de stock. « Qui a réalisé cette
 * séance » est une information qui compte, et la base refuserait de toute
 * façon d'effacer quelqu'un qui a travaillé.
 *
 * Une fiche inactive ne se propose plus nulle part, et son compte ne mène
 * plus à rien : la connexion réussit, l'application ne trouve personne
 * derrière. Le geste se défait d'un clic.
 */
export async function changerLActivite(therapeuteId: string, actif: boolean): Promise<void> {
  const { error } = await supabase.from('therapeutes').update({ actif }).eq('id', therapeuteId);
  if (error) throw error;
}
