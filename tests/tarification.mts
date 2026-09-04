/*
  La tarification et les échéanciers.

  C'est ce qui décide de ce que la cliente paie, et de ce qui figure sur son
  contrat. Une erreur d'un euro ici est une erreur sur un document signé.
*/

import { section, verifie, egal, egalEuros } from './harnais.mts';
import {
  ECHEANCES_ALMA,
  ECHEANCES_CENTRE,
  calculerMontant,
  construireEcheancier,
  construireEcheancierCure,
  modeReglement,
  prixUnitaireParDefaut,
  repartirSeances,
  type GrilleTarifaire,
  dureeCureEnMois,
  echeancesCentrePossibles,
  creneauxParDefaut,
  montantAcompte,
  fraisAlma,
  tauxFraisAlma,
} from '../src/domain/tarification.ts';

const GRILLE: GrilleTarifaire = {
  seance: 59,
  guide: 29,
  tenue: 60,
  bilan: 87,
  dome: 39,
  complement: 37,
};

export function controlerTarification() {
  section('Le montant d’une cure');

  const detail = calculerMontant(
    [
      { technologie: 'luxo', seances: 20, prixUnitaire: 59 },
      { technologie: 'ishape', seances: 15, prixUnitaire: 59 },
    ],
    { tenue: true, guide: true },
    GRILLE,
  );

  egal('35 séances comptées', detail.totalSeances, 35);
  egalEuros('35 × 59 €', detail.montantSeances, 2065);
  egalEuros('le total ajoute le guide et la tenue', detail.total, 2065 + 29 + 60);

  const sansOptions = calculerMontant(
    [{ technologie: 'luxo', seances: 12, prixUnitaire: 59 }],
    { tenue: false, guide: false },
    GRILLE,
  );
  egalEuros('sans guide ni tenue, rien ne s’ajoute', sansOptions.total, 708);

  const negatif = calculerMontant(
    [{ technologie: 'luxo', seances: -5, prixUnitaire: 59 }],
    { tenue: false, guide: false },
    GRILLE,
  );
  egalEuros('un nombre de séances négatif ne retire pas d’argent', negatif.total, 0);

  egal('le Dôme a son propre prix', prixUnitaireParDefaut('dome', GRILLE), 39);
  egal('la Relaxation est au prix d’une séance', prixUnitaireParDefaut('relax', GRILLE), 59);

  section('La répartition des séances entre échéances');

  for (const [total, n] of [[17, 4], [12, 3], [20, 4], [7, 2], [10, 4]] as const) {
    const parts = repartirSeances(total, n);
    verifie(
      `${total} séances en ${n} fois : la somme est juste`,
      parts.reduce((a, b) => a + b, 0) === total,
      parts.join('+'),
    );
    verifie(
      `${total} séances en ${n} fois : le reste va aux premières`,
      parts.every((p, i) => i === 0 || parts[i - 1] >= p),
      parts.join('+'),
    );
  }

  section('L’échéancier au centre, par chèques');

  const centre4 = construireEcheancierCure({
    seances: 17,
    prixSeance: 59,
    options: 89,
    methode: 'centre',
    n: 4,
  });

  egal('quatre échéances', centre4.echeances.length, 4);
  egal('mode enregistré', centre4.mode, 'centre_4x');
  egalEuros('aucun frais au centre', centre4.frais, 0);
  egalEuros(
    'la somme des échéances fait le montant à régler',
    centre4.echeances.reduce((n, e) => n + e.montant, 0),
    centre4.montantARegler,
  );
  verifie(
    'le guide et la tenue tombent sur la première échéance',
    centre4.echeances[0].montant - centre4.echeances[1].montant >= 89,
    `${centre4.echeances[0].montant} contre ${centre4.echeances[1].montant}`,
  );

  const comptant = construireEcheancierCure({
    seances: 12,
    prixSeance: 59,
    options: 29,
    methode: 'centre',
    n: 1,
  });
  egal('en une fois, le mode est « comptant »', comptant.mode, 'comptant');
  egal('en une fois, une seule échéance', comptant.echeances.length, 1);
  egalEuros('en une fois, le total y est entier', comptant.echeances[0].montant, 12 * 59 + 29);

  section('L’échéancier quand les prix diffèrent (le Dôme)');

  // 12 séances à 59 € et 4 de Dôme à 39 € : 708 + 156 = 864 €.
  const mixte = construireEcheancierCure({
    seances: 16,
    prixSeance: 59,
    montantSeances: 12 * 59 + 4 * 39,
    options: 29,
    methode: 'centre',
    n: 4,
  });

  egalEuros('le montant à régler suit les prix réels', mixte.montantARegler, 864 + 29);
  egalEuros(
    'la somme des échéances tombe juste malgré les prix mêlés',
    mixte.echeances.reduce((n, e) => n + e.montant, 0),
    mixte.montantARegler,
  );

  section('L’échéancier chez Alma, par carte');

  for (const n of ECHEANCES_ALMA) {
    const alma = construireEcheancierCure({
      seances: 20,
      prixSeance: 59,
      options: 89,
      methode: 'alma',
      n,
    });

    const base = 20 * 59 + 89;
    egal(`${n}× : mode enregistré`, alma.mode, `alma_${n}x`);
    egalEuros(`${n}× : les frais suivent le barème`, alma.frais, fraisAlma(n, base), 0.005);
    egalEuros(
      `${n}× : la somme des mensualités fait le total`,
      alma.echeances.reduce((s, e) => s + e.montant, 0),
      alma.montantARegler,
      0.01,
    );
    verifie(
      `${n}× : les mensualités sont égales, au centime près`,
      alma.echeances.slice(1).every((e) => Math.abs(e.montant - alma.echeances[1].montant) < 0.011),
    );
    verifie(`${n}× : la cliente paie plus que la base`, alma.montantARegler > base);
  }

  const almaInvalide = construireEcheancierCure({
    seances: 12,
    prixSeance: 59,
    options: 0,
    methode: 'alma',
    n: 7,
  });
  egal('un nombre d’échéances Alma inconnu retombe sur 4', almaInvalide.n, 4);

  section('Les modes de règlement');

  egal('centre en 1 fois', modeReglement('centre', 1), 'comptant');
  egal('centre en 3 fois', modeReglement('centre', 3), 'centre_3x');
  egal('Alma en 10 fois', modeReglement('alma', 10), 'alma_10x');
  egal('quatre choix au centre', ECHEANCES_CENTRE, [1, 2, 3, 4]);
  egal('cinq choix chez Alma', ECHEANCES_ALMA, [2, 3, 4, 10, 12]);

  section('L’échéancier des cures suivantes (ancien modèle)');

  const quatreFois = construireEcheancier(1200, '4x_maison');
  egal('4× sans frais : quatre échéances', quatreFois.echeances.length, 4);
  egalEuros('4× sans frais : aucun frais', quatreFois.frais, 0);
  egalEuros(
    '4× sans frais : la somme fait le total',
    quatreFois.echeances.reduce((n, e) => n + e.montant, 0),
    1200,
  );

  const dixAlma = construireEcheancier(1200, '10x_alma');
  egal('10× Alma : dix échéances', dixAlma.echeances.length, 10);
  verifie('10× Alma : des frais s’ajoutent', dixAlma.frais > 0);
  egalEuros(
    '10× Alma : la somme fait le montant à régler',
    dixAlma.echeances.reduce((n, e) => n + e.montant, 0),
    dixAlma.montantARegler,
    0.01,
  );

  const repris = construireEcheancier(900, 'inconnu');
  egal('une cure reprise du CRM n’invente pas d’échéancier', repris.echeances.length, 0);

  section('La durée de la cure plafonne les chèques');

  /*
    On n'encaisse pas un chèque après la dernière séance. Les paliers
    viennent de la maquette du diagnostic : le soin le plus long donne le
    tempo, et trois soins principaux ajoutent un mois.
  */
  egal('dix séances tiennent en trois mois', dureeCureEnMois(10, 1), 3);
  egal('treize aussi', dureeCureEnMois(13, 1), 3);
  egal('quatorze font quatre mois', dureeCureEnMois(14, 1), 4);
  egal('seize aussi', dureeCureEnMois(16, 2), 4);
  egal('dix-sept font cinq mois', dureeCureEnMois(17, 1), 5);
  egal('trois soins principaux ajoutent un mois', dureeCureEnMois(12, 3), 4);
  egal('deux soins n’ajoutent rien', dureeCureEnMois(12, 2), 3);
  egal('une cure vide ne dure pas zéro mois', dureeCureEnMois(0, 0), 1);

  egal('une cure de trois mois n’accepte que trois chèques', echeancesCentrePossibles(3), [1, 2, 3]);
  egal('quatre mois rouvrent le quatrième', echeancesCentrePossibles(4), [1, 2, 3, 4]);
  egal('cinq mois ne vont pas au-delà de quatre', echeancesCentrePossibles(5), [1, 2, 3, 4]);
  egal('un mois ne laisse que le comptant', echeancesCentrePossibles(1), [1]);

  /*
    Le cas qui a motivé la règle : la thérapeute réduit l'offre, et le
    quatrième chèque doit disparaître de lui-même.
  */
  const pleine = dureeCureEnMois(20, 2);
  const reduite = dureeCureEnMois(Math.round(20 * 0.5), 2);
  egal('la cure entière tient sur quatre chèques', echeancesCentrePossibles(pleine).length, 4);
  egal('la formule Découverte les ramène à trois', echeancesCentrePossibles(reduite).length, 3);

  section('L’acompte de celle qui ne peut pas tout régler');

  /*
    La règle de Jonathan, mot pour mot : le prix du bilan, plus une séance
    par créneau bloqué dans le planning. Trois soins enchaînés, c'est 1h30
    réservée, donc trois séances dues.
  */
  egalEuros(
    'bilan + trois créneaux = 306 €',
    montantAcompte({ prixBilan: 129, creneauxReserves: 3, prixSeance: 59 }),
    306,
  );
  egalEuros(
    'un seul créneau, un seul soin',
    montantAcompte({ prixBilan: 129, creneauxReserves: 1, prixSeance: 59 }),
    188,
  );
  egalEuros(
    'aucun créneau réservé : le bilan seul',
    montantAcompte({ prixBilan: 129, creneauxReserves: 0, prixSeance: 59 }),
    129,
  );
  egal('autant de créneaux que de soins', creneauxParDefaut(3), 3);
  egal('jamais zéro créneau par défaut', creneauxParDefaut(0), 1);

  section('L’acompte se déduit, il ne s’ajoute pas');

  const avecAcompte = construireEcheancierCure({
    seances: 27,
    prixSeance: 59,
    options: 89,
    methode: 'centre',
    n: 3,
    acompte: 306,
  });

  egalEuros('le total ne bouge pas', avecAcompte.montantARegler, 27 * 59 + 89);
  egal('l’acompte est la première ligne', avecAcompte.echeances[0].type, 'acompte');
  egalEuros('et vaut ce qui a été calculé', avecAcompte.echeances[0].montant, 306);
  egal('les suivantes sont des échéances', avecAcompte.echeances[1].type, 'echeance');
  egal('trois échéances après l’acompte', avecAcompte.echeances.filter((e) => e.type === 'echeance').length, 3);
  egalEuros(
    'tout est réparti, rien n’est perdu',
    avecAcompte.echeances.reduce((n, e) => n + e.montant, 0),
    27 * 59 + 89,
  );

  section('Sans acompte, rien ne change');

  const sansAcompte = construireEcheancierCure({
    seances: 27,
    prixSeance: 59,
    options: 89,
    methode: 'centre',
    n: 3,
  });
  egal('aucune ligne d’acompte', sansAcompte.echeances.some((e) => e.type === 'acompte'), false);
  egal('trois échéances', sansAcompte.echeances.length, 3);
  egalEuros('même total', sansAcompte.montantARegler, avecAcompte.montantARegler);

  section('Les cas limites de l’acompte');

  const comptantAvecAcompte = construireEcheancierCure({
    seances: 12, prixSeance: 59, options: 29, methode: 'centre', n: 1, acompte: 188,
  });
  egal(
    'un acompte n’est jamais avalé par le règlement comptant',
    comptantAvecAcompte.echeances[0].type,
    'acompte',
  );
  egalEuros(
    'et le solde suit',
    comptantAvecAcompte.echeances.reduce((n, e) => n + e.montant, 0),
    12 * 59 + 29,
  );

  const trop = construireEcheancierCure({
    seances: 10, prixSeance: 59, options: 29, methode: 'centre', n: 2, acompte: 5000,
  });
  egalEuros(
    'un acompte plus gros que la cure se ramène à la cure',
    trop.echeances.reduce((n, e) => n + e.montant, 0),
    10 * 59 + 29,
  );

  section('Les frais Alma, relevés sur le compte MB3PRO');

  /*
    Dix simulations réelles, faites par Jonathan le 4 septembre 2026 dans son
    propre compte Alma. Ce ne sont pas des valeurs théoriques : c'est ce qui
    est prélevé sur le compte de la cliente.

    Le piège qui nous avait fait facturer 11 € de trop : le tableau de bord
    Alma affiche le taux client ET le taux d'usure juste en dessous, en
    rouge. Le 4× avait été saisi à 2,58 %, son taux d'usure, au lieu de 1,9 %.
  */
  const relevesAlma: Array<[number, number, number]> = [
    // [montant, échéances, frais réellement prélevés]
    [1800, 3, 31.14],
    [1623, 4, 30.84],
    [1800, 4, 34.2],
    [1853, 4, 35.21],
    [2153, 4, 40.91],
    [973, 10, 67.61],
    [2153, 10, 149.61],
    [973, 12, 78.87],
    [2153, 12, 174.53],
  ];

  for (const [montant, n, attendu] of relevesAlma) {
    egalEuros(`${montant} € en ${n}×`, fraisAlma(n, montant), attendu, 0.005);
  }

  /*
    Le seul écart connu : 1 623 € en 3×. Alma prélève 28,07 €, notre taux
    publié de 1,73 % donne 28,08 €. Un centime, sur un cas sur dix. On garde
    le taux qu'Alma publie plutôt que d'en inventer un pour rattraper un
    arrondi.
  */
  egalEuros('1 623 € en 3× : un centime au-dessus d’Alma, assumé', fraisAlma(3, 1623), 28.08, 0.005);

  egalEuros('le 4× n’est plus au taux d’usure', tauxFraisAlma(4, 1000), 1.9);
  egalEuros('le 10× baisse au-delà de 3 333 €', tauxFraisAlma(10, 3400), 5.4297);
  egalEuros('le 12× baisse au-delà de 3 273 €', tauxFraisAlma(12, 3300), 6.6894);
  egalEuros('en dessous du seuil, le taux plein', tauxFraisAlma(10, 3000), 6.9489);

  section('Alma ne répartit pas pareil selon la formule');

  /*
    2×, 3×, 4× : la totalité des frais tombe sur le premier versement.
    Relevé : 1 623 € en 3× → 569,07 aujourd'hui, puis 541,00 et 541,00.
  */
  const fractionne = construireEcheancierCure({
    seances: 27, prixSeance: 59, options: 30, methode: 'alma', n: 3,
  });
  egalEuros('le montant de la cure est bien 1 623 €', fractionne.montantARegler - fractionne.frais, 1623);
  egalEuros('les deux dernières valent le montant divisé, rond', fractionne.echeances[1].montant, 541);
  egalEuros('la dernière aussi', fractionne.echeances[2].montant, 541);
  egalEuros(
    'la première porte toute la charge des frais',
    fractionne.echeances[0].montant,
    541 + fractionne.frais,
  );
  egalEuros(
    'et rien ne se perd',
    fractionne.echeances.reduce((n, e) => n + e.montant, 0),
    fractionne.montantARegler,
  );

  /*
    10× et 12× : crédit amorti, mensualités égales, reliquat sur la première.
    Relevé : 973 € en 12× → 87,72 puis onze fois 87,65.
  */
  const credit = construireEcheancierCure({
    seances: 16, prixSeance: 59, options: 29, methode: 'alma', n: 12,
  });
  egalEuros('le montant de la cure est bien 973 €', credit.montantARegler - credit.frais, 973);
  egalEuros('douze mensualités', credit.echeances.length, 12);
  egalEuros('la première absorbe le reliquat', credit.echeances[0].montant, 87.72);
  egalEuros('les onze suivantes sont égales', credit.echeances[11].montant, 87.65);
  egalEuros(
    'et rien ne se perd non plus',
    credit.echeances.reduce((n, e) => n + e.montant, 0),
    credit.montantARegler,
  );
}
