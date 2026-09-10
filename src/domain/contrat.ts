/*
  Données du contrat de prestation.

  La forme du document est celle de l'ancienne application — c'est un texte
  juridique validé. Ce qui change, c'est la source : le contrat se construit
  désormais à partir du programme et de ses échéances, et non d'un règlement
  saisi à la main.
*/

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Centre, Cliente, Echeance, LigneProgramme, Programme } from '../types/db';
import type { Technologie } from './tarification';
import { pourPdf } from './texte';

export interface ContractCareItem {
  label: string;
  sessions: number;
  checked: boolean;
}

export interface ContractInstallment {
  label: string;
  amount: string;
  date: string;
  method: string;
}

export interface ContractData {
  /** « Madame » ou « Monsieur », en toutes lettres sur le contrat. */
  clientCivility: string;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  clientPostalCode: string;
  clientCity: string;

  centerName: string;
  centerAddress: string;
  centerPostalCode: string;
  centerCity: string;
  centerPhone: string;
  centerEmail: string;
  centerSocietyName: string;
  centerSiren: string;
  siegeSocialAddress: string;
  siegeSocialPostalCode: string;
  siegeSocialCity: string;

  cgvSocietyName: string;
  cgvSiren: string;

  signatureDate: string;
  signatureCity: string;

  careItems: ContractCareItem[];
  /**
   * Séances gagnées par parrainage, ajoutées à la cure sans supplément.
   * Elles figurent au contrat pour que la cliente en ait la trace écrite,
   * mais elles n'entrent dans aucun montant.
   */
  offeredSessions: number;
  offeredLabel: string;
  /** Technologies réellement prescrites : elles pilotent les consentements. */
  activeServiceIds: string[];
  totalAmount: string;
  installmentCount: number;
  deposit: ContractInstallment | null;
  /**
   * Le bilan réglé en ligne avant la venue, s'il y en a eu un.
   *
   * Il figure au contrat parce que sans lui les comptes ne tombent pas :
   * le montant total inclut ces 129 €, mais les échéances à venir ne les
   * réclament plus. Une cliente qui additionne ses chèques doit retrouver
   * le total, sinon le document est faux à ses yeux — et il le serait.
   */
  bilanRegle: ContractInstallment | null;
  installments: ContractInstallment[];
  /**
   * Réglée par Alma, donc **sans échéancier au contrat**.
   *
   * Deux contrats se signent ce jour-là, et ils ne disent pas la même
   * chose. Celui-ci engage le centre et la cliente sur une prestation et
   * sur un prix. Le calendrier des prélèvements, lui, appartient au contrat
   * de crédit qu'elle signe avec Alma : c'est lui qui fait foi, c'est lui
   * qu'elle recevra, et c'est Alma qui prélèvera.
   *
   * Recopier ce calendrier ici, c'était promettre deux fois la même chose
   * dans deux documents qui peuvent diverger — un report de prélèvement
   * accordé par Alma, et le contrat du centre devient faux.
   */
  almaSansEcheancier: boolean;
  /** « 10 fois par carte via Alma », quand c'est le cas. */
  almaLibelle: string;
}

/** Les lignes du contrat, dans l'ordre où elles figurent à l'article 1. */
const LIGNES_CONTRAT: Array<{ label: string; technologies: Technologie[] }> = [
  { label: 'Electrostimulation', technologies: ['ishape'] },
  { label: 'Luxothérapie', technologies: ['luxo'] },
  { label: 'Luxothérapie Relaxation', technologies: ['relax'] },
  { label: 'Pressodynamie', technologies: ['presso'] },
  { label: 'Dôme', technologies: ['dome'] },
];

/** Technologie → consentement à faire signer. Le Dôme n'en a pas. */
/*
  La Relaxation est de la luxothérapie : c'est le même appareil, le même
  consentement. Elle ne fait donc pas signer un document de plus.
*/
export const CONSENTEMENT_PAR_TECHNOLOGIE: Partial<Record<Technologie, string>> = {
  luxo: 'luxo-pdp',
  relax: 'luxo-pdp',
  ishape: 'ishape',
  presso: 'presso',
};

const LIBELLE_MOYEN: Record<string, string> = {
  cheque: 'Chèque',
  especes: 'Espèces',
  cb: 'Carte bancaire',
  virement: 'Virement',
  alma: 'Alma',
};

function euros(n: number): string {
  /*
    `pourPdf` n'est pas cosmétique : sans lui, le séparateur de milliers du
    français s'imprime « / » dans le contrat, et toute cure à quatre chiffres
    part à la signature avec « 1 / 977 € » écrit dessus.
  */
  return pourPdf(
    Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
  );
}

