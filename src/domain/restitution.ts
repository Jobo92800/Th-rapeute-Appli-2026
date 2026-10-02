/*
  La restitution du BioPortrait, remise à la cliente.

  Quatre pages : ce qu'elle est, ce que cela explique, le programme qui en
  découle, et ce qu'elle règle. Celle qui démarre n'en reçoit que trois — son
  contrat porte déjà le prix, et un document de dossier qui annonce un tarif
  devient faux le jour où les tarifs changent.

  CE MODULE N'IMPRIME RIEN. Il répond à trois questions, et chacune se
  vérifie au banc d'essai :

    — QUEL EST LE POINT DE VIGILANCE ? La première mesure d'analyse en
      alerte, dans l'ordre du questionnaire. Aucune alerte, aucun point : la
      page 1 n'en invente pas un. C'est le défaut corrigé du paquet, qui
      retenait « Graisse viscérale » dans le vide pendant que le tableau
      affichait, deux lignes plus haut, « rien d'alarmant de ce côté ».

    — QUE METTRE EN FACE DE CHAQUE POINT ? Le terrain, le profil et le point
      de vigilance appellent chacun un soin, pris dans la matrice du barème.
      DEUX LIGNES NE PORTENT JAMAIS LE MÊME SOIN : une page qui répond trois
      fois « la rééducation alimentaire » n'est plus une réponse sur mesure.
      Quand il n'y a plus de soin distinct à proposer, on affiche une ligne
      de moins plutôt que de se répéter.

    — POURQUOI CE SOIN EST-IL DANS SA CURE ? Chaque soin vendu cherche un
      point de l'analyse qu'aucun autre n'a déjà pris. S'il n'en reste pas,
      il garde son explication mais perd la mention de l'axe — sinon deux
      cartes voisines diraient « Votre terrain Circulatoire » toutes les
      deux.

  Tous les textes viennent du barème (migration 076), jamais d'ici. Un
  changement de mot ne demande donc pas de livraison.

  Spécification du paquet du 2 octobre 2026, arbitrages de Jonathan.
*/

import {
  choix,
  type Axe,
  type Bareme,
  type DescriptionSoin,
  type LectureMesure,
  type Prestation,
  type Reponses,
} from './bioportrait';

/* -------------------------------------------------------------------------
   Le genre
   ------------------------------------------------------------------------- */

/**
 * Les textes du barème portent `{e}` là où l'accord dépend de la personne :
 * « vous êtes allongé{e} ». Les centres reçoivent aussi des hommes, et un
 * document personnel qui les accorde au féminin se voit tout de suite.
 */
export function accorder(texte: string, civilite: string): string {
  return texte.replace(/\{e\}/g, civilite === 'M.' ? '' : 'e');
}

/* -------------------------------------------------------------------------
   La composition corporelle
   ------------------------------------------------------------------------- */

export interface LigneComposition {
  /** Le rang de la mesure dans le questionnaire : c'est la clé des associations. */
  rang: number;
  libelle: string;
  /** La réponse cochée, telle quelle : « Faible (norme basse) ». */
  reponse: string;
  /** La situation en deux mots, pour la colonne du tableau. */
  situation: string;
  /** 1, 2 ou 3 pastilles remplies. */
  niveau: number;
  /** Pastilles roses, et candidate au point de vigilance. */
  alerte: boolean;
  /** Ce que cela veut dire, en une phrase. */
  sens: string;
}

/**
 * Le tableau de composition corporelle, lu dans le barème du bilan.
 *
 * Une mesure sans réponse ne produit pas de ligne — on n'affiche pas une
 * ligne vide dans un document remis à la cliente. Une mesure dont le barème
 * ne porte pas la lecture non plus : les barèmes 1 et 2 n'en ont pas.
 */
