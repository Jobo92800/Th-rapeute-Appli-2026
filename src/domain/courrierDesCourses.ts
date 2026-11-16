/*
  LE COURRIER DES COURSES.

  Ce que la direction reçoit quand la semaine se termine : ce qu'un centre
  a demandé, où l'acheter, et ce qu'il faudra aller chercher à la main.

  POURQUOI LE MANQUE EST DIT EN HAUT. Un produit sans adresse d'achat ne
  s'achète pas d'un clic : il faut y penser, le chercher, parfois sortir.
  C'est la seule chose du courrier qui demande une décision, donc elle
  passe avant la liste.

  POURQUOI DES REPLIS. Un produit en rupture un lundi matin laisse le
  centre sans papier le mardi. Le premier lien s'achète, les suivants sont
  là pour ce jour-là.

  CE FICHIER NE PARLE À PERSONNE. Pas de réseau, pas de base : il reçoit
  une liste et rend un sujet, un texte et un HTML. C'est ce qui permet de
  le contrôler sans rien envoyer.
*/

import { CATEGORIES, type CategorieDeFourniture } from './courses';

export interface ArticleDuCourrier {
  nom: string;
  unite: string;
  quantite: number;
  categorie: CategorieDeFourniture | null;
  /** Où acheter, par ordre de préférence. Vide = à acheter à la main. */
  liens: string[];
  /** Le prénom de qui l'a demandé, quand on le connaît. */
  demandeePar: string | null;
  /** Vrai pour une ligne tapée à la main, hors catalogue. */
  horsCatalogue: boolean;
}

export interface CourrierDesCourses {
  centre: string;
  /** « 16 novembre », déjà mis en français par l'appelant. */
  semaine: string;
  articles: ArticleDuCourrier[];
  /** L'adresse de la liste dans l'application. */
  lienApplication: string;
}

/* La DA MAbeautyplus : le teal porte, le rose signale. */
const AQUA_TEXTE = '#1F7F7F';
const AQUA_PROFOND = '#2AA5A5';
const ENCRE = '#152B2C';
const ARDOISE = '#5E7273';
const FILET = '#E6EFEF';
const WASH = '#F4FBFB';
const ALERTE_FOND = '#FEF3F8';
const ALERTE_FILET = '#F6D3E4';
const ALERTE_TEXTE = '#AB135D';

export function sansAdresseDachat(a: ArticleDuCourrier): boolean {
  return a.liens.length === 0;
}

/** Le sujet dit le centre et la semaine : c'est ce qu'on cherche six mois après. */
export function sujetDuCourrier(c: CourrierDesCourses): string {
  return `Courses ${c.centre} — semaine du ${c.semaine}`;
}

/**
 * Les rayons dans l'ordre de l'application, les lignes hors catalogue à la
 * fin : ce qui a été tapé à la main se relit mieux groupé.
 */
export function rayonsDuCourrier(
  c: CourrierDesCourses,
): Array<{ libelle: string; articles: ArticleDuCourrier[] }> {
  const rangs = CATEGORIES.map((r) => ({
    libelle: r.libelle,
    articles: c.articles.filter((a) => !a.horsCatalogue && a.categorie === r.id),
  }));
  const libres = c.articles.filter((a) => a.horsCatalogue);
  if (libres.length > 0) rangs.push({ libelle: 'Demandé à la main', articles: libres });
  return rangs.filter((r) => r.articles.length > 0);
}

/** « 3 produits » / « 1 produit ». */
function compte(n: number, singulier: string, pluriel = `${singulier}s`): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

/**
 * La phrase d'alerte, ou null si tout s'achète d'un clic. C'est la seule
 * chose du courrier qui demande une décision.
 */
