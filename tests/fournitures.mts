/*
  Les adresses d'achat du catalogue.

  Un lien mal lu coûte une commande : soit on achète le mauvais produit,
  soit on enregistre deux fois le même en croyant avoir un repli. D'où ces
  contrôles sur les formes de lien qu'Amazon produit réellement, et sur ce
  qu'on refuse d'enregistrer.
*/

import { section, verifie, egal } from './harnais.mts';
import {
  estUnLienAmazon,
  nettoyerLesLiens,
  normaliserLeLien,
  refusDEnregistrement,
  referenceDuLien,
  sansAdresse,
} from '../src/domain/fournitures.ts';

export function controlerFournitures() {
  section('Fournitures — reconnaître une adresse Amazon');

  verifie('amazon.fr est Amazon', estUnLienAmazon('https://www.amazon.fr/dp/B07PXMV2KW'));
  verifie('amazon.co.uk est Amazon', estUnLienAmazon('https://www.amazon.co.uk/dp/B07PXMV2KW'));
  verifie("le lien court de l'application est Amazon", estUnLienAmazon('https://amzn.eu/d/9fK2xQ1'));
  verifie('sans protocole, Amazon reste Amazon', estUnLienAmazon('amazon.fr/dp/B07PXMV2KW'));
  verifie("une pharmacie n'est pas Amazon", !estUnLienAmazon('https://www.pharmacie-lafayette.com/produit/42'));
  verifie(
    'un nom de domaine qui contient « amazon » sans en être ne passe pas',
    !estUnLienAmazon('https://amazon.fr.exemple-truque.com/dp/B07PXMV2KW'),
  );
  verifie('un texte quelconque n\'est pas une adresse', !estUnLienAmazon('papier toilette 36 rouleaux'));

  section('Fournitures — retrouver la référence du produit');

  /* Les formes réellement produites par Amazon selon la page d'origine. */
  egal(
    'lien de partage nu',
    referenceDuLien('https://www.amazon.fr/dp/B07PXMV2KW'),
    'B07PXMV2KW',
  );
  egal(
    'lien copié depuis les résultats de recherche',
    referenceDuLien(
      'https://www.amazon.fr/by-Amazon-Papier-Toilette-Matelass%C3%A9/dp/B07PXMV2KW/ref=sr_1_5?crid=2QW&keywords=papier+toilette&sprefix=papier',
    ),
    'B07PXMV2KW',
  );
  egal(
    'ancienne forme /gp/product',
    referenceDuLien('https://www.amazon.fr/gp/product/B07PXMV2KW?th=1&psc=1'),
    'B07PXMV2KW',
  );
  egal(
    'référence en minuscules dans le chemin',
    referenceDuLien('https://www.amazon.fr/dp/b07pxmv2kw'),
    'B07PXMV2KW',
  );
  egal(
    'référence passée en paramètre',
    referenceDuLien('https://www.amazon.fr/gp/aws/cart/add.html?ASIN.1=B07PXMV2KW&Quantity.1=2'),
    'B07PXMV2KW',
  );
  egal(
    'un livre, dont la référence est son ISBN',
    referenceDuLien('https://www.amazon.fr/exec/obidos/ASIN/2253940267/ref=nosim'),
    '2253940267',
  );
  egal(
    "le lien court ne révèle pas la référence : on ne l'invente pas",
    referenceDuLien('https://amzn.eu/d/9fK2xQ1'),
    null,
  );
  egal(
    'hors Amazon, il n\'y a pas de référence à chercher',
    referenceDuLien('https://www.pharmacie-lafayette.com/produit/42'),
    null,
  );

  section('Fournitures — réduire une adresse à l\'essentiel');

  egal(
    'deux cents caractères de suivi disparaissent',
    normaliserLeLien(
      'https://www.amazon.fr/by-Amazon-Papier-Toilette/dp/B07PXMV2KW/ref=sr_1_5?crid=2QW&keywords=papier',
    ),
    'https://www.amazon.fr/dp/B07PXMV2KW',
  );
  egal(
    'le pays d\'origine est conservé',
    normaliserLeLien('https://www.amazon.de/gp/product/B07PXMV2KW?th=1'),
    'https://www.amazon.de/dp/B07PXMV2KW',
  );
  egal(
    'amazon.co.uk garde son domaine en deux morceaux',
    normaliserLeLien('https://www.amazon.co.uk/dp/B07PXMV2KW'),
    'https://www.amazon.co.uk/dp/B07PXMV2KW',
  );
  egal(
    'le protocole manquant est ajouté',
    normaliserLeLien('amazon.fr/dp/B07PXMV2KW'),
    'https://www.amazon.fr/dp/B07PXMV2KW',
  );
  egal(
    'le lien court est gardé tel quel : il fonctionne',
    normaliserLeLien('https://amzn.eu/d/9fK2xQ1'),
    'https://amzn.eu/d/9fK2xQ1',
  );
  egal(
    'une adresse hors Amazon est gardée intacte',
    normaliserLeLien('  https://www.pharmacie-lafayette.com/produit/42?taille=L  '),
    'https://www.pharmacie-lafayette.com/produit/42?taille=L',
  );

  section('Fournitures — la liste des adresses d\'une fourniture');

  egal(
    'les champs laissés vides disparaissent',
    nettoyerLesLiens(['https://www.amazon.fr/dp/B07PXMV2KW', '', '   ']),
    ['https://www.amazon.fr/dp/B07PXMV2KW'],
  );
  egal(
    "l'ordre donné est l'ordre de préférence : il ne bouge pas",
    nettoyerLesLiens([
      'https://www.amazon.fr/dp/BBBBBBBBBB',
      'https://www.amazon.fr/dp/AAAAAAAAAA',
    ]),
    ['https://www.amazon.fr/dp/BBBBBBBBBB', 'https://www.amazon.fr/dp/AAAAAAAAAA'],
  );
  /* Le vrai piège : le même produit collé depuis deux pages différentes.
     Sans réduction on croirait avoir un repli, et on n'en aurait aucun. */
  egal(
    'le même produit collé deux fois ne compte qu\'une',
    nettoyerLesLiens([
      'https://www.amazon.fr/Papier/dp/B07PXMV2KW/ref=sr_1_5?keywords=papier',
      'https://www.amazon.fr/gp/product/B07PXMV2KW?th=1',
    ]),
    ['https://www.amazon.fr/dp/B07PXMV2KW'],
  );
  egal(
    'deux produits différents restent deux replis',
    nettoyerLesLiens([
      'https://www.amazon.fr/dp/B07PXMV2KW',
      'https://www.amazon.fr/dp/B08WKM97HL',
    ]).length,
    2,
  );
  egal(
    'la même adresse hors Amazon ne compte qu\'une, à la casse près',
    nettoyerLesLiens([
      'https://www.pharmacie-lafayette.com/produit/42',
      'https://WWW.Pharmacie-Lafayette.com/produit/42',
    ]).length,
    1,
  );
  egal(
    'deux liens courts distincts sont deux adresses',
    nettoyerLesLiens(['https://amzn.eu/d/aaa', 'https://amzn.eu/d/bbb']).length,
    2,
  );
  egal('aucune adresse donnée, aucune gardée', nettoyerLesLiens([]), []);

  section('Fournitures — ce qu\'on refuse d\'enregistrer');

  const correct = {
    nom: 'Papier toilette',
    unite: 'paquet',
    liens: ['https://www.amazon.fr/dp/B07PXMV2KW'],
    centres: null,
  };

  egal('une fourniture complète passe', refusDEnregistrement(correct), null);
  egal(
    'une fourniture sans adresse passe : elle s\'achètera à la main',
    refusDEnregistrement({ ...correct, liens: [] }),
    null,
  );
  verifie(
    'un nom vide est refusé, et le message dit pourquoi',
    (refusDEnregistrement({ ...correct, nom: '   ' }) ?? '').includes('nom'),
  );
  verifie(
    'aucun centre coché est refusé',
    (refusDEnregistrement({ ...correct, centres: [] }) ?? '').includes('centre'),
  );
  verifie(
    'tous les centres est accepté',
    refusDEnregistrement({ ...correct, centres: null }) === null,
  );
  verifie(
    'un centre nommé est accepté',
    refusDEnregistrement({ ...correct, centres: ['serignan'] }) === null,
  );
  verifie(
    'un texte à la place d\'une adresse est refusé, en citant le texte',
    (refusDEnregistrement({ ...correct, liens: ['papier toilette pas cher'] }) ?? '').includes(
      'papier toilette pas cher',
    ),
  );

  section('Fournitures — ce que le mail du dimanche devra signaler');

  verifie('sans adresse, à acheter à la main', sansAdresse({ liens: [] }));
  verifie('avec une adresse, rien à signaler', !sansAdresse({ liens: ['https://www.amazon.fr/dp/B07PXMV2KW'] }));
}