export function lireLaComposition(
  bareme: Bareme,
  reponses: Reponses,
  civilite = 'Mme',
): LigneComposition[] {
  const lignes: LigneComposition[] = [];
  let rang = 0;

  bareme.STEPS.forEach((etape, index) => {
    if (etape.phase !== 'analyse' || etape.type !== 'radio' || !etape.o) return;
    const monRang = rang;
    rang += 1;

    const [i] = choix(reponses, index);
    if (i == null) return;
    const lu: LectureMesure | undefined = etape.lecture?.[i];
    if (!lu) return;

    lignes.push({
      rang: monRang,
      libelle: etape.t ?? '',
      reponse: etape.o?.[i]?.[0] ?? '',
      situation: accorder(lu.s, civilite),
      niveau: lu.n,
      alerte: lu.a,
      sens: accorder(lu.t, civilite),
    });
  });

  return lignes;
}

/**
 * Le point sur lequel on va agir : la première mesure en alerte.
 *
 * Null quand rien n'alerte, et c'est voulu. L'implémentation d'origine
 * retenait alors la première mesure du tableau — « Graisse viscérale » —
 * alors que la ligne juste au-dessus disait qu'il n'y avait rien à en dire.
 * La page se contredisait toute seule.
 */
export function pointDeVigilance(lignes: LigneComposition[]): LigneComposition | null {
  return lignes.find((l) => l.alerte) ?? null;
}

/* -------------------------------------------------------------------------
   Les soins vendus
   ------------------------------------------------------------------------- */

/**
 * Les soins de la cure qui entrent dans la restitution.
 *
 * Le Dôme en est absent : aucune question ne lui donne de points, il n'entre
 * dans une cure que par la main de la thérapeute, et le mettre en face d'un
 * point de l'analyse serait inventer un lien qui n'existe pas (Jonathan,
 * 2 octobre 2026). Il figure au récapitulatif de la dernière page, avec le
 * reste de ce qu'elle achète.
 */
const HORS_BIOPORTRAIT: Prestation[] = ['DOME'];

export interface SoinVendu {
  cle: string;
  seances: number;
}

export function soinsVendus(
  lignes: Array<{ technologie: string; seances: number }>,
): SoinVendu[] {
  const codes: Record<string, string> = {
    luxo: 'LUXO',
    relax: 'RELAX',
    ishape: 'ISHAPE',
    presso: 'PRESSO',
  };
  const vus = new Set<string>();
  const sortie: SoinVendu[] = [];

  for (const l of lignes) {
    const cle = codes[l.technologie];
    if (!cle || l.seances <= 0 || vus.has(cle)) continue;
    if (HORS_BIOPORTRAIT.includes(cle as Prestation)) continue;
    vus.add(cle);
    sortie.push({ cle, seances: l.seances });
  }

  return sortie;
}

/** « 15 séances », « 1 séance ». */
export function libelleSeances(n: number): string {
  return `${n} séance${n > 1 ? 's' : ''}`;
}

/* -------------------------------------------------------------------------
   Les correspondances
   ------------------------------------------------------------------------- */

export interface Correspondance {
  /** « Terrain Digestif », « Masse musculaire ». */
  libelle: string;
  /** « « l'assimilation ralentie » », ou « le point à faire évoluer ». */
  sous: string;
  /** Le code du soin retenu. */
  cle: string;
  /** « La Pressodynamie ». */
  prestation: string;
  /** « 12 séances », « 4 semaines », « chaque semaine ». */
  detail: string;
  /** Ce que ce soin apporte à ce point précis. */
  texte: string;
}

interface ContexteRestitution {
  bareme: Bareme;
  profil: Axe;
  terrain: Axe;
  vigilance: LigneComposition | null;
  vendus: SoinVendu[];
  civilite?: string;
}

/** Le détail affiché après le nom du soin. */
function detailDuSoin(cle: string, vendus: SoinVendu[]): string {
  const vendu = vendus.find((v) => v.cle === cle);
  if (vendu) return libelleSeances(vendu.seances);
  return cle === 'NUTRITION' ? '4 semaines' : 'chaque semaine';
}

