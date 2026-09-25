/*
  Le Bilan Profil Signature anti-âge.

  Ce qui est vérifié ici décide de ce qu'on propose à une cliente devant un
  miroir : son profil, son terrain, et le nombre de séances de sa cure.
  Le barème d'essai reprend la mécanique du barème livré — questions à
  points, questions du miroir qui cotent une zone, besoins qui en allument
  d'autres — en plus court.
*/

import { readFileSync } from 'node:fs';
import { section, verifie, egal, egalEuros } from './harnais.mts';
import { construireEcheancierCure } from '../src/domain/tarification.ts';
import {
  CODE_SECURITE,
  calculerProfilSignature,
  contreIndications,
  maximaSignature,
  nomDuTerrainSignature,
  precoterLesZones,
  preconiserLaCure,
  securiteBloquante,
  signatureDisponible,
  questionsAPoser,
  soinRecent,
  type BaremeSignature,
  type CarteDesZones,
} from '../src/domain/profilSignature.ts';

const profil = (nom: string) => ({ nom, texte: '', besoins: [], radiofrequence: '' });

const BAREME: BaremeSignature = {
  ZONES: [
    { code: 'ovale', nom: 'Ovale et bajoues', detail: '', portee: 'rf' },
    { code: 'cou', nom: 'Cou', detail: '', portee: 'rf' },
    { code: 'grain', nom: 'Grain de peau', detail: '', portee: 'rf' },
    { code: 'yeux', nom: 'Contour des yeux', detail: '', portee: 'pa' },
    { code: 'front', nom: 'Front', detail: '', portee: 'pa' },
    { code: 'sillons', nom: 'Sillons nasogéniens', detail: '', portee: 'ot' },
    { code: 'decollete', nom: 'Décolleté', detail: '', portee: 'rf' },
  ],
  GROUPES: [{ id: 'miroir', titre: 'Ce que vous voyez dans le miroir' }],
  SECURITE: ['Stimulateur cardiaque', 'Implant métallique dans la zone', 'Grossesse'],
  QUESTIONS: [
    /* Ressenti : des points d'axe et de terrain, aucune zone. */
    {
      code: 's1',
      groupe: 'ressenti',
      t: 'Votre peau tire ou tiraille',
      o: [
        ['Jamais'],
        ['Parfois', { hydratation: 1 }, { hydratation: 1 }],
        ['Souvent', { hydratation: 2 }, { hydratation: 2 }],
        ['Tous les jours', { hydratation: 3 }, { hydratation: 3 }],
      ],
    },
    {
      code: 's2',
      groupe: 'ressenti',
      t: 'Votre visage rougit facilement',
      o: [['Jamais'], ['Parfois', {}, { sensible: 1 }], ['Souvent', {}, { sensible: 2 }], ['Tous les jours', {}, { sensible: 3 }]],
    },
    /* Miroir : des points d'axe ET une intensité de zone. */
    {
      code: 'v1',
      groupe: 'miroir',
      t: 'De profil, la ligne de votre mâchoire est :',
      zone: 'ovale',
      intensites: [0, 2, 3],
      o: [
        ['Nette et bien dessinée'],
        ['Moins nette, avec de petites bajoues', { fermete: 2, densite: 1 }],
        ['Nettement relâchée', { fermete: 3, densite: 1 }],
      ],
    },
    {
      code: 'v5',
      groupe: 'miroir',
      t: 'Sur votre cou :',
      zone: 'cou',
      intensites: [0, 1, 2, 3],
      o: [
        ['La peau est lisse et ferme'],
        ['Quelques ridules', { rides: 1 }],
        ['Des lignes horizontales marquées', { fermete: 1, rides: 2 }],
        ['Une peau qui se relâche', { fermete: 3, rides: 1 }],
      ],
    },
    {
      code: 'v8',
      groupe: 'miroir',
      t: 'Votre peau vous paraît plus fine qu’avant :',
      o: [['Non'], ['Un peu', { densite: 1 }, { fin: 1 }], ['Oui', { densite: 2 }, { fin: 2 }], ['Très nettement', { densite: 3 }, { fin: 3 }]],
    },
    /* Besoins : aucun point de zone, mais des zones allumées. */
    {
      code: 'b1',
      groupe: 'besoins',
      t: 'Ce qui vous gêne le plus aujourd’hui :',
      zonesVisees: [['ovale', 'cou'], ['yeux', 'front'], ['grain']],
      o: [
        ['Mon visage se relâche', { fermete: 3, densite: 1 }],
        ['Mes rides et ridules', { rides: 3, hydratation: 1, densite: 1 }],
        ['Mon teint manque d’éclat', { hydratation: 2, densite: 1 }],
      ],
    },
    {
      code: 'b2',
      groupe: 'besoins',
      t: 'Les zones que vous souhaitez améliorer :',
      multi: true,
      zonesVisees: [['decollete'], ['front']],
      o: [['Décolleté'], ['Front']],
    },
    { code: 'q10', groupe: 'hist', t: 'Avez-vous déjà réalisé des soins esthétiques ?', o: [['Oui'], ['Non']] },
    {
      code: 'q10b',
      groupe: 'hist',
      t: 'Lesquels ?',
      multi: true,
      si: { code: 'q10', option: 0 },
      o: [['Soins visage classiques'], ['Technologies esthétiques'], ['Peelings'], ['Laser'], ['Injections'], ['Autre']],
    },
    {
      code: 'q10c',
      groupe: 'hist',
      t: 'Date du dernier peeling, laser ou injection :',
      si: { code: 'q10b', options: [2, 3, 4] },
      o: [["Moins d'un mois"], ['1 à 6 mois'], ['Plus de 6 mois'], ['Jamais']],
    },
  ],
  PROFILS: {
    fermete_ovale: profil('Fermeté & Ovale'),
    rides_densite: profil('Rides & Densité'),
    hydratation_qualite: profil('Hydratation & Qualité'),
    global: profil('Anti-Âge Global'),
  },
  TERRAINS: {
    hydratation: { nom: 'Hydratation', texte: '' },
    sensible: { nom: 'Sensible / Réactif', texte: '' },
    dense: { nom: 'Dense / Épaissi', texte: '' },
    fin: { nom: 'Fin / Fragilisé', texte: '' },
  },
  CURES: [
    { code: 'decouverte', nom: 'Découverte', seances: 4, mois: 1, rythme: '', semaines: [1, 2, 3, 4], note: '', jusqua: 1 },
    { code: 'equilibre', nom: 'Équilibre', seances: 6, mois: 2, rythme: '', semaines: [1, 2, 3, 4, 6, 8], note: '', jusqua: 3 },
    { code: 'integrale', nom: 'Intégrale', seances: 10, mois: 3, rythme: '', semaines: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12], note: '' },
  ],
  MENTION: '',
};

