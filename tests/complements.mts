/*
  Les compléments alimentaires choisis avec la cure.

  Jonathan, 18 septembre 2026 : 37 € la boîte, comptés dans le montant de
  la cure, et toujours sur la première échéance quand elle règle en
  plusieurs fois — comme le guide et la tenue.
*/

import { section, verifie, egal, egalEuros } from './harnais.mts';
import {
  complementsChoisis,
  libelleBoites,
  libelleComplements,
  montantComplements,
  nombreDeBoites,
} from '../src/domain/complements.ts';
import {
  calculerMontant,
  construireEcheancierCure,
  type GrilleTarifaire,
} from '../src/domain/tarification.ts';

const GRILLE: GrilleTarifaire = {
  seance: 59,
  guide: 29,
  tenue: 60,
  bilan: 129,
  dome: 49,
  advance_lift: 85,
  radiofrequence: 79,
  radiofrequence_decollete: 139,
  bilan_signature: 89,
  complement: 37,
};

const RAYON = [
  { code: 'BURN', nom: 'BURN' },
  { code: 'SOS', nom: 'S.O.S' },
  { code: 'DETOX', nom: 'DÉTOX' },
  { code: 'SKIN', nom: 'SKIN' },
];

export function controlerComplements() {
  section('Les boîtes choisies avec la cure');

  const choix = complementsChoisis({ BURN: 2, DETOX: 1, SKIN: 0, INCONNU: 3 }, RAYON, 37);
  egal('les zéros et les produits hors rayon sont ignorés', choix.length, 2);
  egal('3 boîtes en tout', nombreDeBoites(choix), 3);
  egalEuros('3 × 37 €', montantComplements(choix), 111);
  egal('le libellé nomme chaque produit', libelleComplements(choix), 'BURN ×2, DÉTOX ×1');
  egal('une boîte, au singulier', libelleBoites(1), '1 boîte de compléments alimentaires');
  egal('trois boîtes, au pluriel', libelleBoites(3), '3 boîtes de compléments alimentaires');
  egal('sans choix, aucun montant', montantComplements([]), 0);

  section('Les boîtes entrent dans le montant de la cure');

  const detail = calculerMontant(
    [{ technologie: 'luxo', seances: 20, prixUnitaire: 59 }],
    { tenue: false, guide: true, boites: 2 },
    GRILLE,
  );
  egalEuros('2 boîtes ajoutent 74 €', detail.montantComplements, 74);
  egalEuros('20 luxo + guide + 2 boîtes', detail.total, 1180 + 29 + 74);
  egal(
    'sans boîte, rien ne change',
    calculerMontant([{ technologie: 'luxo', seances: 20, prixUnitaire: 59 }], { tenue: false, guide: true }, GRILLE).total,
    1209,
  );
  egal(
    'un nombre de boîtes négatif ne retire pas d’argent',
    calculerMontant([{ technologie: 'luxo', seances: 10, prixUnitaire: 59 }], { tenue: false, guide: false, boites: -2 }, GRILLE)
      .montantComplements,
    0,
  );

  section('Les boîtes tombent sur la première échéance');

  // 20 luxo + guide + 2 boîtes, en 4 fois au centre : les séances se
  // répartissent 5 · 5 · 5 · 5, le guide et les boîtes sur la première.
  const centre = construireEcheancierCure({
    seances: 20,
    prixSeance: 59,
    options: 29 + 74,
    methode: 'centre',
    n: 4,
  });
  egal('quatre chèques', centre.echeances.length, 4);
  egalEuros('le premier porte les 5 séances, le guide et les boîtes', centre.echeances[0].montant, 295 + 29 + 74);
  egalEuros('le deuxième ne porte que des séances', centre.echeances[1].montant, 295);
  egalEuros('le dernier aussi', centre.echeances[3].montant, 295);
  egalEuros(
    'la somme retombe sur le total',
    centre.echeances.reduce((s, e) => s + e.montant, 0),
    1283,
  );
  verifie(
    'aucun chèque à virgule',
    centre.echeances.every((e) => Number.isInteger(e.montant)),
  );

  // Chez Alma, les boîtes sont dans le montant financé : les frais les couvrent.
  const alma = construireEcheancierCure({
    seances: 20,
    prixSeance: 59,
    options: 29 + 74,
    methode: 'alma',
    n: 10,
  });
  egalEuros('Alma finance la cure boîtes comprises', alma.montantARegler - alma.frais, 1283);

  // Sur l'anti-âge, sans guide ni tenue, une boîte est tout ce qui n'est pas une séance.
  const antiAge = construireEcheancierCure({
    seances: 6,
    prixSeance: 85,
    options: 37,
    methode: 'centre',
    n: 3,
  });
  egalEuros('6 Advance Lift + 1 boîte en 3 : 2 séances et la boîte d’abord', antiAge.echeances[0].montant, 170 + 37);
  egalEuros('puis 2 séances', antiAge.echeances[1].montant, 170);
}

export function controlerCureSansSeance() {
  section('Une cure qui ne contient que des compléments');

  // Une cliente qui ne reprend que ses boîtes : aucune séance, un seul règlement.
  const seule = construireEcheancierCure({
    seances: 0,
    prixSeance: 59,
    options: 148,
    methode: 'centre',
    n: 1,
  });
  egal('une seule échéance', seule.echeances.length, 1);
  egalEuros('qui porte les boîtes', seule.echeances[0].montant, 148);
  egal('réglée comptant', seule.mode, 'comptant');
  egalEuros('le montant est celui des boîtes', seule.montantARegler, 148);

  const detail = calculerMontant([], { tenue: false, guide: false, boites: 4 }, GRILLE);
  egal('aucune séance', detail.totalSeances, 0);
  egalEuros('4 boîtes font 148 €', detail.total, 148);
}