function axesDeLaRestitution(ctx: ContexteRestitution) {
  const ax = ctx.bareme.AX;
  const axes: Array<{ axe: string; valeur: string; libelle: string; sous: string }> = [
    {
      axe: 'terrain',
      valeur: ctx.terrain,
      libelle: `Terrain ${ax[ctx.terrain]?.name ?? ''}`,
      sous: ax[ctx.terrain]?.sig ?? '',
    },
    {
      axe: 'profil',
      valeur: ctx.profil,
      libelle: `Profil ${ax[ctx.profil]?.name ?? ''}`,
      sous: ax[ctx.profil]?.sig ?? '',
    },
  ];

  // Pas d'alerte, pas de troisième ligne : on ne désigne pas un point au hasard.
  if (ctx.vigilance) {
    axes.push({
      axe: 'mesure',
      valeur: String(ctx.vigilance.rang),
      libelle: ctx.vigilance.libelle,
      sous: 'le point à faire évoluer',
    });
  }

  return axes;
}

/**
 * Le tableau « ce que votre analyse a montré → ce que nous mettons en face ».
 *
 * Deux ou trois lignes, jamais deux fois le même soin. Quand l'association
 * prévue n'est pas disponible — le soin n'est pas dans sa cure, ou il est
 * déjà pris par une autre ligne — on cherche un soin libre qui a quelque
 * chose à dire sur ce point ; à défaut n'importe lequel ; à défaut rien.
 */
export function correspondances(ctx: ContexteRestitution): Correspondance[] {
  const r = ctx.bareme.RESTITUTION;
  if (!r) return [];
  const civilite = ctx.civilite ?? 'Mme';

  const toujours = r.TOUJOURS ?? [];
  const ordre = [...ctx.vendus.map((v) => v.cle), ...toujours];
  const disponibles = new Set(ordre);

  const deja = new Set<string>();
  const sortie: Correspondance[] = [];

  for (const a of axesDeLaRestitution(ctx)) {
    const table = (r.ASSOC as Record<string, Record<string, string[]>>)[a.axe]?.[a.valeur] ?? [];
    const libres = ordre.filter((c) => disponibles.has(c) && !deja.has(c));

    const choisi =
      table.find((c) => disponibles.has(c) && !deja.has(c)) ??
      libres.find((c) => r.EFFET[`${a.axe}|${a.valeur}|${c}`]) ??
      libres[0];

    if (!choisi) continue;
    deja.add(choisi);

    const soin: DescriptionSoin | undefined = r.SOINS[choisi];
    sortie.push({
      libelle: a.libelle,
      sous: a.sous,
      cle: choisi,
      prestation: soin?.nom ?? choisi,
      detail: detailDuSoin(choisi, ctx.vendus),
      texte: accorder(
        r.EFFET[`${a.axe}|${a.valeur}|${choisi}`] ?? r.REPLI[choisi] ?? '',
        civilite,
      ),
    });
  }

  return sortie;
}

/* -------------------------------------------------------------------------
   Les soins préconisés, et pourquoi
   ------------------------------------------------------------------------- */

export interface SoinPreconise {
  cle: string;
  titre: string;
  court: string;
  atouts: string[];
  icone: string;
  /** « 15 séances ». */
  quantite: string;
  /** « Votre terrain Digestif », quand l'axe n'a pas déjà servi ailleurs. */
  raisonLibelle: string | null;
  /** Ce que ce soin apporte. Null : pas de bloc « Pourquoi ». */
  raisonTexte: string | null;
}

/**
 * Les cartes de la page 3 : un soin vendu, ce qu'il est, et pourquoi il est
 * là.
 *
 * L'ÉTAT EST PARTAGÉ ENTRE LES CARTES ET REPART DE ZÉRO À CHAQUE CLIENTE.
 * Chaque carte consomme un axe que les suivantes ne peuvent plus nommer ;
 * s'il survivait d'une cliente à l'autre, les justifications deviendraient
 * fausses sans que rien ne le signale.
 */
