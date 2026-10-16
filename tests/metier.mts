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
import { facturationDuBilan } from '../src/domain/facturationDuBilan.ts';
import { ajusterSeancesDuSoin, demandeUneVenue, psioDisponible } from '../src/domain/soins.ts';
import { ajusterSeances, prestationsAjoutables, seancesALAjout } from '../src/domain/prescription.ts';
import {
  JOURS_AVANT_PREMIERE_ECHEANCE,
  datesEcheancier,
  encaisseHorsFrais,
  datesEcheancierApresAcompte,
  echeanceIntouchable,
  montantsCoherents,
  reechelonner,
  refusDeReechelonner,
} from '../src/domain/reglement.ts';
import {
  calculerMontant,
  construireEcheancierCure,
  creneauxParDefaut,
  montantAcompte,
  prixUnitaireParDefaut,
} from '../src/domain/tarification.ts';
import { soinsAntiAgeDuCentre } from '../src/domain/soins.ts';
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
  /*
    Et il dit le mode sans le nombre de fois : « 10 fois » appartient au
    contrat de crédit signé avec Alma, comme les dates — le recopier ici,
    c'était promettre deux fois la même chose dans deux documents qui
    peuvent diverger.
  */
  egal('chez Alma, le contrat dit le mode et rien de plus', contrat.almaLibelle, 'Paiement Alma');
  verifie('chez Alma, le contrat ne porte aucune échéance', contrat.almaSansEcheancier && contrat.installments.length === 0);

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
  /*
    Le soin visage du Grau-du-Roi a son propre consentement — ultrasons et
    radiofréquence —, repris au mot près du document « Soin visage ». Une
    cure d'Advance Lift le fait signer, et lui seul.
  */
  const contratAntiAge = construireContrat({
    cliente, centre,
    programme: { ...programme, mode_reglement: 'centre_4x', frais_financement: 0 } as unknown as Programme,
    lignes: [{ technologie: 'advance_lift', seances_prevues: 10, seances_offertes: 0, prix_unitaire: 85 }] as unknown as LigneProgramme[],
    echeances,
  });
  egal('une cure d’Advance Lift fait signer le consentement Soin visage, et lui seul', contratAntiAge.activeServiceIds, ['advance-lift']);
  verifie('et le liste à l’article 1', contratAntiAge.careItems.some((c) => c.label === 'Advance Lift' && c.sessions === 10 && c.checked));

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
  /*
    CORRIGER LES MONTANTS À LA MAIN (direction, 6 octobre 2026).

    Un geste commercial consenti au comptoir, une erreur de saisie : la
    direction réécrit le montant d'une cure et de ses échéances. Le seul
    contrôle qui compte, c'est que la somme retombe juste — sans lui, la
    fiche annoncerait un prix et le CRM en réclamerait un autre. Chez Alma,
    ce sont les mensualités qui portent les frais : les oublier ferait
    refuser une correction pourtant exacte.
  */
  section('Corriger les montants d’une cure');

  verifie(
    'deux chèques qui font le montant : juste',
    montantsCoherents({ montantTotal: 553, echeances: [316, 237] }),
  );
  verifie(
    'un euro de trop : refusé',
    !montantsCoherents({ montantTotal: 553, echeances: [316, 238] }),
  );
  verifie(
    'un centime de trop aussi',
    !montantsCoherents({ montantTotal: 553, echeances: [316, 237.01] }),
  );
  verifie(
    'le bilan déjà réglé compte dans la somme',
    montantsCoherents({ montantTotal: 642, echeances: [89, 316, 237] }),
  );
  verifie(
    'chez Alma, les frais sont portés par les mensualités',
    montantsCoherents({ montantTotal: 474, frais: 9.01, echeances: [127.51, 118.5, 118.5, 118.5] }),
  );
  verifie(
    'et les oublier ferait refuser une correction juste',
    !montantsCoherents({ montantTotal: 474, echeances: [127.51, 118.5, 118.5, 118.5] }),
  );
  verifie(
    'une cure sans échéance ne vaut rien',
    montantsCoherents({ montantTotal: 0, echeances: [] }),
  );

  /*
    CHAQUE CENTRE N'A PAS LES MÊMES APPAREILS.

    Une cure suivante se compose à la main, sans repasser par un bilan — et
    depuis le 5 octobre 2026 elle peut contenir un soin anti-âge. Mais
    proposer un soin qu'un centre ne tient pas, c'est le vendre : la cliente
    signe, et personne ne peut le lui donner. Aucun centre ne fait les deux.
  */
  section('Les soins anti-âge, centre par centre');

  egal('le Grau-du-Roi tient l’Advance Lift', soinsAntiAgeDuCentre('grau-du-roi'), ['advance_lift']);
  egal('le Crès tient la radiofréquence', soinsAntiAgeDuCentre('le-cres'), ['radiofrequence']);
  egal('Sérignan aussi', soinsAntiAgeDuCentre('serignan'), ['radiofrequence']);
  egal('Pollestres n’a pas d’anti-âge', soinsAntiAgeDuCentre('cabestany'), []);
  egal('Avignon non plus', soinsAntiAgeDuCentre('avignon'), []);
  egal('et sans centre, on ne propose rien', soinsAntiAgeDuCentre(null), []);
  verifie(
    'aucun centre ne fait les deux',
    ['grau-du-roi', 'le-cres', 'serignan', 'cabestany', 'avignon'].every(
      (c) => soinsAntiAgeDuCentre(c).length <= 1,
    ),
  );

  /*
    La radiofréquence a deux formats et deux prix. Le décolleté ne s'impose
    jamais tout seul : c'est la thérapeute qui le propose, et le prix suit.
  */
  section('Le prix d’une séance, soin par soin');

  const TARIFS = {
    seance: 59, guide: 29, tenue: 60, bilan: 129, complement: 37,
    advance_lift: 85, dome: 49, radiofrequence: 79,
    radiofrequence_decollete: 139, bilan_signature: 89,
  } as unknown as Parameters<typeof prixUnitaireParDefaut>[1];

  egal('la luxothérapie à 59 €', prixUnitaireParDefaut('luxo', TARIFS), 59);
  egal('l’Advance Lift à 85 €', prixUnitaireParDefaut('advance_lift', TARIFS), 85);
  egal('la radiofréquence visage et cou à 79 €', prixUnitaireParDefaut('radiofrequence', TARIFS), 79);
  egal('le Dôme à 49 €', prixUnitaireParDefaut('dome', TARIFS), 49);

  /*
    L'ACOMPTE D'UNE CURE SUIVANTE NE PORTE PAS DE BILAN.

    Au premier bilan, il couvre le BioPortrait et les créneaux bloqués. Sur
    une cure suivante il n'y a plus de bilan à couvrir : il a été fait et
    facturé la première fois, et une cliente qui revient ne le repaie pas
    (Jonathan, 5 octobre 2026). Seuls les créneaux restent.
  */
  section('L’acompte d’une cure suivante');

  egalEuros(
    'trois créneaux bloqués, trois séances dues',
    montantAcompte({ prixBilan: 0, creneauxReserves: 3, prixSeance: 59 }),
    177,
  );
  egalEuros(
    'et jamais le prix d’un bilan déjà facturé',
    montantAcompte({ prixBilan: 0, creneauxReserves: 1, prixSeance: 59 }),
    59,
  );
  egal(
    'autant de créneaux que de soins différents',
    [creneauxParDefaut(0), creneauxParDefaut(1), creneauxParDefaut(3)],
    [1, 1, 3],
  );

  const cureSuivante = construireEcheancierCure({
    seances: 20,
    prixSeance: 59,
    options: 29,
    methode: 'centre',
    n: 4,
    acompte: montantAcompte({ prixBilan: 0, creneauxReserves: 2, prixSeance: 59 }),
  });
  egalEuros('le montant de la cure ne bouge pas', cureSuivante.montantARegler, 1209);
  egal('l’acompte sort en tête', cureSuivante.echeances[0].type, 'acompte');
  egalEuros('et il se déduit du total', cureSuivante.echeances[0].montant, 118);
  egalEuros(
    'la somme des lignes retombe sur le montant de la cure',
    cureSuivante.echeances.reduce((t, e) => t + e.montant, 0),
    1209,
  );

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

  /*
    DES MULTIPLES DE 59, JAMAIS DE VIRGULE (Jonathan, 16 septembre 2026).
    Avec le prix de la séance, chaque chèque couvre des séances entières,
    le guide sur le premier ; sans unité commune, des euros entiers.
  */
  egal('sans unité, des euros entiers : 1 799 € en trois font 601 · 599 · 599', enTrois.echeances.map((e) => e.montant), [601, 599, 599]);
  const vingtLuxo = [ech(1, 265, 'a_venir'), ech(2, 236, 'a_venir'), ech(3, 236, 'a_venir'), ech(4, 236, 'a_venir'), ech(5, 236, 'a_venir')];
  const enQuatre = reechelonner(vingtLuxo, 4, new Date('2026-10-09'), 59);
  egal('20 luxo + guide (1 209 €) en 4 : 5 séances par chèque, le guide sur le premier', enQuatre.echeances.map((e) => e.montant), [324, 295, 295, 295]);
  verifie('aucun chèque à virgule', enQuatre.echeances.every((e) => Number.isInteger(e.montant)));
  const enCinq = reechelonner(vingtLuxo, 5, new Date('2026-10-09'), 59);
  egal('en 5 : on retrouve le découpage de la signature', enCinq.echeances.map((e) => e.montant), [265, 236, 236, 236, 236]);

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

  section('Ce qu’on facture d’un bilan');

  /*
    Les quatre issues du rendez-vous. Elles décident de ce que la cliente
    règle, de ce que le tableau de bord compte, et de ce que la fiche
    annonce — un bilan dont l’état est faux fait mentir trois écrans.
  */
  const issue = (p: Partial<Parameters<typeof facturationDuBilan>[0]>) =>
    facturationDuBilan(
      { avecCure: false, pointDeSuivi: false, offertEnPromo: false, ...p },
      129,
    );

  egal('sans cure, elle règle son bilan', issue({}).facturation, 'facture');
  egalEuros('et ce sont 129 €', issue({}).montant, 129);

  egal('avec une cure, il est compris dedans', issue({ avecCure: true }).facturation, 'offert');
  egalEuros('et il ne se facture pas deux fois', issue({ avecCure: true }).montant, 0);

  egal('un point de suivi ne vend rien', issue({ pointDeSuivi: true }).facturation, 'offert');
  egalEuros('et ne facture rien', issue({ pointDeSuivi: true }).montant, 0);

  egal(
    'la promotion l’offre, et le dit',
    issue({ offertEnPromo: true }).facturation,
    'offert_promo',
  );
  egalEuros('zéro euro', issue({ offertEnPromo: true }).montant, 0);

  /*
    L’ordre compte : si la thérapeute a validé une cure, le bilan est dedans
    — c’est « offert » et non « offert_promo ». Sans quoi un bilan compris
    dans une cure se compterait parmi les bilans de la promotion.
  */
  egal(
    'une cure validée l’emporte sur la promotion',
    issue({ avecCure: true, offertEnPromo: true }).facturation,
    'offert',
  );

  verifie(
    'et jamais un euro facturé quand rien n’est dû',
    [
      issue({ avecCure: true }),
      issue({ pointDeSuivi: true }),
      issue({ offertEnPromo: true }),
    ].every((r) => r.montant === 0 && r.facturation !== 'facture'),
  );

  section('Le Psio, à Sérignan');

  /*
    Un soin de plus, sans bilan : aucune question ne lui donne de points, la
    thérapeute l'ajoute à la main, et seul Sérignan le tient. Proposer un
    soin qu'un centre ne tient pas revient à le vendre.
  */
  verifie('Sérignan tient le Psio', psioDisponible('serignan'));
  verifie('le Grau-du-Roi, non', !psioDisponible('grau-du-roi'));
  verifie('le Crès non plus', !psioDisponible('le-cres'));
  verifie('ni Pollestres', !psioDisponible('cabestany'));
  verifie('ni Avignon', !psioDisponible('avignon'));
  verifie('et sans centre, on ne propose rien', !psioDisponible(null));

  /*
    DEUX FORMULES ET PAS UNE DE PLUS. C'est la règle qui protège un prix :
    sept séances de Psio n'existent pas, et le « + » ne doit jamais fabriquer
    un montant que personne n'a fixé.
  */
  const grillePsio = {
    seance: 59, guide: 29, tenue: 60, bilan: 129, dome: 49,
    advance_lift: 85, radiofrequence: 79, radiofrequence_decollete: 139,
    bilan_signature: 89, complement: 37, psio: 58.5,
  };

  egalEuros('la séance vaut 58,50 €', prixUnitaireParDefaut('psio', grillePsio), 58.5);
  egalEuros(
    'six séances font 351 €',
    calculerMontant([{ technologie: 'psio', seances: 6, prixUnitaire: 58.5 }],
      { guide: false, tenue: false }, grillePsio).total,
    351,
  );
  egalEuros(
    'huit séances font 468 €',
    calculerMontant([{ technologie: 'psio', seances: 8, prixUnitaire: 58.5 }],
      { guide: false, tenue: false }, grillePsio).total,
    468,
  );

  egal('on l’ajoute à six séances', seancesALAjout('PSIO'), 6);
  egal('le « + » passe de six à huit', ajusterSeances('PSIO', 6, 1), 8);
  egal('et s’arrête là', ajusterSeances('PSIO', 8, 1), 8);
  egal('le « − » redescend à six', ajusterSeances('PSIO', 8, -1), 6);
  egal('et ne descend pas en dessous', ajusterSeances('PSIO', 6, -1), 6);
  egal('un nombre hors formule se recale', ajusterSeances('PSIO', 7, 1), 8);

  /* Sur le formulaire d’une cure suivante, zéro existe : c’est « on ne le vend pas ». */
  egal('sur une cure suivante, zéro reste possible', ajusterSeancesDuSoin('psio', 6, -1), 0);
  egal('et le premier « + » pose la formule de six', ajusterSeancesDuSoin('psio', 0, 1), 6);
  egal('puis celle de huit', ajusterSeancesDuSoin('psio', 6, 1), 8);
  egal('sans jamais aller plus loin', ajusterSeancesDuSoin('psio', 8, 1), 8);
  egal('la luxo, elle, bouge d’une séance', ajusterSeancesDuSoin('luxo', 16, 1), 17);

  /*
    LE PSIO NE FAIT PAS REVENIR : il s'enchaîne après un autre soin, dans la
    même venue, comme la Relaxation. Il ne compte donc pas dans la règle du
    « troisième soin, un mois de plus », qui ouvre un chèque de plus.
  */
  verifie('le Psio ne demande pas de venue à lui seul', !demandeUneVenue('psio'));
  verifie('la Relaxation non plus', !demandeUneVenue('relax'));
  verifie('la luxothérapie, si', demandeUneVenue('luxo'));
  verifie('l’I-Shape aussi', demandeUneVenue('ishape'));
  verifie('la pressodynamie aussi', demandeUneVenue('presso'));

  /*
    Il ne s'ajoute QUE là où le centre le tient, et il n'apparaît jamais
    parmi les soins proposés ailleurs.
  */
  const sansRien = {
    points: { LUXO: 0, RELAX: 0, ISHAPE: 0, PRESSO: 0, DOME: 0, PSIO: 0 },
    contreIndications: {},
    engagement: 'MID' as const,
    scoreInbody: null,
  };
  verifie(
    'à Sérignan, le Psio se propose à l’ajout',
    prestationsAjoutables(sansRien, [], false, true).includes('PSIO'),
  );
  verifie(
    'ailleurs, il n’est nulle part',
    !prestationsAjoutables(sansRien, [], false, false).includes('PSIO'),
  );
  verifie(
    'et le Dôme ne le suit pas au Grau-du-Roi',
    prestationsAjoutables(sansRien, [], true, false).includes('DOME') &&
      !prestationsAjoutables(sansRien, [], true, false).includes('PSIO'),
  );
}
