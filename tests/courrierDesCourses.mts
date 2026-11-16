/*
  Le courrier des courses.

  Ce courrier est la seule chose que la direction lit avant d'acheter. S'il
  oublie de signaler un produit sans adresse, on croit pouvoir tout cliquer
  et le centre se retrouve sans son produit. D'où ces contrôles sur ce
  qu'il dit, et sur ce qu'il n'oublie pas.
*/

import { section, verifie, egal } from './harnais.mts';
import {
  alerteDuCourrier,
  htmlDuCourrier,
  rayonsDuCourrier,
  sujetDuCourrier,
  texteDuCourrier,
  type ArticleDuCourrier,
  type CourrierDesCourses,
} from '../src/domain/courrierDesCourses.ts';

function a(p: Partial<ArticleDuCourrier> = {}): ArticleDuCourrier {
  return {
    nom: 'Papier toilette',
    unite: 'paquet',
    quantite: 1,
    categorie: 'hygiene',
    liens: ['https://www.amazon.fr/dp/B07PXMV2KW'],
    demandeePar: 'Alexandra',
    horsCatalogue: false,
    ...p,
  };
}

function courrier(articles: ArticleDuCourrier[]): CourrierDesCourses {
  return {
    centre: 'Avignon',
    semaine: '16 novembre',
    articles,
    lienApplication: 'https://appli-therapeute-2926.netlify.app/courses',
  };
}

export function controlerCourrierDesCourses() {
  section('Courrier des courses — le sujet');

  egal(
    'le sujet nomme le centre et la semaine',
    sujetDuCourrier(courrier([a()])),
    'Courses Avignon — semaine du 16 novembre',
  );

  section('Courrier des courses — ce qui manque est dit');

  egal(
    'tout a une adresse : aucune alerte',
    alerteDuCourrier(courrier([a(), a({ nom: 'Mouchoirs' })])),
    null,
  );

  const partiel = alerteDuCourrier(
    courrier([a(), a({ nom: 'Gel WC', liens: [] }), a({ nom: 'Agrafes', liens: [] })]),
  );
  verifie('deux manquants sur trois : le compte est juste', (partiel ?? '').includes('2 produits sur 3'));
  verifie('et on dit où les retrouver', (partiel ?? '').includes('signalés dans la liste'));

  const total = alerteDuCourrier(courrier([a({ liens: [] }), a({ nom: 'Gel WC', liens: [] })]));
  verifie(
    'aucun lien du tout : le courrier le dit autrement, sans renvoyer à la liste',
    (total ?? '').includes('Aucun des 2 produits') && !(total ?? '').includes('signalés'),
  );
  verifie(
    'et il dit quoi faire pour que ça change',
    (total ?? '').includes('catalogue'),
  );

  const unSeul = alerteDuCourrier(courrier([a(), a({ nom: 'Gel WC', liens: [] })]));
  verifie("un seul manquant reste au singulier", (unSeul ?? '').includes('1 produit sur 2'));

  section('Courrier des courses — les rayons');

  const range = rayonsDuCourrier(
    courrier([
      a({ nom: 'Stylos', categorie: 'bureau' }),
      a({ nom: 'Papier toilette', categorie: 'hygiene' }),
      a({ nom: 'Gel presso', categorie: 'soin' }),
    ]),
  );
  egal(
    "les rayons suivent l'ordre de l'application, pas celui des demandes",
    range.map((r) => r.libelle),
    ['Hygiène', 'Soins', 'Bureau'],
  );

  const avecLibre = rayonsDuCourrier(
    courrier([
      a({ nom: 'Stylos', categorie: 'bureau' }),
      a({ nom: 'Sacs 100 L', categorie: null, horsCatalogue: true, liens: [] }),
    ]),
  );
  egal(
    'ce qui est tapé à la main se regroupe à la fin',
    avecLibre.map((r) => r.libelle),
    ['Bureau', 'Demandé à la main'],
  );
  egal('un rayon vide ne paraît pas', rayonsDuCourrier(courrier([a()])).length, 1);

  section('Courrier des courses — la version texte');

  const texte = texteDuCourrier(
    courrier([a({ quantite: 3 }), a({ nom: 'Gel WC', categorie: 'entretien', liens: [] })]),
  );
  verifie('la quantité précède le produit', texte.includes('3 × Papier toilette (paquet)'));
  verifie('on sait qui a demandé', texte.includes('demandé par Alexandra'));
  verifie("l'adresse d'achat est en clair", texte.includes('acheter : https://www.amazon.fr/dp/B07PXMV2KW'));
  verifie('le manquant est marqué sur sa ligne', texte.includes('à acheter à la main'));
  verifie("le lien vers l'application est donné", texte.includes('/courses'));

  const replis = texteDuCourrier(
    courrier([a({ liens: ['https://a.fr/1', 'https://a.fr/2', 'https://a.fr/3'] })]),
  );
  verifie('les replis sont numérotés à partir de 1', replis.includes('repli 1 : https://a.fr/2'));
  verifie('et le troisième est le repli 2', replis.includes('repli 2 : https://a.fr/3'));

  section('Courrier des courses — le HTML');

  const html = htmlDuCourrier(
    courrier([a({ quantite: 2 }), a({ nom: 'Gel WC', categorie: 'entretien', liens: [] })]),
  );
  verifie('le produit avec adresse porte un bouton Acheter', html.includes('>Acheter</a>'));
  verifie(
    "le bouton pointe vraiment sur l'adresse",
    html.includes('href="https://www.amazon.fr/dp/B07PXMV2KW"'),
  );
  verifie('le manquant est marqué en toutes lettres', html.includes('à acheter à la main'));
  verifie('aucune mise en page que Hotmail ne sait pas rendre', !/display:\s*(flex|grid)/.test(html));
  verifie('tout le style est en ligne', !html.includes('<style'));
  verifie('le total des articles est annoncé', html.includes('3 articles au total'));

  /* Un nom de produit avec un chevron ne doit pas casser la page. */
  const piege = htmlDuCourrier(courrier([a({ nom: 'Gants <M> & "noirs"' })]));
  verifie(
    'un nom de produit ne peut pas injecter de balise',
    piege.includes('Gants &lt;M&gt; &amp; &quot;noirs&quot;') && !piege.includes('<M>'),
  );
}