export function soinsPreconises(ctx: ContexteRestitution): SoinPreconise[] {
  const r = ctx.bareme.RESTITUTION;
  if (!r) return [];
  const civilite = ctx.civilite ?? 'Mme';

  const axes = axesDeLaRestitution(ctx).map((a) => ({
    ...a,
    // Le libellé d'un axe ne s'écrit pas pareil dans une carte et dans le tableau.
    mention:
      a.axe === 'mesure'
        ? a.libelle
        : `Votre ${a.axe} ${ctx.bareme.AX[a.valeur as Axe]?.name ?? ''}`,
  }));

  const axesPris = new Set<string>();

  return ctx.vendus.map((v) => {
    const soin = r.SOINS[v.cle];
    let libelle: string | null = null;
    let texte: string | null = null;

    // 1. un point de l'analyse qu'aucune autre carte n'a encore nommé
    for (const a of axes) {
      if (axesPris.has(a.axe)) continue;
      const e = r.EFFET[`${a.axe}|${a.valeur}|${v.cle}`];
      if (e) {
        axesPris.add(a.axe);
        libelle = a.mention;
        texte = e;
        break;
      }
    }

    // 2. à défaut, l'explication seule — sans répéter un libellé déjà écrit
    if (!texte) {
      for (const a of axes) {
        const e = r.EFFET[`${a.axe}|${a.valeur}|${v.cle}`];
        if (e) {
          texte = e;
          break;
        }
      }
    }

    /*
      3. Et quand ce soin n'a rien à dire d'aucun des trois points, ce qu'il
      fait en général. Une carte muette sur une page qui annonce « rien n'est
      là par défaut » est la seule chose qu'on ne peut pas se permettre ;
      écrire un lien qui n'existe pas en est une autre. Le texte de repli ne
      prétend à rien : il dit ce que le soin fait, sans l'accrocher à un
      point de l'analyse.
    */
    if (!texte) texte = r.REPLI[v.cle] ?? null;

    return {
      cle: v.cle,
      titre: soin?.titre ?? v.cle,
      court: accorder(soin?.court ?? '', civilite),
      atouts: (soin?.atouts ?? []).map((a) => accorder(a, civilite)),
      icone: soin?.icone ?? 'lumiere',
      quantite: libelleSeances(v.seances),
      raisonLibelle: libelle,
      raisonTexte: texte ? accorder(texte, civilite) : null,
    };
  });
}

/** Ce que comprend toute cure, dans l'ordre d'affichage. */
export function socle(bareme: Bareme, civilite = 'Mme'): Array<DescriptionSoin & { cle: string }> {
  const r = bareme.RESTITUTION;
  if (!r) return [];
  return (r.SOCLE ?? [])
    .filter((c) => r.SOINS[c])
    .map((c) => ({ cle: c, ...r.SOINS[c], court: accorder(r.SOINS[c].court, civilite) }));
}

/* -------------------------------------------------------------------------
   Les trois priorités de la page 1
   ------------------------------------------------------------------------- */

/** Majuscule en tête, point final retiré : ces phrases s'enchaînent. */
function enTete(texte: string): string {
  const t = texte.trim().replace(/\.$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * « Les trois points sur lesquels nous allons agir » — deux quand rien
 * n'alerte dans la composition corporelle.
 */
export function prioritesDuBilan(ctx: ContexteRestitution): string[] {
  const ax = ctx.bareme.AX;
  const sortie: string[] = [];

  const agir = ax[ctx.terrain]?.agir;
  if (agir) sortie.push(enTete(agir));

  const prio = ax[ctx.profil]?.prio;
  if (prio) sortie.push(enTete(prio));

  if (ctx.vigilance) {
    sortie.push(
      `Faire évoluer votre ${ctx.vigilance.libelle.toLowerCase()}, que nous mesurerons chaque mois`,
    );
  }

  return sortie;
}

/* -------------------------------------------------------------------------
   La mise en page
   ------------------------------------------------------------------------- */

export type MiseEnPage = 'pleine-largeur' | '2-colonnes' | '3-colonnes';

/** Au-delà de deux soins, les cartes se resserrent pour tenir sur la page. */
export function miseEnPage(nombreDeSoins: number): MiseEnPage {
  if (nombreDeSoins >= 5) return '3-colonnes';
  if (nombreDeSoins >= 3) return '2-colonnes';
  return 'pleine-largeur';
}
