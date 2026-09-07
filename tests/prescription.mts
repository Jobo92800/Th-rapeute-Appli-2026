/*
  La prescription : ce que le bilan décide de proposer, et ce qu'il refuse.

  Deux choses s'y jouent. Le nombre de séances, donc le prix. Et les
  contre-indications, donc la sécurité de la cliente : un soin retiré pour
  raison de santé ne doit jamais réapparaître, quel que soit le chemin.
*/

import { readFileSync } from 'node:fs';
import { section, verifie, egal } from './harnais.mts';
import type { Bareme, Prestation } from '../src/domain/bioportrait.ts';
import { mesuresInbody } from '../src/domain/bioportrait.ts';
import {
  PALIERS_SEANCES,
  appliquerFormule,
  depouiller,
  minimumSeances,
  palierLePlusProche,
  prestationPrioritaire,
  ligneAjoutee,
  lignesRetenues,
  palier,
  prescrire,
  prestationsAjoutables,
  seancesALAjout,
} from '../src/domain/prescription.ts';

/** Le barème tel qu'il est réellement livré en base, pas une copie d'essai. */
export function baremeLivre(): Bareme {
  const sql = readFileSync('supabase/migrations/036_bioportrait_v3.sql', 'utf8');
  const debut = sql.indexOf("VALUES (3, '") + "VALUES (3, '".length;
  const fin = sql.indexOf("'::jsonb", debut);
  return JSON.parse(sql.slice(debut, fin).replaceAll("''", "'")) as Bareme;
}

const PRESTATIONS: Prestation[] = ['LUXO', 'RELAX', 'ISHAPE', 'PRESSO'];

