/*
  Le reste des règles : le BioPortrait, le parrainage, le stock, les
  règlements, le contrat.
*/

import { section, verifie, egal, egalEuros } from './harnais.mts';
import { baremeLivre } from './prescription.mts';
import { calculerBioPortrait, choix, relireLesReponses, scoresMaximum } from '../src/domain/bioportrait.ts';
import {
  PLAFOND_SEANCES,
  SEANCES_PAR_FILLEULE,
  calculerSolde,
  soldeDepuisCompteurs,
  type Filleule,
} from '../src/domain/parrainage.ts';
import { finDeCure, libelleFinDeCure, niveauStock } from '../src/domain/stock.ts';
import {
  JOURS_AVANT_PREMIERE_ECHEANCE,
  datesEcheancier,
  encaisseHorsFrais,
  datesEcheancierApresAcompte,
  echeanceIntouchable,
  reechelonner,
  refusDeReechelonner,
} from '../src/domain/reglement.ts';
import { evolution, libelleEvolution } from '../src/domain/tableauDeBord.ts';
import { construireContrat } from '../src/domain/contrat.ts';
import type { Centre, Cliente, Echeance, LigneProgramme, Programme } from '../src/types/db.ts';

export function controlerMetier() {
  const bareme = baremeLivre();

  section('Le BioPortrait');

  const max = scoresMaximum(bareme);
  verifie('chaque axe peut être atteint', Object.values(max).every((v) => v > 0), JSON.stringify(max));

  const vide = calculerBioPortrait(bareme, {});
  verifie('sans réponse, tous les axes sont à zéro', Object.values(vide.pourcentages).every((p) => p === 0));

  // Une question à cases à cocher doit compter toutes les réponses.
  const iMulti = bareme.STEPS.findIndex((e) => e.type === 'multi');
  egal('une réponse unique se lit comme une liste', choix({ 3: 2 }, 3), [2]);
  egal('une réponse multiple se lit telle quelle', choix({ [iMulti]: [0, 2] }, iMulti), [0, 2]);
  egal('une étape sans réponse ne renvoie rien', choix({}, 5), []);

  // Réponses les plus fortes partout : les dominants doivent ressortir.
  const fortes: Record<number, number> = {};
  bareme.STEPS.forEach((e, i) => {
    if (!e.o || e.type === 'multi') return;
    let meilleur = 0;
    let total = -1;
    e.o.forEach((o, j) => {
      const somme = Object.values(o[1] ?? {}).reduce((a: number, b) => a + (b as number), 0);
      if (somme > total) {
        total = somme;
        meilleur = j;
      }
    });
    fortes[i] = meilleur;
  });

  const chargee = calculerBioPortrait(bareme, fortes);
  verifie('un profil dominant se dégage', Boolean(chargee.profilDominant));
  verifie('un terrain dominant se dégage', Boolean(chargee.terrainDominant));
  verifie(
    'aucun pourcentage ne dépasse cent',
    Object.values(chargee.pourcentages).every((p) => p >= 0 && p <= 100),
    JSON.stringify(chargee.pourcentages),
  );
  verifie(
    'les profils sont triés du plus fort au plus faible',
    chargee.profilsTries.every((a, i) =>
      i === 0 ? true : chargee.pourcentages[chargee.profilsTries[i - 1]] >= chargee.pourcentages[a],
    ),
  );

  /*
    RELIRE CE QU'ELLE A RÉPONDU.

    Le bouton « Mes réponses » de la fiche : chaque question posée, avec le
    libellé choisi. Ni l'InBody — ce ne sont pas ses réponses — ni les
    écrans de service.
  */
  section('Relire les réponses du questionnaire');

  const questions = bareme.STEPS
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.phase === 'client' && e.o);
  const radio = questions.find(({ e }) => e.type === 'radio')!;
  const relues = relireLesReponses(bareme, { [radio.i]: 1, [iMulti]: [0, 2] }, null);
  const ligneRadio = relues.find((r) => r.question === radio.e.t)!;

  egal('autant de lignes que de questions posées', relues.length, questions.length);
  egal('les questions gardent l’ordre du questionnaire', relues[0].question, questions[0].e.t);
  egal('le libellé choisi, en toutes lettres', ligneRadio.reponses, [radio.e.o![1][0]]);
  verifie('le thème vient du barème', ligneRadio.theme.length > 0, ligneRadio.theme);
  const ligneMulti = relues.find((r) => r.question === bareme.STEPS[iMulti].t);
  egal('une question à cases rend toutes les cases', ligneMulti?.reponses.length, 2);
  verifie('une question sans réponse reste vide, pas absente', relues.some((r) => r.reponses.length === 0));
  verifie(
    'aucune mesure InBody parmi les réponses',
    !relues.some((r) => bareme.STEPS.some((e) => e.phase === 'analyse' && e.t === r.question)),
  );
  egal('un barème vide ne rend rien', relireLesReponses({ ...bareme, STEPS: [] }, {}, null), []);

  section('Le parrainage');

  const filleule = (engagee: boolean): Filleule => ({
    id: Math.random().toString(),
    prenom: 'A',
    nom: 'B',
    centre_id: 'grau-du-roi',
    centre: 'Le Grau-du-Roi',
    engagee_le: engagee ? '2026-03-01' : null,
  });

  egal('aucune filleule, rien à poser', calculerSolde([], 0).disponibles, 0);
  egal(
    'une filleule non engagée ne rapporte rien',
    calculerSolde([filleule(false)], 0).gagnees,
    0,
  );
  egal(
    'une filleule engagée vaut deux séances',
    calculerSolde([filleule(true)], 0).gagnees,
    SEANCES_PAR_FILLEULE,
  );
  egal(
    'trois filleules engagées valent six séances',
    calculerSolde([filleule(true), filleule(true), filleule(true)], 0).gagnees,
    6,
  );

  const dix = Array.from({ length: 8 }, () => filleule(true));
  egal('le plafond de dix séances tient', calculerSolde(dix, 0).gagnees, PLAFOND_SEANCES);
  verifie('le plafond est signalé', calculerSolde(dix, 0).plafondAtteint);

  egal(
    'ce qui est déjà posé se retire du solde',
    calculerSolde([filleule(true), filleule(true)], 3).disponibles,
    1,
  );
  egal(
    'poser plus que gagné ne rend jamais un solde négatif',
    calculerSolde([filleule(true)], 10).disponibles,
    0,
  );
  egal(
    'le calcul par compteurs donne le même résultat',
    soldeDepuisCompteurs(2, 1).disponibles,
    calculerSolde([filleule(true), filleule(true)], 1).disponibles,
  );

  section('Le stock');

  egal('zéro en rayon, c’est une rupture', niveauStock(0, 5, 2), 'rupture');
  egal('un stock négatif reste une rupture', niveauStock(-3, 5, 2), 'rupture');
  egal('au seuil critique', niveauStock(2, 5, 2), 'critique');
  egal('au seuil d’alerte', niveauStock(5, 5, 2), 'bas');
  egal('au-dessus, tout va bien', niveauStock(6, 5, 2), 'ok');

  const debut = new Date('2026-03-01');
  const boite = finDeCure('2026-03-01', 1, 15, new Date('2026-03-10'));
  egal('une boîte de quinze jours se termine dans six jours', boite.joursRestants, 6);
  verifie('elle n’est pas encore terminée', !boite.terminee);

  const deux = finDeCure('2026-03-01', 2, 15, debut);
  egal('deux boîtes durent deux fois plus longtemps', deux.joursRestants, 30);

  const finie = finDeCure('2026-03-01', 1, 15, new Date('2026-03-20'));
  verifie('passé la date, la cure est terminée', finie.terminee);
  egal('et on dit depuis combien de temps', libelleFinDeCure(finie), 'Terminée depuis 4 jours');

  const sos = finDeCure('2026-03-01', 1, null, debut);
  egal('le S.O.S n’a pas d’échéance', sos.joursRestants, null);
  egal('et on le dit', libelleFinDeCure(sos), 'Pas d’échéance');

  section('Les évolutions du tableau de bord');

  egal('une hausse de moitié', evolution(150, 100), 50);
  egal('une baisse de moitié', evolution(50, 100), -50);
  egal('sans période précédente, pas de comparaison', evolution(150, 0), null);
  egal('une variation négligeable se dit « stable »', libelleEvolution(0), 'stable');
  egal('une hausse s’annonce avec un plus', libelleEvolution(12), '+12 %');
  egal('une baisse avec un moins', libelleEvolution(-12), '−12 %');

  section('Le contrat');

  const cliente = {
    prenom: 'Camille',
    nom: 'Durand',
    civilite: 'Mme',
    telephone: '0612345678',
    email: 'c@example.fr',
    adresse: '3 rue des Tamaris',
    code_postal: '30240',
    ville: 'Le Grau-du-Roi',
  } as unknown as Cliente;

  const centre = {
    nom: 'Le Grau-du-Roi',
    societe: 'MB1PRO',
    siren: '853 874 428 00016',
    adresse: '577 Rue des Tamaris',
    code_postal: '30240',
    ville: 'Le Grau-du-Roi',
    telephone: '04 66 73 02 00',
    email: 'contact@mabeautyplus.fr',
    siege_adresse: '577 Rue des Tamaris',
    siege_code_postal: '30240',
    siege_ville: 'Le Grau-du-Roi',
  } as unknown as Centre;

  const programme = {
    numero: 1,
    montant_total: 1180,
    frais_financement: 76.7,
    mode_reglement: 'alma_10x',
  } as unknown as Programme;

  const lignes = [
    { technologie: 'luxo', seances_prevues: 12, seances_offertes: 4, prix_unitaire: 59 },
    { technologie: 'relax', seances_prevues: 5, seances_offertes: 0, prix_unitaire: 59 },
  ] as unknown as LigneProgramme[];

  const echeances = [
    { type: 'echeance', rang: 1, montant: 125.67, date_prevue: '2026-04-01', statut: 'a_venir' },
  ] as unknown as Echeance[];

  const contrat = construireContrat({ cliente, centre, programme, lignes, echeances });

  egal('la civilité figure au contrat', contrat.clientCivility, 'Madame');
  verifie(
    'la Luxothérapie apparaît avec ses douze séances facturées',
    contrat.careItems.some((c) => c.label === 'Luxothérapie' && c.sessions === 12 && c.checked),
  );
  verifie(
    'la Relaxation a sa propre ligne',
    contrat.careItems.some((c) => c.label === 'Luxothérapie Relaxation' && c.sessions === 5),
  );
  egal('les séances offertes sont annoncées', contrat.offeredSessions, 4);
  /*
    Le total s'écrit avec une espace ordinaire, et c'est capital : les polices
    d'un PDF ne savent pas dessiner l'espace fine insécable du français, et
    l'impriment « / ». Le contrat est parti quelque temps avec « 1 / 256,70 € »
    écrit dessus, sur un document que la cliente signe.
  */
  /*
    LE CONTRAT DIT LE PRIX DE LA CURE, PAS LE COÛT DU CRÉDIT.

    Ce document engage MAbeautyplus et la cliente sur une prestation. Les
    frais Alma ne rémunèrent rien de ce que le centre vend : ils sont le
    coût du crédit qu'elle contracte auprès de l'organisme, et ils figurent
    sur le contrat qu'elle signe avec lui.
  */
  egal('chez Alma, le contrat annonce la cure seule', contrat.totalAmount, '1 180,00 €');

  const contratCheques = construireContrat({
    cliente,
    centre,
    programme: { ...programme, mode_reglement: 'centre_4x', frais_financement: 0 } as unknown as Programme,
    lignes,
    echeances,
  });
  egal('au centre, le total est le même — il n’y a pas de frais', contratCheques.totalAmount, '1 180,00 €');
  verifie(
    'aucune espace exotique dans un montant du contrat',
    !/[\u202f\u2009\u00a0\u2007]/.test(contrat.totalAmount),
    JSON.stringify(contrat.totalAmount),
  );
  verifie(
    'la Relaxation ne fait pas signer un consentement de plus',
    contrat.activeServiceIds.filter((s) => s === 'luxo-pdp').length === 1,
    contrat.activeServiceIds.join(','),
  );

  /*
    REDÉCOUPER UN ÉCHÉANCIER.

    Ce qui se joue ici, c'est de l'argent déjà annoncé à une cliente : le
    total ne doit pas bouger d'un centime, et ce qui a été réglé ne doit
    jamais être touché.
  */
  /*
    LE CALENDRIER QUAND IL Y A UN ACOMPTE.

    Demande de Jonathan, le 10 septembre 2026 : une cliente qui verse un
    acompte ne doit pas attendre un mois entier avant sa première échéance —
    quinze jours au plus. Le reste du calendrier ne bouge pas : le 10 de
    chaque mois reste le 10 de chaque mois.
  */
  section('L’acompte rapproche la première échéance, et elle seule');

  const LE_10 = new Date('2026-09-10T09:00:00Z');

  egal(
    'sans acompte : le jour même, puis une par mois',
    datesEcheancier(LE_10, 5).join(' · '),
    '2026-09-10 · 2026-10-10 · 2026-11-10 · 2026-12-10 · 2027-01-10',
  );
  egal(
    'avec acompte : quinze jours, puis le calendrier de la cure',
    datesEcheancierApresAcompte(LE_10, 5).join(' · '),
    '2026-09-10 · 2026-09-25 · 2026-10-10 · 2026-11-10 · 2026-12-10',
  );
  egal('l’acompte garde le jour de la cure', datesEcheancierApresAcompte(LE_10, 5)[0], '2026-09-10');
  verifie(
    'et la première échéance ne dépasse jamais quinze jours',
    (new Date(datesEcheancierApresAcompte(LE_10, 5)[1]).getTime() - new Date('2026-09-10').getTime()) /
      86400000 <=
      JOURS_AVANT_PREMIERE_ECHEANCE,
  );
  egal('un acompte seul ne fabrique pas d’échéance', datesEcheancierApresAcompte(LE_10, 1).length, 1);
  egal('et rien du tout reste rien du tout', datesEcheancierApresAcompte(LE_10, 0).length, 0);

  /*
    L'ENCAISSÉ DU CENTRE N'EST PAS CE QUE RÈGLE LA CLIENTE.

    Défaut relevé par Jonathan le 10 septembre 2026 : sur une cure Alma à
    1 269 €, l'onglet annonçait 1 357 € encaissés — la cure plus les 88,18 €
    de frais, qui vont à l'organisme et que le centre ne reçoit jamais.
  */
  section('Les frais Alma ne sont pas du chiffre d’affaires du centre');

  egalEuros('tout réglé : le centre a sa cure, pas les frais', encaisseHorsFrais(1357.18, 1269, 88.18), 1269);
  egalEuros('rien réglé : rien encaissé', encaisseHorsFrais(0, 1269, 88.18), 0);
  egalEuros('sans frais, rien ne change', encaisseHorsFrais(619, 619, 0), 619);
  egalEuros('à moitié réglé, la moitié de la cure', encaisseHorsFrais(1357.18 / 2, 1269, 88.18), 634.5);
  verifie(
    'et jamais plus que la cure',
    encaisseHorsFrais(1357.18, 1269, 88.18) <= 1269,
  );

  section('Redécouper ce qui reste dû');

  const ech = (
    rang: number,
    montant: number,
    statut: Echeance['statut'],
    type: Echeance['type'] = 'echeance',
  ) => ({ id: `e${rang}${type}`, rang, montant, statut, type }) as unknown as Echeance;

  const quatreDues = [
    ech(1, 501, 'a_venir'),
    ech(2, 472, 'a_venir'),
    ech(3, 413, 'a_venir'),
    ech(4, 413, 'a_venir'),
  ];

  const enTrois = reechelonner(quatreDues, 3, new Date('2026-10-09'));
  egal('trois échéances ressortent', enTrois.echeances.length, 3);
  egalEuros('et leur somme vaut ce qui restait dû', enTrois.echeances.reduce((n, e) => n + e.montant, 0), 1799);
  egal('la première tombe à la date donnée', enTrois.echeances[0].date_prevue, '2026-10-09');
  egal('la suivante un mois après', enTrois.echeances[1].date_prevue, '2026-11-09');

  const enUne = reechelonner(quatreDues, 1, new Date('2026-10-09'));
  egal('en une fois, une seule ligne', enUne.echeances.length, 1);
  egalEuros('qui porte tout', enUne.echeances[0].montant, 1799);

  section('Ce qui est réglé ne se redécoupe pas');

  const partiellementReglee = [
    ech(1, 129, 'paye', 'bilan'),
    ech(2, 501, 'paye'),
    ech(3, 472, 'a_venir'),
    ech(4, 413, 'impaye'),
  ];

  verifie('un chèque encaissé est intouchable', echeanceIntouchable(partiellementReglee[1]));
  verifie('le bilan réglé en ligne aussi', echeanceIntouchable(partiellementReglee[0]));
  verifie('une échéance à venir ne l’est pas', !echeanceIntouchable(partiellementReglee[2]));
  verifie('une impayée non plus — elle est toujours due', !echeanceIntouchable(partiellementReglee[3]));

  const resteRedecoupe = reechelonner(partiellementReglee, 2, new Date('2026-10-09'));
  egalEuros(
    'seul ce qui restait dû est redécoupé',
    resteRedecoupe.echeances.reduce((n, e) => n + e.montant, 0),
    472 + 413,
  );
  egal('en deux fois', resteRedecoupe.echeances.length, 2);

  section('Le redécoupage tombe juste, même quand ça ne divise pas');

  for (const [du, n] of [[1000, 3], [1799, 3], [1, 4], [999.99, 7]] as const) {
    const r = reechelonner([ech(1, du, 'a_venir')], n, new Date('2026-10-09'));
    egalEuros(`${du} € en ${n} fois retombe sur ${du} €`, r.echeances.reduce((s, e) => s + e.montant, 0), du);
    verifie(`et aucune part n’est négative (${du} en ${n})`, r.echeances.every((e) => e.montant >= 0));
  }

  section('Ce qu’on refuse de redécouper, et ce qu’on répond');

  verifie(
    'une cure au centre encore due se redécoupe',
    refusDeReechelonner({ modeReglement: 'centre_4x', statutCure: 'valide', echeances: quatreDues }) === null,
  );
  verifie(
    'Alma, non',
    (refusDeReechelonner({ modeReglement: 'alma_10x', statutCure: 'valide', echeances: quatreDues }) ?? '').includes('crédit'),
  );
  verifie(
    'une cure arrêtée non plus',
    (refusDeReechelonner({ modeReglement: 'centre_4x', statutCure: 'abandonne', echeances: quatreDues }) ?? '').includes('arrêtée'),
  );
  verifie(
    'une cure reprise du CRM non plus',
    (refusDeReechelonner({ modeReglement: 'inconnu', statutCure: 'valide', echeances: quatreDues }) ?? '').length > 0,
  );
  verifie(
    'et une cure entièrement soldée non plus',
    (refusDeReechelonner({
      modeReglement: 'centre_4x',
      statutCure: 'valide',
      echeances: [ech(1, 501, 'paye'), ech(2, 472, 'paye')],
    }) ?? '').includes('réglé'),
  );
}