function jour(d: string | null): string {
  if (!d) return '';
  try {
    return format(new Date(d), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return d;
  }
}

export function construireContrat(args: {
  cliente: Cliente;
  centre: Centre;
  programme: Programme;
  lignes: LigneProgramme[];
  echeances: Echeance[];
}): ContractData {
  const { cliente, centre, programme, lignes, echeances } = args;

  const parTechno = new Map(lignes.map((l) => [l.technologie, l.seances_prevues]));

  const careItems: ContractCareItem[] = LIGNES_CONTRAT.map((ligne) => {
    const seances = ligne.technologies.reduce((n, t) => n + (parTechno.get(t) ?? 0), 0);
    return { label: ligne.label, sessions: seances, checked: seances > 0 };
  });

  // Les séances offertes, et le soin sur lequel elles ont été posées.
  const offertes = lignes.filter((l) => (l.seances_offertes ?? 0) > 0);
  const offeredSessions = offertes.reduce((n, l) => n + (l.seances_offertes ?? 0), 0);
  const offeredLabel = offertes
    .map((l) => LIGNES_CONTRAT.find((c) => c.technologies.includes(l.technologie))?.label ?? '')
    .filter(Boolean)
    .join(', ');

  const activeServiceIds = lignes
    .filter((l) => l.seances_prevues > 0)
    .map((l) => CONSENTEMENT_PAR_TECHNOLOGIE[l.technologie])
    .filter((id): id is string => Boolean(id));

  /*
    Chez Alma, le contrat de prestation dit le prix et s'arrête là : le
    calendrier des prélèvements est celui du contrat de crédit qu'elle signe
    avec l'organisme.
  */
  const alma = programme.mode_reglement.startsWith('alma');

  const acompte = echeances.find((e) => e.type === 'acompte') ?? null;
  const bilanRegle = echeances.find((e) => e.type === 'bilan') ?? null;
  const suite = echeances
    .filter((e) => e.type === 'echeance')
    .sort((a, b) => a.rang - b.rang);

  return {
    clientCivility: cliente.civilite === 'M.' ? 'Monsieur' : 'Madame',
    clientFirstName: cliente.prenom,
    clientLastName: cliente.nom,
    clientPhone: cliente.telephone ?? '',
    clientEmail: cliente.email ?? '',
    clientAddress: cliente.adresse ?? '',
    clientPostalCode: cliente.code_postal ?? '',
    clientCity: cliente.ville ?? '',

    centerName: centre.nom,
    centerAddress: centre.adresse,
    centerPostalCode: centre.code_postal,
    centerCity: centre.ville,
    centerPhone: centre.telephone,
    centerEmail: centre.email,
    centerSocietyName: centre.societe,
    centerSiren: centre.siren,
    siegeSocialAddress: centre.siege_adresse,
    siegeSocialPostalCode: centre.siege_code_postal,
    siegeSocialCity: centre.siege_ville,

    cgvSocietyName: centre.societe,
    cgvSiren: centre.siren.replace(/\s/g, ''),

    signatureDate: format(new Date(), 'dd MMMM yyyy', { locale: fr }),
    signatureCity: centre.ville,

    careItems,
    offeredSessions,
    offeredLabel,
    activeServiceIds: [...new Set(activeServiceIds)],
    /*
      LE CONTRAT DIT LE PRIX DE LA CURE, PAS LE COÛT DU CRÉDIT.

      Ce document engage MAbeautyplus et la cliente sur une prestation et
      son prix. Les frais Alma ne rémunèrent aucune prestation du centre :
      ils sont le coût du crédit qu'elle contracte auprès d'un organisme, et
      ils figurent sur le contrat qu'elle signe avec lui. Les faire
      apparaître ici gonflerait le prix de la cure de quelque chose que le
      centre ne vend pas et n'encaisse pas.

      Ailleurs, ils comptent : « Montant Cure » dans Airtable porte ce
      qu'elle règle en tout, frais compris, parce que c'est ce que les
      relances doivent annoncer.
    */
    totalAmount: euros(
      alma
        ? Number(programme.montant_total)
        : Number(programme.montant_total) + Number(programme.frais_financement),
    ),
    installmentCount: alma ? suite.length : (acompte ? 1 : 0) + suite.length,
    bilanRegle: bilanRegle
      ? {
          label: 'Bilan réglé en ligne',
          amount: euros(Number(bilanRegle.montant)),
          date: jour(bilanRegle.date_prevue),
          method: LIBELLE_MOYEN[bilanRegle.moyen ?? ''] ?? '',
        }
      : null,
    deposit: acompte
      ? {
          label: 'Acompte',
          amount: euros(Number(acompte.montant)),
          date: jour(acompte.date_prevue),
          method: LIBELLE_MOYEN[acompte.moyen ?? ''] ?? '',
        }
      : null,
    installments: alma
      ? []
      : suite.map((e, i) => ({
          label: `Échéance ${i + 1}`,
          amount: euros(Number(e.montant)),
          date: jour(e.date_prevue),
          method: LIBELLE_MOYEN[e.moyen ?? ''] ?? '',
        })),
    almaSansEcheancier: alma,
    almaLibelle: alma ? `${suite.length} fois par carte, via Alma` : '',
  };
}

/** Les quatre engagements à cocher avant de signer. */
export const ENGAGEMENTS = [
  'Je reconnais avoir pris connaissance du contrat et des modalités financières du forfait souscrit.',
  "J'ai reçu toutes les informations nécessaires avant la signature et j'ai pu poser l'ensemble de mes questions.",
  "J'ai été informé(e) de mon droit légal de rétractation de 14 jours (articles L221-18 et suivants du Code de la consommation).",
  "J'ai pris connaissance et j'accepte les Conditions Générales de Vente remises préalablement à la signature.",
];