export function controlerPrescription() {
  const bareme = baremeLivre();

  section('Le barème livré en base');

  verifie('vingt-huit questions posées à la cliente', bareme.STEPS.filter((e) => e.phase === 'client' && e.o).length === 28);
  verifie('cinq mesures InBody', bareme.STEPS.filter((e) => e.phase === 'analyse').length === 5);
  verifie('plus d’étape de coordonnées dans le questionnaire', !bareme.STEPS.some((e) => e.type === 'contact'));
  verifie('les dix axes du BioPortrait sont décrits', Object.keys(bareme.AX).length === 10);
  verifie('les quatre prestations sont nommées', Object.keys(bareme.PRESTA ?? {}).length === 4);

  for (const e of bareme.STEPS) {
    if (!e.o) continue;
    verifie(
      `« ${(e.t ?? '').slice(0, 34)}… » a des réponses`,
      e.o.length >= 2 && e.o.every((o) => typeof o[0] === 'string' && o[0].length > 0),
    );
  }

  section('Chaque palier de prescription reste atteignable');

  // Points maximum qu'une cliente peut accumuler, réponse la plus forte partout.
  const maxi: Record<string, number> = { LUXO: 0, RELAX: 0, ISHAPE: 0, PRESSO: 0 };
  for (const e of bareme.STEPS) {
    if (!e.o) continue;
    const parEtape: Record<string, number> = { LUXO: 0, RELAX: 0, ISHAPE: 0, PRESSO: 0 };
    for (const o of e.o) {
      for (const [p, v] of Object.entries(o[2] ?? {})) {
        // Sur une question à cases à cocher, les réponses s'additionnent.
        parEtape[p] = e.type === 'multi' ? parEtape[p] + (v as number) : Math.max(parEtape[p], v as number);
      }
    }
    for (const p of PRESTATIONS) maxi[p] += parEtape[p];
  }

  for (const p of PRESTATIONS) {
    const paliers = bareme.BAREME_PRESTA?.[p] ?? [];
    const dernier = paliers[paliers.length - 1];
    verifie(
      `${p} : le dernier palier (${dernier?.min} points) peut être atteint`,
      maxi[p] >= (dernier?.min ?? 0),
      `maximum atteignable ${maxi[p]}`,
    );
    verifie(
      `${p} : les paliers sont croissants`,
      paliers.every((x, i) => i === 0 || x.min > paliers[i - 1].min),
    );
  }

  section('Une cliente sans particularité');

  const neutre = depouiller(bareme, {});
  egal('aucun point', neutre.points, { LUXO: 0, RELAX: 0, ISHAPE: 0, PRESSO: 0 });
  egal('aucune contre-indication', neutre.contreIndications, {});

  const cureNeutre = prescrire(bareme, neutre);
  egal('la Luxothérapie est toujours proposée', cureNeutre[0]?.presta, 'LUXO');
  verifie('elle porte des séances', (cureNeutre[0]?.seances ?? 0) > 0);
  egal('elle est seule quand rien ne ressort', cureNeutre.length, 1);

  section('Les contre-indications');

  // La première question est celle des situations de santé.
  const iSante = bareme.STEPS.findIndex((e) => e.cat === 'elig' && e.type === 'multi');
  const options = bareme.STEPS[iSante].o ?? [];
  const iPacemaker = options.findIndex((o) => o[0].toLowerCase().includes('pacemaker'));
  const iCancer = options.findIndex((o) => o[0].toLowerCase().includes('cancer'));
  const iDiabete = options.findIndex((o) => o[0].toLowerCase().includes('diabète'));

  const pacemaker = depouiller(bareme, { [iSante]: [iPacemaker] });
  egal('pacemaker : l’électrostimulation est retirée', pacemaker.contreIndications.ISHAPE, 'rem');
  egal('pacemaker : la pressodynamie est retirée', pacemaker.contreIndications.PRESSO, 'rem');
  verifie('pacemaker : la luxothérapie reste possible', !pacemaker.contreIndications.LUXO);

  const diabete = depouiller(bareme, { [iSante]: [iDiabete] });
  egal('diabète : avis médical, pas un retrait', diabete.contreIndications.ISHAPE, 'med');

  // Une contre-indication franche ne doit jamais être écrasée par un avis médical.
  const deuxCoches = depouiller(bareme, { [iSante]: [iDiabete, iPacemaker] });
  egal(
    'un retrait l’emporte sur un avis médical, quel que soit l’ordre',
    deuxCoches.contreIndications.ISHAPE,
    'rem',
  );

  const cancer = depouiller(bareme, { [iSante]: [iCancer] });
  egal('cancer actif : tout est retiré', 
    [cancer.contreIndications.LUXO, cancer.contreIndications.ISHAPE, cancer.contreIndications.PRESSO],
    ['rem', 'rem', 'rem']);

  const cureCancer = prescrire(bareme, cancer);
  egal('les soins retirés restent affichés, pour être expliqués', cureCancer.length >= 1, true);
  egal('mais aucun n’est retenu pour la facturation', lignesRetenues(cureCancer).length, 0);

  section('Les formules et leurs planchers');

  const forte = prescrire(bareme, {
    points: { LUXO: 14, RELAX: 15, ISHAPE: 14, PRESSO: 6 },
    contreIndications: {},
    engagement: 'MID',
    scoreInbody: null,
  });

  verifie('les quatre soins ressortent quand tout est au maximum', forte.length === 4);

  const integrale = appliquerFormule(forte, 'integrale');
  verifie(
    'la formule intégrale ne change rien à la prescription',
    integrale.every((l, i) => l.seances === forte[i].seances),
  );

  /*
    ÉQUILIBRE. La cible est −40 %, mais un nombre de séances ne se divise
    pas : on retombe sur un palier réel, et jamais sous le minimum.
  */
  const equilibre = appliquerFormule(forte, 'equilibre');

  verifie(
    'Équilibre garde toutes les prestations de l’Intégrale',
    lignesRetenues(equilibre).length === lignesRetenues(forte).length,
  );
  verifie(
    'aucune séance hors des paliers autorisés',
    equilibre.every((l) => l.seances === 0 || PALIERS_SEANCES[l.presta].includes(l.seances)),
  );
  verifie(
    'aucune prestation sous son minimum',
    lignesRetenues(equilibre).every((l) => l.seances >= minimumSeances(l.presta)),
  );
  verifie(
    'et jamais plus de séances qu’à l’Intégrale',
    equilibre.every((l, i) => l.seances <= forte[i].seances),
  );

  /*
    La table de correspondance de la spécification, reprise telle quelle.
    Elle a été écrite à la main : si le calcul s'en écarte, c'est l'un des
    deux qui a tort, et il faut le savoir avant une cliente.
  */
  section('Équilibre : la table de correspondance de la spécification');

  const TABLE: Array<[Prestation, number, number]> = [
    ['LUXO', 20, 12], ['LUXO', 15, 10], ['LUXO', 12, 10], ['LUXO', 10, 10],
    ['ISHAPE', 20, 12], ['ISHAPE', 15, 10], ['ISHAPE', 12, 6], ['ISHAPE', 10, 6], ['ISHAPE', 6, 6],
    ['PRESSO', 12, 6], ['PRESSO', 10, 6], ['PRESSO', 6, 6],
    ['RELAX', 10, 5], ['RELAX', 5, 5],
  ];

  for (const [presta, depart, attendu] of TABLE) {
    egal(`${presta} ${depart} → ${attendu}`, palierLePlusProche(presta, depart * 0.6), attendu);
  }

  section('Découverte : une seule prestation, la prioritaire');

  const decouverte = appliquerFormule(forte, 'decouverte');
  const gardees = lignesRetenues(decouverte);

  egal('une seule prestation reste', gardees.length, 1);
  egal('et c’est la luxothérapie perte de poids', gardees[0].presta, 'LUXO');
  egal(
    'gardée à son nombre de séances Intégrale',
    gardees[0].seances,
    forte.find((l) => l.presta === 'LUXO')!.seances,
  );

  /* À égalité de niveau, la luxothérapie passe devant. */
  const exAequo = [
    { presta: 'PRESSO' as Prestation, niveau: 'fort' as const, seances: 12, contreIndication: null },
    { presta: 'LUXO' as Prestation, niveau: 'fort' as const, seances: 15, contreIndication: null },
    { presta: 'ISHAPE' as Prestation, niveau: 'fort' as const, seances: 12, contreIndication: null },
  ];
  egal('à égalité, la luxothérapie l’emporte', prestationPrioritaire(exAequo)!.presta, 'LUXO');

  /* Un niveau plus haut passe avant l'ordre des prestations. */
  const presoIndispensable = [
    { presta: 'LUXO' as Prestation, niveau: 'fort' as const, seances: 20, contreIndication: null },
    { presta: 'PRESSO' as Prestation, niveau: 'oblig' as const, seances: 12, contreIndication: null },
  ];
  egal(
    'mais un niveau plus haut passe devant',
    prestationPrioritaire(presoIndispensable)!.presta,
    'PRESSO',
  );

  /* Un soin écarté pour raison de santé ne peut pas devenir la vitrine. */
  const luxoInterdite = [
    { presta: 'LUXO' as Prestation, niveau: 'oblig' as const, seances: 20, contreIndication: 'rem' as const },
    { presta: 'ISHAPE' as Prestation, niveau: 'prop' as const, seances: 6, contreIndication: null },
  ];
  egal(
    'un soin contre-indiqué n’est jamais la prestation retenue',
    prestationPrioritaire(luxoInterdite)!.presta,
    'ISHAPE',
  );

  section('Découverte quand le bilan n’a prescrit qu’une prestation');

  /*
    Choisir n'a plus de sens : Découverte serait l'Intégrale sous un autre
    nom, et l'échelle des trois prix cesserait de descendre. Elle tombe donc
    au minimum de la prestation.
  */
  const seuleLuxo = [
    { presta: 'LUXO' as Prestation, niveau: 'oblig' as const, seances: 20, contreIndication: null },
  ];
  egal(
    'elle descend au palier minimum',
    appliquerFormule(seuleLuxo, 'decouverte')[0].seances,
    10,
  );
  egal(
    'là où Équilibre s’arrête à douze',
    appliquerFormule(seuleLuxo, 'equilibre')[0].seances,
    12,
  );

  section('Les paliers, un par un');

  for (const p of PRESTATIONS) {
    for (const seuil of bareme.BAREME_PRESTA?.[p] ?? []) {
      const trouve = palier(bareme, p, seuil.min);
      egal(`${p} à ${seuil.min} points → ${seuil.s} séances`, trouve.s, seuil.s);
    }
  }

  section('Ajouter un soin que le bilan n’a pas proposé');

  /*
    Le barème ne voit que les réponses. Une cliente peut dire en s'asseyant
    quelque chose qu'aucune question n'a posé, et la thérapeute doit pouvoir
    ajouter le soin. Ce qui suit vérifie surtout la seule chose qui reste
    interdite.
  */
  const rien = depouiller(bareme, {});
  const cureVide = prescrire(bareme, rien).filter((l) => l.presta === 'LUXO');

  verifie(
    'les soins absents de la cure sont proposés à l’ajout',
    ['RELAX', 'ISHAPE', 'PRESSO'].every((p) =>
      prestationsAjoutables(rien, cureVide).includes(p as never),
    ),
  );
  verifie(
    'un soin déjà présent ne se propose pas deux fois',
    !prestationsAjoutables(rien, cureVide).includes('LUXO' as never),
  );

  /*
    LA RÈGLE QUI PROTÈGE. Un soin retiré par une réponse de santé n'est pas
    « non proposé », il est contre-indiqué : aucune conversation au comptoir
    ne doit pouvoir le remettre. Si ce contrôle tombe, une cliente
    épileptique peut se voir vendre de la luxothérapie.
  */
  const interdits = depouiller(bareme, {});
  interdits.contreIndications.ISHAPE = 'rem';
  verifie(
    'un soin contre-indiqué ne s’ajoute jamais',
    !prestationsAjoutables(interdits, cureVide).includes('ISHAPE' as never),
  );

  /* Un avis médical n'interdit pas : il accompagne. */
  const surveille = depouiller(bareme, {});
  surveille.contreIndications.PRESSO = 'med';
  verifie(
    'un soin sous avis médical reste ajoutable',
    prestationsAjoutables(surveille, cureVide).includes('PRESSO' as never),
  );
  egal(
    'et il garde sa mise en garde une fois ajouté',
    ligneAjoutee(surveille, 'PRESSO').contreIndication,
    'med',
  );

  section('Ce qu’on met dans un soin ajouté');

  egal('la luxothérapie démarre à son plancher', seancesALAjout('LUXO'), 10);
  egal('l’I-Shape au sien', seancesALAjout('ISHAPE'), 6);
  egal('la relaxation au sien', seancesALAjout('RELAX'), 5);
  verifie('la ligne se dit ajoutée', ligneAjoutee(rien, 'RELAX').ajoute === true);

  /*
    Les mesures InBody, nommées par le barème.

    Une liste de sept intitulés vivait dans le code, héritée d'un
    questionnaire qui posait sept questions d'analyse. La version 3 n'en pose
    que cinq : « Rétention d'eau » s'affichait sous le nom « Localisation »
    et le « Score InBody » sous celui de « Rétention » — sur la fiche, et
    dans le récapitulatif envoyé à la cliente. Ce contrôle refuse que les
    libellés se remettent à diverger du questionnaire.
  */
  section('Les mesures InBody portent leur vrai nom');

  const etapesAnalyse = bareme.STEPS.map((e, i) => ({ e, i })).filter(({ e }) => e.phase === 'analyse');
  const toutesRepondues = Object.fromEntries(etapesAnalyse.map(({ i }) => [String(i), [0]]));
  const releve = mesuresInbody(bareme, toutesRepondues as never);

  egal('les cinq mesures ressortent', releve.length, 5);

  for (const [rang, { e }] of etapesAnalyse.entries()) {
    egal(
      `la mesure ${rang + 1} s'appelle comme dans le questionnaire`,
      releve[rang].libelle,
      e.t ?? '',
    );
  }

  verifie(
    'aucune mesure ne sort sans nom',
    releve.every((m) => m.libelle.trim().length > 0),
  );
}
