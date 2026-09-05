/*
  Le carnet de liaison, côté données.

  L'envoi d'une annonce et le dépôt d'un signalement passent par des
  fonctions en base : ni l'un ni l'autre ne tient en une seule écriture, et
  c'est la base qui sait qui est la direction. Le reste — lire, marquer lu,
  faire avancer un statut — passe par les tables, où les règles de sécurité
  disent déjà qui a le droit de quoi.
*/

import { supabase } from '../lib/supabase';
import type { Destinataire, Message, StatutMessage } from '../domain/messages';

export interface MessageComplet {
  message: Message;
  destinataires: Destinataire[];
}

/** Ce que le compte connecté a le droit de voir, du plus récent au plus ancien. */
export async function lireMessages(): Promise<MessageComplet[]> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .order('cree_le', { ascending: false });

  if (error) throw error;
  const liste = (messages ?? []) as Message[];
  if (liste.length === 0) return [];

  /*
    Le prénom vient avec, en une seule requête : sans lui, la direction lit
    « 9 sur 13 » sans savoir de qui il s'agit.

    L'erreur de cette requête-là se remonte comme l'autre. La laisser tomber
    était le vrai défaut : quand les règles de lecture se sont mises à
    tourner en rond, l'écran s'est affiché vide au lieu de le dire.
  */
  const { data: dest, error: erreurDest } = await supabase
    .from('messages_destinataires')
    .select('message_id, therapeute_id, lu_le, therapeutes(prenom)')
    .in(
      'message_id',
      liste.map((m) => m.id),
    );

  if (erreurDest) throw erreurDest;

  const parMessage = ((dest ?? []) as Array<Record<string, unknown>>).map((d) => ({
    message_id: d.message_id as string,
    therapeute_id: d.therapeute_id as string,
    lu_le: (d.lu_le as string | null) ?? null,
    prenom: (d.therapeutes as { prenom?: string } | null)?.prenom,
  })) as Destinataire[];
  return liste.map((message) => ({
    message,
    destinataires: parMessage.filter((d) => d.message_id === message.id),
  }));
}

/** Les prénoms à qui la direction peut adresser une annonce. */
export interface DestinatairePossible {
  id: string;
  prenom: string;
  centre_id: string | null;
  centre: string;
}

export async function therapeutesJoignables(): Promise<DestinatairePossible[]> {
  const { data, error } = await supabase
    .from('therapeutes')
    .select('id, prenom, centre_id, centres(nom)')
    .eq('actif', true)
    .eq('role', 'therapeute')
    .order('centre_id')
    .order('ordre');

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((t) => ({
    id: t.id as string,
    prenom: t.prenom as string,
    centre_id: (t.centre_id as string | null) ?? null,
    centre: ((t.centres as { nom?: string } | null)?.nom ?? '—') as string,
  }));
}

export async function envoyerAnnonce(
  sujet: string,
  corps: string,
  destinataires: string[],
): Promise<void> {
  const { error } = await supabase.rpc('envoyer_annonce', {
    p_sujet: sujet,
    p_corps: corps,
    p_destinataires: destinataires,
  });
  if (error) throw error;
}

export async function deposerSignalement(sujet: string, corps: string): Promise<void> {
  const { error } = await supabase.rpc('deposer_signalement', {
    p_sujet: sujet,
    p_corps: corps,
  });
  if (error) throw error;
}

/**
 * Marque une annonce comme lue.
 *
 * Sans effet si elle l'était déjà : c'est la première lecture qui compte,
 * pas la dernière — la direction veut savoir quand le message est passé.
 */
export async function marquerLu(messageId: string, therapeuteId: string): Promise<void> {
  const { error } = await supabase
    .from('messages_destinataires')
    .update({ lu_le: new Date().toISOString() })
    .eq('message_id', messageId)
    .eq('therapeute_id', therapeuteId)
    .is('lu_le', null);
  if (error) throw error;
}

export async function changerStatut(messageId: string, statut: StatutMessage): Promise<void> {
  const { error } = await supabase.from('messages').update({ statut }).eq('id', messageId);
  if (error) throw error;
}

export async function repondre(messageId: string, reponse: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ reponse, repondu_le: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function supprimerMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', messageId);
  if (error) throw error;
}

export interface EnAttente {
  annonces_non_lues: number;
  signalements_a_traiter: number;
}

/** Le compteur de la pastille du menu. */
export async function messagesEnAttente(): Promise<EnAttente> {
  const { data, error } = await supabase.rpc('messages_en_attente');
  if (error) throw error;
  const l = ((data ?? []) as EnAttente[])[0];
  return l ?? { annonces_non_lues: 0, signalements_a_traiter: 0 };
}
