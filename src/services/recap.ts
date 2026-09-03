/*
  L'envoi du récapitulatif BioPortrait.

  L'application ne parle à aucun service d'emailing : elle dépose le PDF sur
  la fiche Airtable, et c'est une automatisation Airtable qui envoie le mail
  depuis l'adresse du centre. Une brique de moins à surveiller, et les
  réponses des clientes arrivent dans la vraie boîte plutôt que dans un
  no-reply.
*/

import { supabase } from '../lib/supabase';
import type { Bareme, BioPortrait, MesureInbody } from '../domain/bioportrait';
import { construireRecap, type Proposition } from '../domain/recapitulatif';
import { recapEnBase64 } from './recapPdf';
import type { Centre } from '../types/db';

/**
 * Fabrique le récapitulatif et le met en file vers Airtable.
 *
 * Le PDF est fabriqué ici, dans le navigateur, avec ce que la thérapeute a
 * réellement montré à la cliente — pas avec une prescription recalculée.
 */
export async function envoyerRecap(args: {
  bilanId: string;
  bareme: Bareme;
  bioportrait: BioPortrait;
  inbody: MesureInbody[];
  proposition: Proposition;
  cliente: { civilite: string; prenom: string; nom: string };
  centre: Centre;
  dateBilan: string;
}): Promise<void> {
  const donnees = construireRecap({
    bareme: args.bareme,
    bioportrait: args.bioportrait,
    inbody: args.inbody,
    proposition: args.proposition,
    cliente: args.cliente,
    centre: {
      nom: args.centre.nom,
      adresse: args.centre.adresse,
      codePostal: args.centre.code_postal,
      ville: args.centre.ville,
      telephone: args.centre.telephone,
      email: args.centre.email,
    },
    dateBilan: args.dateBilan,
  });

  const { error } = await supabase.rpc('demander_recap', {
    p_bilan_id: args.bilanId,
    p_pdf: recapEnBase64(donnees),
  });
  if (error) throw error;
}

/**
 * Renvoie le récapitulatif déjà établi, à l'identique.
 *
 * On ne le refabrique pas : la cliente doit recevoir le document qu'on lui a
 * envoyé, pas une version recalculée depuis. Les prix ont pu changer entre
 * les deux.
 */
export async function renvoyerRecap(bilanId: string): Promise<void> {
  const { error } = await supabase.rpc('demander_recap', {
    p_bilan_id: bilanId,
    p_pdf: null,
  });
  if (error) throw error;
}
