/*
  L'avoir : ce que le centre doit à une cliente quand elle s'arrête en cours
  de route.

  C'est de l'argent réel, annoncé de vive voix au comptoir. Une erreur ici se
  paie deux fois : en euros, et en confiance. D'où ces contrôles sur le
  décompte, sur ce qu'il reste à encaisser, et sur ce qu'on peut poser sur
  une cure sans en brûler une partie pour rien.
*/

import { section, verifie, egal, egalEuros } from './harnais.mts';
import {
  avoirPosable,
  decompterArret,
  dejaEncaisse,
  resteAEncaisser,
} from '../src/domain/avoir.ts';
import type { Echeance, LigneProgramme, Programme } from '../src/types/db.ts';

function echeance(rang: number, montant: number, statut: Echeance['statut']): Echeance {
  return {
    id: `e${rang}`,
    programme_id: 'p1',
    type: 'echeance',
    rang,
    montant,
    date_prevue: '2026-01-01',
    moyen: null,
    statut,
    date_reglement: null,
    note: null,
  } as Echeance;
}

const LIBELLES: Record<string, string> = { luxo: 'Luxothérapie', presso: 'Pressodynamie' };
const nommer = (t: string) => LIBELLES[t] ?? t;

export function controlerAvoir() {
  section('Ce qu’il reste à encaisser');

  const echeancier = [
    echeance(1, 500, 'paye'),
    echeance(2, 500, 'paye'),
    echeance(3, 500, 'a_venir'),
    echeance(4, 500, 'impaye'),
  ];

  egalEuros('les échéances réglées font l’encaissé', dejaEncaisse(echeancier), 1000);
  egalEuros('ce qui reste, c’est à venir plus impayé', resteAEncaisser(echeancier), 1000);

  const avecOffertes = [...echeancier, echeance(5, 500, 'donne'), echeance(6, 500, 'annule')];
  egalEuros(
    'une échéance offerte ou annulée ne se réclame plus',
    resteAEncaisser(avecOffertes),
    1000,
  );
  egalEuros('et elle ne compte pas non plus comme encaissée', dejaEncaisse(avecOffertes), 1000);

  section('Le décompte d’un arrêt de cure');

  const programme = { prix_guide: 29, prix_tenue: 60 } as Programme;
  const lignes = [
    { technologie: 'luxo', prix_unitaire: 59 },
    { technologie: 'presso', prix_unitaire: 59 },
  ] as LigneProgramme[];

  // Elle a réglé 1 000 €, fait 8 séances de luxo et 2 de presso, et elle est
  // repartie avec le guide et la tenue.
  const d = decompterArret(
    programme,
    lignes,
    [
      { technologie: 'luxo', seances_faites: 8 },
      { technologie: 'presso', seances_faites: 2 },
    ],
    echeancier,
    nommer,
  );

  egalEuros('l’encaissé est repris de l’échéancier', d.encaisse, 1000);
  egalEuros('dix séances et les deux options font le consommé', d.consomme, 10 * 59 + 29 + 60);
  egalEuros('l’avoir proposé est la différence', d.suggere, 1000 - 679);
  egalEuros('elle ne doit donc plus rien', d.duRestant, 0);
  verifie(
    'le détail nomme les soins et compte les séances',
    d.detail.some((x) => x.libelle === 'Luxothérapie — 8 séances faites' && x.montant === 472),
  );
  verifie(
    'le guide emporté figure au décompte',
    d.detail.some((x) => x.libelle.startsWith('Guide') && x.montant === 29),
  );

  section('Quand elle a plus reçu qu’elle n’a payé');

  const petitePaye = [echeance(1, 200, 'paye'), echeance(2, 800, 'a_venir')];
  const dette = decompterArret(
    programme,
    lignes,
    [{ technologie: 'luxo', seances_faites: 12 }],
    petitePaye,
    nommer,
  );

  egalEuros('le consommé dépasse l’encaissé', dette.consomme, 12 * 59 + 29 + 60);
  egalEuros('il n’y a aucun avoir à lui faire', dette.suggere, 0);
  egalEuros('c’est elle qui doit la différence', dette.duRestant, 12 * 59 + 89 - 200);

  section('Une cure arrêtée avant la première séance');

  const rienFait = decompterArret(
    { prix_guide: 0, prix_tenue: 0 } as Programme,
    lignes,
    [],
    [echeance(1, 400, 'paye')],
    nommer,
  );
  egal('rien n’a été consommé', rienFait.consomme, 0);
  egalEuros('tout ce qu’elle a versé lui revient', rienFait.suggere, 400);
  egal('et le décompte n’invente aucune ligne', rienFait.detail.length, 0);

  section('Ce qu’on peut poser sur une cure');

  egalEuros('jamais plus que son avoir', avoirPosable(120, 900), 120);
  egalEuros('jamais plus que ce qu’il reste à payer', avoirPosable(900, 120), 120);
  egalEuros('rien à poser sur une cure déjà soldée', avoirPosable(300, 0), 0);
  egalEuros('un solde vide ne pose rien', avoirPosable(0, 500), 0);
  // Les centimes ne doivent pas traîner : 0,1 + 0,2 ne fait pas 0,3 en machine.
  egalEuros('le montant s’arrête au centime', avoirPosable(120.005, 900), 120.01);
}
