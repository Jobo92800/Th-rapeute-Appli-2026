/*
  La caisse : ce qui est entré, et ce qui en repart.

  Un ticket Z se présente au comptable et sert à faire la banque. Deux
  erreurs y coûtent cher : compter comme recette les frais d'Alma, qui ne
  sont jamais arrivés sur le compte du centre, et afficher les douze
  échéances d'une cure financée comme douze encaissements d'un même jour.
  D'où ces contrôles.
*/

import { section, verifie, egal, egalEuros } from './harnais.mts';
import {
  arreterLaCaisse,
  fraisImputables,
  libelleDuMoyen,
  parOrdreDesMoyens,
  regrouperLesReglements,
  totauxParMoyen,
  type LigneDeReglement,
  type MoyenDeReglement,
} from '../src/domain/caisse.ts';

function ligne(p: Partial<LigneDeReglement> = {}): LigneDeReglement {
  return {
    centre_id: 'avignon',
    cliente: 'Beatrice BERTEAU',
    cliente_id: 'c1',
    date_reglement: '2026-11-10',
    moyen: 'cb',
    type: 'echeance',
    rang: 1,
    montant: 100,
    programme_id: 'p1',
    montant_cure: 400,
    frais: 0,
    mode_reglement: 'centre_4x',
    nb_echeances: 4,
    montant_alma: 0,
    ...p,
  };
}

/** Une cure Alma telle que la base la rend : une échéance par mensualité. */
function cureAlma(nb: number, montant: number, cure: number, frais: number): LigneDeReglement[] {
  const total = montant * nb;
  return Array.from({ length: nb }, (_, i) =>
    ligne({
      cliente: 'Sylvie ROCA',
      moyen: 'alma',
      rang: i + 1,
      montant,
      programme_id: 'alma1',
      montant_cure: cure,
      frais,
      mode_reglement: `alma_${nb}x`,
      nb_echeances: nb,
      montant_alma: total,
    }),
  );
}

/*
  La cure Alma de Beatrice BERTEAU, telle qu'elle est en base : dix
  mensualités dont la première absorbe le reste de la division. Les
  centimes comptent — le ticket doit retomber sur le relevé bancaire.
*/
function avignon(): LigneDeReglement[] {
  const montants = [161.03, 160.95, 160.95, 160.95, 160.95, 160.95, 160.95, 160.95, 160.95, 160.95];
  return montants.map((montant, i) =>
    ligne({
      moyen: 'alma',
      rang: i + 1,
      montant,
      programme_id: 'avignon1',
      montant_cure: 1505,
      frais: 104.58,
      mode_reglement: 'alma_10x',
      nb_echeances: 10,
      montant_alma: 1609.58,
    }),
  );
}

