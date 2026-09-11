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
import type { BaremeAntiAge, BioPortraitAntiAge } from './antiAge';
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
  echeances: Array<{ rang: number; montant: number; type?: string }>;
}

export interface AxeRecap {
  nom: string;
  signature: string;
  /** Absent pour l'anti-âge : ses scores sont des points, pas des parts d'un tout. */
  pourcentage: number | null;
  texte: string;
  impacts: string[];
}

/**
 * Les mots du document, selon le bilan dont il est né. Le BioPortrait de la
 * perte de poids parle de profil comportemental et de terrain
 * physiologique ; le Bio-Portrait Anti-Âge de profil anti-âge et de terrain
 * cutané. La page est la même, les intitulés non.
 */
export interface LibellesRecap {
  titreDocument: string;
  nomDuBilan: string;
  titreProfil: string;
  etiquetteProfil: string;
  titreTerrain: string;
  etiquetteTerrain: string;
  impacts: string;
  /** Une mention à imprimer en bas de la page du diagnostic, s'il y en a une. */
  mention?: string;
  /** « Vos priorités : Fermeté · Densité », s'il y en a. */
  priorites?: string[];
}

export const LIBELLES_PERTE_DE_POIDS: LibellesRecap = {
  titreDocument: 'Diagnostic BioPortrait',
  nomDuBilan: 'BioPortrait',
  titreProfil: 'Votre profil comportemental',
  etiquetteProfil: 'Qui vous êtes aujourd’hui',
  titreTerrain: 'Votre terrain physiologique',
  etiquetteTerrain: 'Ce que révèle votre corps',
  impacts: 'Ce que cela change chez vous',
};

export const LIBELLES_ANTI_AGE: LibellesRecap = {
  titreDocument: 'Bio-Portrait Anti-Âge',
  nomDuBilan: 'Bio-Portrait Anti-Âge',
  titreProfil: 'Votre profil anti-âge',
  etiquetteProfil: 'Ce dont votre peau a besoin',
  titreTerrain: 'Votre terrain cutané',
  etiquetteTerrain: 'Comment votre peau réagit',
  impacts: 'Vos besoins',
};

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
  /*
    Ce que la cure contient — sans le prix de chaque ligne. La cliente
    achète un accompagnement, pas un panier : détailler « 16 séances à
    59 € » l'invite à retirer des séances pour faire baisser la note, et
    c'est la conversation qu'on ne veut pas avoir. Le récapitulatif dit ce
    qu'elle règle, en grand, et ce qu'elle reçoit — pas la décomposition.

    Le montant n'est donc pas seulement caché à l'impression : il n'est plus
    calculé. Une valeur qui traîne sans servir finit par être réaffichée.
  */
  soins: Array<{ libelle: string; seances: number }>;
  options: Array<{ libelle: string }>;
  totalSeances: number;
  montantTotal: number;
  /** Ce que la cliente règle, frais de financement compris. */
  montantRegle: number;
  reglement: string;
  echeances: Array<{ rang: number; montant: number }>;
  inclus: Array<{ titre: string; detail: string }>;
  libelles: LibellesRecap;
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
    }));

  const options: Array<{ libelle: string }> = [];
  if (p.guide && Number(p.prixGuide) > 0) {
    options.push({ libelle: 'Guide de rééquilibrage alimentaire' });
  }
  if (p.tenue && Number(p.prixTenue) > 0) {
    options.push({ libelle: 'Tenue I-Shape' });
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
    /*
      Le bilan déjà réglé en ligne ne figure pas parmi les échéances du
      récapitulatif : ce document annonce à la cliente ce qu'elle aura à
      régler. Le compter là ferait de la ligne « 1re » un versement qu'elle
      a déjà fait, et décalerait le numéro de toutes les suivantes.
    */
    echeances: p.echeances.filter((e) => e.type !== 'bilan'),
    inclus: (bareme.INCLUS ?? []).map((i) => ({
      titre: sansBalises(i.t),
      detail: sansBalises(i.d),
    })),
    libelles: LIBELLES_PERTE_DE_POIDS,
  };
}

/**
 * Le même document, pour un Bio-Portrait Anti-Âge.
 *
 * Profil et terrain viennent du barème anti-âge, avec les textes cliente du
 * document ; les « impacts » sont les besoins ; pas de pourcentage, pas
 * d'InBody, pas d'axes secondaires. La cure est celle que la thérapeute a
 * composée — de l'Advance Lift, autant de séances qu'elle a dit.
 */
export function construireRecapAntiAge(args: {
  bareme: BaremeAntiAge;
  resultat: BioPortraitAntiAge;
  proposition: Proposition;
  cliente: { civilite: string; prenom: string; nom: string };
  centre: DonneesRecap['centre'];
  dateBilan: string;
}): DonneesRecap {
  const { bareme, resultat: r, proposition: p } = args;
  const profil = bareme.PROFILS[r.profil];

  /*
    Un terrain mixte se présente comme un seul : les noms réunis, les textes
    à la suite, les besoins mis ensemble sans doublon. Le document ne fait
    pas deux cartes pour une égalité.
  */
  const terrains = r.terrains.map((t) => bareme.TERRAINS[t]);
  const terrain: AxeRecap =
    terrains.length === 0
      ? {
          nom: 'Aucun terrain particulier',
          signature: 'Ni sensibilité, ni tiraillement, ni fragilité, ni épaississement signalés.',
          pourcentage: null,
          texte: 'Vos réponses ne signalent aucune réactivité particulière de la peau.',
          impacts: [],
        }
      : {
          nom: terrains.map((t) => t.nom).join(' / '),
          signature: terrains.map((t) => t.caracteristiques).join(' '),
          pourcentage: null,
          texte: terrains.map((t) => t.texte).join(' '),
          impacts: [...new Set(terrains.flatMap((t) => t.besoins))],
        };

  const soins = p.lignes
    .filter((l) => l.seances > 0)
    .map((l) => ({ libelle: LIBELLES_TECHNOLOGIE[l.technologie] ?? l.technologie, seances: l.seances }));

  return {
    civilite: args.cliente.civilite,
    prenom: args.cliente.prenom,
    nom: args.cliente.nom,
    dateBilan: args.dateBilan,
    centre: args.centre,
    profil: {
      nom: profil.nom,
      signature: profil.signes,
      pourcentage: null,
      texte: profil.texte,
      impacts: profil.besoins,
    },
    terrain,
    aussiPresents: [],
    inbody: [],
    soins,
    options: [],
    totalSeances: soins.reduce((n, s) => n + s.seances, 0),
    montantTotal: Number(p.montantTotal),
    montantRegle: Number(p.montantTotal) + Number(p.frais),
    reglement: LIBELLE_REGLEMENT[p.modeReglement] ?? 'À définir ensemble',
    echeances: p.echeances.filter((e) => e.type !== 'bilan'),
    inclus: [],
    libelles: {
      ...LIBELLES_ANTI_AGE,
      mention: bareme.MENTION,
      priorites: r.priorites.map((a) => bareme.AXES[a]),
    },
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
