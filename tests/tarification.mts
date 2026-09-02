/*
  La tarification et les échéanciers.

  C'est ce qui décide de ce que la cliente paie, et de ce qui figure sur son
  contrat. Une erreur d'un euro ici est une erreur sur un document signé.
*/

import { section, verifie, egal, egalEuros } from './harnais.mts';
import {
  ECHEANCES_ALMA,
  ECHEANCES_CENTRE,
  FRAIS_ALMA,
  calculerMontant,
  construireEcheancier,
  construireEcheancierCure,
  modeReglement,
  prixUnitaireParDefaut,
  repartirSeances,
  type GrilleTarifaire,
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
    egalEuros(`${n}× : les frais suivent le barème`, alma.frais, Math.round(base * FRAIS_ALMA[n]) / 100 * 1, 0.02);
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
}
