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
import { construireRecap, type DonneesRecap, type Proposition } from '../domain/recapitulatif';
import { bioPortraitEnBase64, recapEnBase64 } from './recapPdf';
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

/**
 * Range le BioPortrait seul et le dépose sur la fiche Airtable.
 *
 * Appelé à la fin de chaque bilan, quel que soit ce que la cliente décide.
 * Aucun mail ne part : c'est un document qu'on garde, pas un envoi. La
 * différence tient au champ Airtable visé — celui du récapitulatif porte
 * une date qui déclenche une automatisation, celui-ci non.
 *
 * L'échec ne remonte pas : un BioPortrait qui n'arrive pas dans le CRM ne
 * doit pas faire croire à la thérapeute que le bilan ne s'est pas
 * enregistré. La tâche reste en file et la synchro la reprendra.
 */
export async function rangerBioPortrait(args: {
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

  const { error } = await supabase.rpc('ranger_bioportrait', {
    p_bilan_id: args.bilanId,
    p_pdf: bioPortraitEnBase64(donnees),
  });
  if (error) throw error;
}

/**
 * Les deux mêmes gestes, pour un document déjà assemblé.
 *
 * Le Bio-Portrait Anti-Âge assemble ses données autrement (pas d'InBody,
 * pas de pourcentages, ses propres textes) mais dépose les mêmes PDF aux
 * mêmes endroits : la fiche Airtable, champ « BioPortrait » pour le
 * document gardé, « Récapitulatif BioPortrait » pour celui qui part par
 * mail.
 */
export async function rangerDocumentBioPortrait(bilanId: string, donnees: DonneesRecap): Promise<void> {
  const { error } = await supabase.rpc('ranger_bioportrait', {
    p_bilan_id: bilanId,
    p_pdf: bioPortraitEnBase64(donnees),
  });
  if (error) throw error;
}

export async function envoyerDocumentRecap(bilanId: string, donnees: DonneesRecap): Promise<void> {
  const { error } = await supabase.rpc('demander_recap', {
    p_bilan_id: bilanId,
    p_pdf: recapEnBase64(donnees),
  });
  if (error) throw error;
}

/** Redépose le BioPortrait déjà établi, à l'identique. */
export async function redeposerBioPortrait(bilanId: string): Promise<void> {
  const { error } = await supabase.rpc('ranger_bioportrait', {
    p_bilan_id: bilanId,
    p_pdf: null,
  });
  if (error) throw error;
}
