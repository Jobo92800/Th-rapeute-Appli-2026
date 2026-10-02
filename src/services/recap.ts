/*
  L'envoi du récapitulatif BioPortrait.

  L'application ne parle à aucun service d'emailing : elle dépose le PDF sur
  la fiche Airtable, et c'est une automatisation Airtable qui envoie le mail
  depuis l'adresse du centre. Une brique de moins à surveiller, et les
  réponses des clientes arrivent dans la vraie boîte plutôt que dans un
  no-reply.
*/

import { supabase } from '../lib/supabase';
import { declencherSynchro } from './metier';
import type { Bareme, BioPortrait, MesureInbody } from '../domain/bioportrait';
import {
  construireRecap,
  construireRestitution,
  type DonneesRecap,
  type Proposition,
} from '../domain/recapitulatif';
import { bioPortraitEnBase64, recapEnBase64 } from './recapPdf';
import { restitutionEnBase64 } from './restitutionPdf';
import type { Reponses } from '../domain/bioportrait';
import type { Centre } from '../types/db';

/*
  LE DOCUMENT DE LA PERTE DE POIDS A CHANGÉ DE FORME (2 octobre 2026).

  Il tient maintenant en quatre pages qui racontent : ce qu'elle est, ce que
  cela explique, le programme qui en découle, et ce qu'elle règle. Les deux
  bilans anti-âge gardent l'ancienne mise en page — le paquet de contenus ne
  les couvre pas, et leur inventer des textes serait pire que l'ancien
  document.

  Le choix se fait sur une seule chose : le barème porte-t-il de quoi écrire
  la restitution ? Les barèmes 1 et 2, et ceux de l'anti-âge, ne l'ont pas —
  un bilan ancien ressort donc exactement comme avant, ce qui est la seule
  façon honnête de le ressortir.
*/
function peutRestituer(args: { bareme: Bareme; reponses?: Reponses }): boolean {
  return Boolean(args.bareme.RESTITUTION && args.reponses);
}

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
  /** Les réponses du bilan : sans elles, pas de tableau de composition. */
  reponses?: Reponses;
  /** Le prix du bilan, déduit dès qu'elle démarre. Jamais écrit en dur. */
  prixBilan?: number;
}): Promise<void> {
  const centre = {
    nom: args.centre.nom,
    adresse: args.centre.adresse,
    codePostal: args.centre.code_postal,
    ville: args.centre.ville,
    telephone: args.centre.telephone,
    email: args.centre.email,
  };

  /*
    Celle qui ne démarre pas reçoit les QUATRE pages : le prix et
    l'échéancier font partie de ce qu'elle doit pouvoir relire à tête
    reposée — c'est même ce qu'elle relira d'abord.
  */
  const pdf = peutRestituer(args)
    ? restitutionEnBase64(
        construireRestitution({
          bareme: args.bareme,
          bioportrait: args.bioportrait,
          reponses: args.reponses!,
          proposition: args.proposition,
          cliente: args.cliente,
          centre,
          dateBilan: args.dateBilan,
          prixBilan: args.prixBilan ?? 0,
          pages: 4,
        }),
      )
    : recapEnBase64(
        construireRecap({
          bareme: args.bareme,
          bioportrait: args.bioportrait,
          inbody: args.inbody,
          proposition: args.proposition,
          cliente: args.cliente,
          centre,
          dateBilan: args.dateBilan,
        }),
      );

  const { error } = await supabase.rpc('demander_recap', {
    p_bilan_id: args.bilanId,
    p_pdf: pdf,
  });
  if (error) throw error;
  /*
    La synchro repart tout de suite : sans ça, un PDF mis en file après le
    départ de la synchro lancée par l'enregistrement du bilan attendait le
    prochain geste dans l'application — parfois plusieurs minutes.
  */
  declencherSynchro();
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
  declencherSynchro(); // voir envoyerRecap
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
  reponses?: Reponses;
  prixBilan?: number;
}): Promise<void> {
  const centre = {
    nom: args.centre.nom,
    adresse: args.centre.adresse,
    codePostal: args.centre.code_postal,
    ville: args.centre.ville,
    telephone: args.centre.telephone,
    email: args.centre.email,
  };

  /*
    TROIS PAGES, PAS QUATRE (Jonathan, 2 octobre 2026).

    Ce document-ci part avec le contrat, et le contrat porte déjà le prix et
    l'échéancier. Surtout, il reste au dossier : on le ressort six mois plus
    tard, et un tarif imprimé dessus serait faux ce jour-là. Elle garde donc
    son diagnostic et son programme, pas son devis.
  */
  const pdf = peutRestituer(args)
    ? restitutionEnBase64(
        construireRestitution({
          bareme: args.bareme,
          bioportrait: args.bioportrait,
          reponses: args.reponses!,
          proposition: args.proposition,
          cliente: args.cliente,
          centre,
          dateBilan: args.dateBilan,
          prixBilan: args.prixBilan ?? 0,
          pages: 3,
        }),
      )
    : bioPortraitEnBase64(
        construireRecap({
          bareme: args.bareme,
          bioportrait: args.bioportrait,
          inbody: args.inbody,
          proposition: args.proposition,
          cliente: args.cliente,
          centre,
          dateBilan: args.dateBilan,
        }),
      );

  const { error } = await supabase.rpc('ranger_bioportrait', {
    p_bilan_id: args.bilanId,
    p_pdf: pdf,
  });
  if (error) throw error;
  declencherSynchro(); // voir envoyerRecap
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
  declencherSynchro(); // voir envoyerRecap
}

export async function envoyerDocumentRecap(bilanId: string, donnees: DonneesRecap): Promise<void> {
  const { error } = await supabase.rpc('demander_recap', {
    p_bilan_id: bilanId,
    p_pdf: recapEnBase64(donnees),
  });
  if (error) throw error;
  declencherSynchro(); // voir envoyerRecap
}

/** Redépose le BioPortrait déjà établi, à l'identique. */
export async function redeposerBioPortrait(bilanId: string): Promise<void> {
  const { error } = await supabase.rpc('ranger_bioportrait', {
    p_bilan_id: bilanId,
    p_pdf: null,
  });
  if (error) throw error;
  declencherSynchro(); // voir envoyerRecap
}