/** Une carte de zones complète, à partir de ce qu'on veut coter. */
const carte = (c: Partial<CarteDesZones>): CarteDesZones =>
  Object.fromEntries(BAREME.ZONES.map((z) => [z.code, c[z.code] ?? 0])) as CarteDesZones;

/** Le questionnaire tel qu’il est réellement livré en base, pas une copie d’essai. */
export function baremeSignatureLivre(): BaremeSignature {
  const sql = readFileSync('supabase/migrations/071_bilan_profil_signature.sql', 'utf8');
  const debut = sql.indexOf("(1, '") + "(1, '".length;
  const fin = sql.indexOf("'::jsonb", debut);
  return JSON.parse(sql.slice(debut, fin).replaceAll("''", "'")) as BaremeSignature;
}

export function controlerProfilSignature() {
  section('Le Profil Signature : où il se propose');

  verifie('au Crès', signatureDisponible('le-cres'));
  verifie('à Sérignan', signatureDisponible('serignan'));
  verifie('pas au Grau-du-Roi, qui garde son Advance Lift', !signatureDisponible('grau-du-roi'));
  verifie('ni à Cabestany', !signatureDisponible('cabestany'));

  section('Les maxima se lisent sur le barème');

  const max = maximaSignature(BAREME);
  egal('fermeté : 3 (mâchoire) + 3 (cou) + 3 (gêne)', max.axes.fermete, 9);
  /* Le maximum d'une question est celui de sa MEILLEURE réponse, pas la somme. */
  egal('hydratation : 3 (tiraillements) + 2 (la gêne la plus haute)', max.axes.hydratation, 5);
  egal('terrain sensible : la seule question qui le marque', max.terrains.sensible, 3);
  verifie('une question à choix multiple ne compte pas', maximaSignature({ ...BAREME, QUESTIONS: BAREME.QUESTIONS.filter((q) => q.multi) }).axes.fermete === 0);

  section('La carte des zones, avant que la thérapeute ne regarde');

  /* 1. La question du miroir cote la zone. */
  egal('« nettement relâchée » cote l’ovale marqué', precoterLesZones(BAREME, { v1: 2 }).ovale, 3);
  egal('« quelques ridules » cote le cou discret', precoterLesZones(BAREME, { v5: 1 }).cou, 1);

  /* 2. Une zone seulement visée par les besoins. */
  egal(
    'une zone que rien n’a regardée, mais qui gêne la cliente : modérée',
    precoterLesZones(BAREME, { b1: 0 }).cou,
    2,
  );
  egal(
    'la même zone, quand le miroir a répondu « rien » : discrète',
    precoterLesZones(BAREME, { b1: 0, v5: 0 }).cou,
    1,
  );
  egal('les zones choisies allument aussi', precoterLesZones(BAREME, { b2: [0] }).decollete, 2);

  /* 3. Rien du tout. */
  egal('une zone dont personne n’a parlé reste non notée', precoterLesZones(BAREME, { v1: 2 }).front, 0);

  /* L'œil de la thérapeute passe avant le questionnaire. */
  const ajustee = precoterLesZones(BAREME, { v1: 2 }, { ovale: 1 });
  egal('une zone cotée par la thérapeute n’est pas réécrite', ajustee.ovale, 1);

  section('Les quatre axes, moitié questionnaire moitié observation');

  /* Questionnaire vide, observation vide : tout à zéro. */
  const rien = calculerProfilSignature(BAREME, {}, carte({}));
  egal('sans rien, aucun axe ne monte', rien.axes.fermete, 0);
  egal('et aucun terrain ne se signale', rien.terrains, []);
  egal('le terrain se dit alors en toutes lettres', nomDuTerrainSignature(BAREME, []), 'Pas de terrain particulier signalé');

  /* Observation seule : la moitié des points de fermeté. */
  const observe = calculerProfilSignature(BAREME, {}, carte({ ovale: 3, cou: 3, decollete: 3 }));
  egal('ovale + cou + moitié du décolleté au maximum : la moitié de l’axe', observe.axes.fermete, 50);
  egal('la densité ne s’observe pas : elle reste à zéro', observe.axes.densite, 0);

  /* Questionnaire seul, au maximum de la fermeté. */
  const repondu = calculerProfilSignature(BAREME, { v1: 2, v5: 3, b1: 0 }, carte({}));
  egal('fermeté au maximum du questionnaire, sans observation : la moitié', repondu.axes.fermete, 50);

  section('L’attribution du profil');

  egal(
    'la fermeté nettement devant',
    calculerProfilSignature(BAREME, { v1: 2, b1: 0 }, carte({ ovale: 3, cou: 3 })).profil,
    'fermete_ovale',
  );
  egal(
    'l’hydratation nettement devant',
    calculerProfilSignature(BAREME, { s1: 3, b1: 2 }, carte({ grain: 3 })).profil,
    'hydratation_qualite',
  );
  egal(
    'rides et densité en tête, ensemble : leur propre profil, jamais « global »',
    calculerProfilSignature(BAREME, { v8: 3, b1: 1 }, carte({ yeux: 2, front: 2 })).profil,
    'rides_densite',
  );

  /* Deux axes qui se tiennent à dix points ou moins : rien ne domine. */
  const serres = calculerProfilSignature(BAREME, { v1: 2, s1: 3 }, carte({ ovale: 3, cou: 2, grain: 1 }));
  egal('fermeté', serres.axes.fermete, 50);
  egal('hydratation, à trois points', serres.axes.hydratation, 47);
  egal('aucune ne domine : profil global', serres.profil, 'global');

  section('Le terrain cutané');

  const sensible = calculerProfilSignature(BAREME, { s2: 3 }, carte({}));
  egal('le terrain qui marque le plus', sensible.terrains, ['sensible']);
  egal('il est ramené sur 100', sensible.scoresTerrain.sensible, 100);

  const discret = calculerProfilSignature(BAREME, { s1: 0, s2: 0 }, carte({}));
  egal('un terrain à zéro ne se signale pas', discret.terrains, []);

  const mixte = calculerProfilSignature(BAREME, { s1: 3, s2: 3 }, carte({}));
  egal('deux terrains au coude à coude s’affichent ensemble', mixte.terrains.length, 2);
  egal(
    'et se lisent d’un trait',
    nomDuTerrainSignature(BAREME, mixte.terrains),
    'Hydratation et Sensible / Réactif',
  );

  section('La cure préconisée');

  /* Les points ne se lisent que sur les zones où la radiofréquence agit. */
  const sillons = preconiserLaCure(BAREME, carte({ sillons: 3 }));
  egal('une zone que la radiofréquence ne traite pas ne compte pas', sillons.points, 0);
  egal('… et ne préconise donc rien de plus que la Découverte', sillons.cure.code, 'decouverte');

  const yeux = preconiserLaCure(BAREME, carte({ yeux: 3, front: 3 }));
  egal('le contour des yeux et le front non plus : effet partiel', yeux.points, 0);

  egal('rien de coté : Découverte', preconiserLaCure(BAREME, carte({})).cure.code, 'decouverte');
  egal(
    'une zone modérée : toujours Découverte',
    preconiserLaCure(BAREME, carte({ ovale: 2 })).cure.code,
    'decouverte',
  );
  egal(
    'deux zones modérées : Équilibre',
    preconiserLaCure(BAREME, carte({ ovale: 2, cou: 2 })).cure.code,
    'equilibre',
  );
  egal(
    'quatre zones modérées : Intégrale',
    preconiserLaCure(BAREME, carte({ ovale: 2, cou: 2, grain: 2, decollete: 2 })).cure.code,
    'integrale',
  );

  /* La règle qui compte le plus : une seule zone marquée suffit. */
  const marquee = preconiserLaCure(BAREME, carte({ ovale: 3 }));
  egal('une seule zone marquée envoie directement à l’Intégrale', marquee.cure.code, 'integrale');
  egal('elle vaut deux points', marquee.points, 2);
  egal('et elle est nommée, pour expliquer le chiffre', marquee.marquees, ['Ovale et bajoues']);

  const detail = preconiserLaCure(BAREME, carte({ ovale: 3, cou: 2, grain: 1 }));
  egal('les modérées sont nommées à part', detail.moderees, ['Cou']);
  egal('les discrètes aussi', detail.discretes, ['Grain de peau']);
  egal('2 + 1 + 0', detail.points, 3);

  section('Sécurité et soins récents');

  verifie('aucune case cochée, rien ne bloque', !securiteBloquante(BAREME, {}));
  verifie('une seule case suffit', securiteBloquante(BAREME, { [CODE_SECURITE]: [1] }));
  egal(
    'la contre-indication est nommée',
    contreIndications(BAREME, { [CODE_SECURITE]: [0, 2] }),
    ['Stimulateur cardiaque', 'Grossesse'],
  );

  /*
    Le délai d'un mois ne vient que d'un peeling, d'un laser ou d'une
    injection. Il se déclenchait sur un simple « oui » à l'historique :
    une cliente qui n'avait coché que « Autre » voyait sa cure reculée
    d'un mois (Jonathan, 25 septembre 2026, migration 075).
  */
  const peeling = { q10: 0, q10b: [2] };
  const autre = { q10: 0, q10b: [5] };

  verifie('un peeling de moins d’un mois décale la cure', soinRecent(BAREME, { ...peeling, q10c: 0 }));
  verifie('un peeling d’il y a six mois ne décale rien', !soinRecent(BAREME, { ...peeling, q10c: 1 }));
  verifie('sans historique, rien à décaler', !soinRecent(BAREME, { q10: 1 }));
  verifie(
    'la date du dernier soin ne se pose pas si elle n’a jamais rien fait',
    !relire({ q10: 1 }).some((q) => q.code === 'q10c'),
  );
  verifie(
    '« Autre » ne fait pas poser la question de la date',
    !relire(autre).some((q) => q.code === 'q10c'),
  );
  verifie(
    'et une réponse restée en mémoire ne décale rien',
    !soinRecent(BAREME, { ...autre, q10c: 0 }),
  );
  verifie(
    'un soin visage classique non plus',
    !soinRecent(BAREME, { q10: 0, q10b: [0], q10c: 0 }),
  );
  verifie(
    'une injection, si',
    soinRecent(BAREME, { q10: 0, q10b: [4, 5], q10c: 0 }),
  );

  section('Le questionnaire réellement livré (migration 071)');

  /*
    Les mêmes règles, lues sur le barème de production : si une question
    change et qu’un profil devient inatteignable, le banc le dit.
  */
  const livre = baremeSignatureLivre();
  egal('sept zones', livre.ZONES.length, 7);
  egal('vingt-deux questions', livre.QUESTIONS.length, 22);
  egal('trois cures', livre.CURES.map((c) => c.seances), [4, 6, 10]);
  egal('six contre-indications', livre.SECURITE.length, 6);
  verifie(
    'quatre zones où la radiofréquence agit, trois qui ne comptent pas dans la cure',
    livre.ZONES.filter((z) => z.portee === 'rf').length === 4,
  );

  const maxLivre = maximaSignature(livre);
  for (const axe of ['fermete', 'rides', 'hydratation', 'densite'] as const) {
    verifie(`l’axe ${axe} peut monter`, maxLivre.axes[axe] > 0);
  }
  for (const t of ['hydratation', 'sensible', 'dense', 'fin'] as const) {
    verifie(`le terrain ${t} peut se signaler`, maxLivre.terrains[t] > 0);
  }

  /* Chaque zone doit pouvoir être cotée par une question du miroir, sauf le grain qui l’est aussi. */
  for (const zone of livre.ZONES) {
    verifie(
      `la zone « ${zone.nom} » est renseignée par une question`,
      livre.QUESTIONS.some((q) => q.zone === zone.code) ||
        livre.QUESTIONS.some((q) => (q.zonesVisees ?? []).some((zs) => zs.includes(zone.code))),
    );
  }

  /*
    Les quatre profils doivent rester atteignables sur le barème livré, en
    passant par la chaîne entière : réponses → pré-cotation des zones →
    profil. Un barème où l’un d’eux ne sortirait jamais serait un barème
    qui ment sur ce qu’il propose.
  */
  const atteints = new Set<string>();
  for (const v1 of [0, 2]) {
    for (const v7 of [0, 1, 2]) {
      for (const s1 of [0, 3]) {
        for (const s7 of [0, 3]) {
          for (const v8 of [0, 3]) {
            for (const b1 of [0, 3, 4]) {
              const rep = { v1, v7, s1, s7, v8, b1 };
              atteints.add(calculerProfilSignature(livre, rep, precoterLesZones(livre, rep)).profil);
            }
          }
        }
      }
    }
  }
  egal('les quatre profils restent atteignables', atteints.size, 4);

  /* Et les trois cures, sur les seules zones traitées. */
  const zonesRf = livre.ZONES.filter((z) => z.portee === 'rf').map((z) => z.code);
  const cote = (n: number, valeur: number) =>
    Object.fromEntries(livre.ZONES.map((z) => [z.code, zonesRf.indexOf(z.code) >= 0 && zonesRf.indexOf(z.code) < n ? valeur : 0]));
  egal('rien de coté : Découverte', preconiserLaCure(livre, cote(0, 0) as never).cure.nom, 'Découverte');
  egal('deux zones modérées : Équilibre', preconiserLaCure(livre, cote(2, 2) as never).cure.nom, 'Équilibre');
  egal('quatre zones modérées : Intégrale', preconiserLaCure(livre, cote(4, 2) as never).cure.nom, 'Intégrale');
  egal('une zone marquée : Intégrale', preconiserLaCure(livre, cote(1, 3) as never).cure.nom, 'Intégrale');
}

