/*
  Le récapitulatif remis à une cliente qui veut réfléchir.

  Elle est repartie sans signer. Trois jours plus tard, il ne lui reste qu'une
  impression : « c'était bien, mais c'était cher ». Ce document lui redonne ce
  qu'on lui a dit — son profil, son terrain, ce que l'InBody a montré, la cure
  proposée et son prix.

  Ce module n'imprime rien : il assemble et il met en forme. Le rendu PDF est
  dans `services/recapPdf`, et le texte du mail est écrit dans Airtable.
*/

import { SEUIL_PRESENCE, type Axe, type Bareme, type BioPortrait, type MesureInbody } from './bioportrait';
import { LIBELLES_TECHNOLOGIE, formaterEuros } from './tarification';
import type { ModeReglement, Technologie } from '../types/db';

/**
 * La cure telle qu'elle a été présentée. C'est la forme rangée dans
 * `bilans.proposition` : elle ne se recalcule pas, puisque la thérapeute
 * ajuste les séances et choisit la formule.
 */
export interface Proposition {
  lignes: Array<{ technologie: Technologie; seances: number; prixUnitaire: number }>;
  guide: boolean;
  tenue: boolean;
  prixGuide: number;
  prixTenue: number;
  montantTotal: number;
  modeReglement: ModeReglement;
  frais: number;
  echeances: Array<{ rang: number; montant: number }>;
}

export interface AxeRecap {
  nom: string;
  signature: string;
  pourcentage: number;
  texte: string;
  impacts: string[];
}

export interface DonneesRecap {
  civilite: string;
  prenom: string;
  nom: string;
  dateBilan: string;
  centre: {
    nom: string;
    adresse: string;
    codePostal: string;
    ville: string;
    telephone: string;
    email: string;
  };
  profil: AxeRecap;
  terrain: AxeRecap;
  /** Les axes secondaires réellement présents, sans les bruits de fond. */
  aussiPresents: Array<{ nom: string; pourcentage: number }>;
  inbody: MesureInbody[];
  soins: Array<{ libelle: string; seances: number; montant: number }>;
  options: Array<{ libelle: string; montant: number }>;
  totalSeances: number;
  montantTotal: number;
  /** Ce que la cliente règle, frais de financement compris. */
  montantRegle: number;
  reglement: string;
  echeances: Array<{ rang: number; montant: number }>;
  inclus: Array<{ titre: string; detail: string }>;
}

/**
 * Les textes du barème portent des balises HTML : elles font le gras à
 * l'écran, et s'imprimeraient telles quelles dans un PDF. On les retire, et
 * on remet les entités que le barème pourrait contenir.
 */
export function sansBalises(texte: string): string {
  return texte
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const LIBELLE_REGLEMENT: Record<string, string> = {
  comptant: 'En une fois, sans frais',
  centre_2x: 'Au centre, en 2 fois sans frais',
  centre_3x: 'Au centre, en 3 fois sans frais',
  centre_4x: 'Au centre, en 4 fois sans frais',
  alma_2x: 'Par carte, en 2 fois via Alma',
  alma_3x: 'Par carte, en 3 fois via Alma',
  alma_4x: 'Par carte, en 4 fois via Alma',
  alma_10x: 'Par carte, en 10 fois via Alma',
  alma_12x: 'Par carte, en 12 fois via Alma',
  '4x_maison': 'Au centre, en 4 fois sans frais',
  '10x_alma': 'Par carte, en 10 fois via Alma',
  inconnu: 'À définir ensemble',
};

function axeRecap(bareme: Bareme, axe: Axe, pourcentage: number): AxeRecap {
  const a = bareme.AX[axe];
  return {
    nom: a.name,
    signature: sansBalises(a.sig),
    pourcentage,
    texte: sansBalises(a.feel),
    impacts: a.imp.map(sansBalises),
  };
}

export function construireRecap(args: {
  bareme: Bareme;
  bioportrait: BioPortrait;
  inbody: MesureInbody[];
  proposition: Proposition;
  cliente: { civilite: string; prenom: string; nom: string };
  centre: DonneesRecap['centre'];
  dateBilan: string;
}): DonneesRecap {
  const { bareme, bioportrait: bp, proposition: p } = args;

  const soins = p.lignes
    .filter((l) => l.seances > 0)
    .map((l) => ({
      libelle: LIBELLES_TECHNOLOGIE[l.technologie] ?? l.technologie,
      seances: l.seances,
      montant: l.seances * Number(l.prixUnitaire),
    }));

  const options: Array<{ libelle: string; montant: number }> = [];
  if (p.guide && Number(p.prixGuide) > 0) {
    options.push({ libelle: 'Guide de rééquilibrage alimentaire', montant: Number(p.prixGuide) });
  }
  if (p.tenue && Number(p.prixTenue) > 0) {
    options.push({ libelle: 'Tenue I-Shape', montant: Number(p.prixTenue) });
  }

  /*
    « Aussi présent » ne veut pas dire « deuxième du classement » : un axe à
    30 % n'est pas présent, il est en fond. On ne retient que ce qui dépasse
    le seuil, sinon le document annonce à la cliente des traits qu'elle n'a
    pas.
  */
  const aussiPresents = [...bp.profilsTries.slice(1), ...bp.terrainsTries.slice(1)]
    .filter((a) => bp.pourcentages[a] >= SEUIL_PRESENCE)
    .map((a) => ({ nom: bareme.AX[a].name, pourcentage: bp.pourcentages[a] }));

  return {
    civilite: args.cliente.civilite,
    prenom: args.cliente.prenom,
    nom: args.cliente.nom,
    dateBilan: args.dateBilan,
    centre: args.centre,
    profil: axeRecap(bareme, bp.profilDominant, bp.pourcentages[bp.profilDominant]),
    terrain: axeRecap(bareme, bp.terrainDominant, bp.pourcentages[bp.terrainDominant]),
    aussiPresents,
    inbody: args.inbody,
    soins,
    options,
    totalSeances: soins.reduce((n, s) => n + s.seances, 0),
    montantTotal: Number(p.montantTotal),
    montantRegle: Number(p.montantTotal) + Number(p.frais),
    reglement: LIBELLE_REGLEMENT[p.modeReglement] ?? 'À définir ensemble',
    echeances: p.echeances,
    inclus: (bareme.INCLUS ?? []).map((i) => ({
      titre: sansBalises(i.t),
      detail: sansBalises(i.d),
    })),
  };
}

/** Le nom du fichier joint au mail. Lisible par la cliente qui le télécharge. */
export function nomFichierRecap(d: Pick<DonneesRecap, 'prenom' | 'nom' | 'dateBilan'>): string {
  const propre = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `BioPortrait_${propre(d.prenom)}-${propre(d.nom)}_${d.dateBilan}.pdf`;
}

/** Le montant annoncé, arrondi comme il est dit à l'oral. */
export function montantLisible(n: number): string {
  return formaterEuros(n);
}