export function alerteDuCourrier(c: CourrierDesCourses): string | null {
  const manquants = c.articles.filter(sansAdresseDachat);
  if (manquants.length === 0) return null;
  if (manquants.length === c.articles.length) {
    return `Aucun des ${compte(c.articles.length, 'produit')} n'a d'adresse d'achat : toute la liste est à faire à la main. Collez les liens dans le catalogue et ce courrier deviendra cliquable.`;
  }
  return `${compte(manquants.length, 'produit')} sur ${c.articles.length} n'ont pas d'adresse d'achat et sont à faire à la main — ils sont signalés dans la liste.`;
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** La version texte, pour les messageries qui refusent le HTML. */
export function texteDuCourrier(c: CourrierDesCourses): string {
  const lignes: string[] = [`Courses ${c.centre} — semaine du ${c.semaine}`, ''];

  const alerte = alerteDuCourrier(c);
  if (alerte) lignes.push(alerte, '');

  for (const rayon of rayonsDuCourrier(c)) {
    lignes.push(rayon.libelle.toUpperCase());
    for (const a of rayon.articles) {
      const qui = a.demandeePar ? ` — demandé par ${a.demandeePar}` : '';
      lignes.push(`  ${a.quantite} × ${a.nom} (${a.unite})${qui}`);
      if (sansAdresseDachat(a)) {
        lignes.push('      à acheter à la main');
      } else {
        a.liens.forEach((l, i) => lignes.push(`      ${i === 0 ? 'acheter' : `repli ${i}`} : ${l}`));
      }
    }
    lignes.push('');
  }

  lignes.push(`La liste dans l'application : ${c.lienApplication}`);
  return lignes.join('\n');
}

/**
 * Le HTML, en tableaux et styles en ligne : c'est la seule mise en page
 * qu'Outlook et Hotmail rendent correctement.
 */
export function htmlDuCourrier(c: CourrierDesCourses): string {
  const alerte = alerteDuCourrier(c);

  const bloc = (contenu: string) =>
    `<tr><td style="padding:0 28px">${contenu}</td></tr>`;

  const boutons = (a: ArticleDuCourrier) => {
    if (sansAdresseDachat(a)) {
      return `<span style="display:inline-block;font:600 12px/1 Helvetica,Arial,sans-serif;color:${ALERTE_TEXTE};background:${ALERTE_FOND};border:1px solid ${ALERTE_FILET};border-radius:999px;padding:7px 12px;white-space:nowrap">à acheter à la main</span>`;
    }
    const principal = `<a href="${echapper(a.liens[0])}" style="display:inline-block;font:600 12px/1 Helvetica,Arial,sans-serif;color:#ffffff;background:${AQUA_PROFOND};border-radius:999px;padding:8px 16px;text-decoration:none;white-space:nowrap">Acheter</a>`;
    const replis = a.liens
      .slice(1)
      .map(
        (l, i) =>
          `<a href="${echapper(l)}" style="font:500 12px/1 Helvetica,Arial,sans-serif;color:${ARDOISE};text-decoration:underline;margin-left:10px;white-space:nowrap">repli ${i + 1}</a>`,
      )
      .join('');
    return principal + replis;
  };

  const lignesDunRayon = (articles: ArticleDuCourrier[]) =>
    articles
      .map((a) => {
        const qui = a.demandeePar
          ? `<span style="color:${ARDOISE};font-weight:400"> · demandé par ${echapper(a.demandeePar)}</span>`
          : '';
        return `<tr>
  <td style="padding:11px 0;border-top:1px solid ${FILET};font:700 15px/1.3 Helvetica,Arial,sans-serif;color:${AQUA_TEXTE};width:38px;vertical-align:top">${a.quantite}</td>
  <td style="padding:11px 10px 11px 0;border-top:1px solid ${FILET};font:600 14px/1.4 Helvetica,Arial,sans-serif;color:${ENCRE};vertical-align:top">
    ${echapper(a.nom)}
    <span style="color:${ARDOISE};font-weight:400;font-size:12px">${echapper(a.unite)}</span>${qui}
  </td>
  <td style="padding:11px 0;border-top:1px solid ${FILET};text-align:right;vertical-align:top">${boutons(a)}</td>
</tr>`;
      })
      .join('');

  const rayons = rayonsDuCourrier(c)
    .map(
      (r) => `
<p style="margin:26px 0 2px;font:700 11px/1 Helvetica,Arial,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:${AQUA_TEXTE}">${echapper(r.libelle)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${lignesDunRayon(r.articles)}</table>`,
    )
    .join('');

  const blocAlerte = alerte
    ? bloc(`<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;background:${ALERTE_FOND};border:1px solid ${ALERTE_FILET};border-radius:14px">
  <tr><td style="padding:16px 18px;font:500 13px/1.55 Helvetica,Arial,sans-serif;color:${ALERTE_TEXTE}">${echapper(alerte)}</td></tr>
</table>`)
    : '';

  const total = c.articles.reduce((n, a) => n + a.quantite, 0);

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapper(sujetDuCourrier(c))}</title></head>
<body style="margin:0;padding:0;background:${WASH}">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${WASH}">
<tr><td align="center" style="padding:28px 14px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;background:#ffffff;border:1px solid ${FILET};border-radius:18px">

    <tr><td style="padding:28px 28px 4px">
      <p style="margin:0;font:700 11px/1 Helvetica,Arial,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:${AQUA_PROFOND}">MAbeautyplus</p>
      <h1 style="margin:10px 0 2px;font:700 22px/1.25 Helvetica,Arial,sans-serif;color:${ENCRE}">Courses ${echapper(c.centre)}</h1>
      <p style="margin:0;font:400 13px/1.5 Helvetica,Arial,sans-serif;color:${ARDOISE}">
        Semaine du ${echapper(c.semaine)} · ${compte(c.articles.length, 'produit')}, ${compte(total, 'article')} au total
      </p>
    </td></tr>

    ${alerte ? `<tr><td style="height:18px"></td></tr>${blocAlerte}` : ''}

    ${bloc(rayons)}

    <tr><td style="padding:28px">
      <a href="${echapper(c.lienApplication)}" style="display:inline-block;font:600 13px/1 Helvetica,Arial,sans-serif;color:${AQUA_TEXTE};border:1px solid ${FILET};border-radius:999px;padding:11px 20px;text-decoration:none">Ouvrir la liste dans l'application</a>
    </td></tr>

  </table>
  <p style="margin:16px 0 0;font:400 11px/1.5 Helvetica,Arial,sans-serif;color:${ARDOISE};max-width:620px">
    Ce courrier est envoyé à la direction en fin de semaine, un par centre.
  </p>
</td></tr></table>
</body></html>`;
}