/*
  Le règlement du Profil Signature.

  LE PREMIER RENDEZ-VOUS ENTRE DANS LE TOTAL (Jonathan, 25 septembre 2026).
  Il ne se déduit toujours pas de la cure — elle le règle dans tous les
  cas —, mais le devis annonce ce qu'elle sort en tout, et il sort de
  l'échéancier DÉJÀ RÉGLÉ, sur la ligne du jour. Ce qui compte, et ce que
  ces contrôles verrouillent : la somme des lignes retombe sur le total,
  et les chèques restent des nombres entiers de séances.
*/
export function controlerReglementSignature() {
  section('Le règlement du Profil Signature');

  const PREMIER = 89;
  const PRIX = 79;
  const cure = (seances: number, n: number, methode: 'centre' | 'alma' = 'centre') =>
    construireEcheancierCure({
      seances,
      prixSeance: PRIX,
      options: PREMIER,
      methode,
      n,
      bilanDejaRegle: PREMIER,
    });

  const comptant = cure(6, 1);
  egalEuros('six séances et le premier rendez-vous font 563 €', comptant.montantARegler, 563);
  egal(
    'le premier rendez-vous sort déjà réglé',
    comptant.echeances.filter((e) => e.type === 'bilan').map((e) => e.montant),
    [89],
  );
  egal(
    'et il reste la cure seule à régler',
    comptant.echeances.filter((e) => e.type === 'echeance').map((e) => e.montant),
    [474],
  );

  const deux = cure(6, 2);
  egal(
    'en deux fois, deux chèques de trois séances',
    deux.echeances.filter((e) => e.type === 'echeance').map((e) => e.montant),
    [237, 237],
  );
  egalEuros(
    'et la somme des lignes retombe sur le total',
    deux.echeances.reduce((t, e) => t + e.montant, 0),
    563,
  );

  const dix = cure(10, 3);
  egalEuros('dix séances : 879 € en tout', dix.montantARegler, 879);
  egal(
    'trois chèques, un nombre entier de séances chacun',
    dix.echeances.filter((e) => e.type === 'echeance').map((e) => e.montant),
    [316, 237, 237],
  );

  /*
    Chez Alma, le premier rendez-vous se règle au centre : le crédit ne le
    finance pas, et il ne porte donc pas de frais.
  */
  const alma = cure(6, 4, 'alma');
  const finance = alma.montantARegler - alma.frais - PREMIER;
  egalEuros('Alma ne finance que la cure', finance, 474);
  egalEuros(
    'le total annoncé est la somme de tout ce qu’elle sort',
    alma.echeances.reduce((t, e) => t + e.montant, 0),
    alma.montantARegler,
  );
}

/** Les questions réellement posées, dans l'ordre. */
/*
  Les questions réellement posées. Elles se demandent au domaine, jamais à
  une copie de la règle : cette fonction refaisait le test de la condition
  à la main, et elle a continué de répondre « oui » après que la règle a
  changé (075).
*/
function relire(reponses: Record<string, number | number[]>) {
  return questionsAPoser(BAREME, reponses);
}