export function controlerCaisse() {
  section('La caisse — regroupement des règlements');

  {
    const entrees = regrouperLesReglements(cureAlma(12, 135.49, 1504, 121.92));
    egal('une cure Alma ne fait qu’une entrée', entrees.length, 1);
    egal('et elle dit combien d’échéances elle rassemble', entrees[0]!.echeances, 12);
    egal('au nom de la cliente', entrees[0]!.cliente, 'Sylvie ROCA');
    egal('et sait où mène son nom', entrees[0]!.clienteId, 'c1');
  }

  {
    const entrees = regrouperLesReglements([
      ligne({ cliente: 'karine ALBO', montant: 295, rang: 2 }),
      ligne({ cliente: 'Alexia SWINNEN', montant: 561, programme_id: 'p2' }),
    ]);
    egal('deux règlements en carte restent deux lignes', entrees.length, 2);
    egal('chacun garde sa cliente', entrees.map((e) => e.clienteId), ['c1', 'c1']);
  }

  {
    // Deux échéances de la même cure, pointées le même jour, mais en carte :
    // ce sont deux gestes distincts au comptoir, pas un financement.
    const entrees = regrouperLesReglements([
      ligne({ cliente: 'ELEONORE SEGRETO', montant: 85, rang: 1, moyen: null }),
      ligne({ cliente: 'ELEONORE SEGRETO', montant: 85, rang: 2, moyen: null }),
    ]);
    egal('deux échéances hors Alma ne se regroupent pas', entrees.length, 2);
  }

  {
    const entrees = regrouperLesReglements([
      ...cureAlma(4, 100, 400, 20),
      ...cureAlma(4, 100, 400, 20).map((l) => ({ ...l, date_reglement: '2026-12-10' })),
    ]);
    egal('deux dates de règlement font deux entrées', entrees.length, 2);
  }

  section('La caisse — les frais du crédit');

  {
    const entrees = regrouperLesReglements(avignon());
    egalEuros('toute la cure passée, les frais entiers', entrees[0]!.frais, 104.58);
  }

  {
    egalEuros('la moitié passée, la moitié des frais', fraisImputables(500, 1000, 100), 50);
    egal('rien par Alma, aucun frais', fraisImputables(0, 1000, 100), 0);
    egal('une cure sans frais n’en invente pas', fraisImputables(500, 500, 0), 0);
    egal('une cure qui ne doit rien à Alma non plus', fraisImputables(500, 0, 100), 0);
  }

  {
    // Le bilan anti-âge réglé en carte sur une cure financée : il n'a
    // supporté aucun frais, et n'a pas à en porter.
    const entrees = regrouperLesReglements([
      ligne({ cliente: 'A B', moyen: 'cb', montant: 89, programme_id: 'mixte', montant_cure: 879, frais: 15.01, montant_alma: 805.01, type: 'bilan' }),
      ...Array.from({ length: 4 }, (_, i) =>
        ligne({ cliente: 'A B', moyen: 'alma' as MoyenDeReglement, rang: i + 1, montant: 201.2525, programme_id: 'mixte', montant_cure: 879, frais: 15.01, montant_alma: 805.01 }),
      ),
    ]);
    const carte = entrees.find((e) => e.moyen === 'cb')!;
    const alma = entrees.find((e) => e.moyen === 'alma')!;
    egal('le règlement en carte ne porte aucun frais', carte.frais, 0);
    egalEuros('les frais sont tous sur la part Alma', alma.frais, 15.01);
  }

  section('La caisse — l’arrêté');

  {
    const entrees = regrouperLesReglements([
      ...avignon(),
      ligne({ cliente: 'Amandine BRASSE', moyen: 'especes', montant: 163, programme_id: 'p9' }),
    ]);
    const arrete = arreterLaCaisse(entrees);
    egalEuros('l’encaissé additionne tout ce qui est entré', arrete.encaisse, 1772.58);
    egalEuros('les frais ne sont comptés qu’une fois', arrete.frais, 104.58);
    egalEuros('le net, c’est ce qui reste au centre', arrete.net, 1668);
    verifie('et il retombe toujours sur encaissé moins frais',
      Math.abs(arrete.net - (arrete.encaisse - arrete.frais)) < 0.005);
  }

  {
    const arrete = arreterLaCaisse([]);
    egal('une caisse vide s’arrête à zéro', arrete, { encaisse: 0, frais: 0, net: 0 });
  }

  section('La caisse — la lecture du ticket');

  {
    const totaux = totauxParMoyen(
      regrouperLesReglements([
        ligne({ moyen: 'cb', montant: 708, programme_id: 'a' }),
        ligne({ moyen: 'cb', montant: 443, programme_id: 'b' }),
        ligne({ moyen: 'especes', montant: 163, programme_id: 'c' }),
        ligne({ moyen: null, montant: 170, programme_id: 'd' }),
      ]),
    );
    egal('les espèces passent devant', totaux[0]!.moyen, 'especes');
    egal('le moyen non renseigné ferme la marche', totaux[totaux.length - 1]!.moyen, null);
    egalEuros('la carte est cumulée', totaux.find((t) => t.moyen === 'cb')!.montant, 1151);
    egal('et comptée en nombre de règlements', totaux.find((t) => t.moyen === 'cb')!.nb, 2);
  }

  {
    egal('un moyen manquant se nomme, il ne se cache pas', libelleDuMoyen(null), 'Moyen non renseigné');
    verifie('Alma se range après la carte', parOrdreDesMoyens('cb', 'alma') < 0);
  }
}
