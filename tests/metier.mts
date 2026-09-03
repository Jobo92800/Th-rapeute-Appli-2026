/*
  Le reste des règles : le BioPortrait, le parrainage, le stock, les
  règlements, le contrat.
*/

import { section, verifie, egal, egalEuros } from './harnais.mts';
import { baremeLivre } from './prescription.mts';
import { calculerBioPortrait, choix, scoresMaximum } from '../src/domain/bioportrait.ts';
import {
  PLAFOND_SEANCES,
  SEANCES_PAR_FILLEULE,
  calculerSolde,
  soldeDepuisCompteurs,
  type Filleule,
} from '../src/domain/parrainage.ts';
import { finDeCure, libelleFinDeCure, niveauStock } from '../src/domain/stock.ts';
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
  egal('le total comprend les frais de financement', contrat.totalAmount, '1 256,70 €');
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
}
