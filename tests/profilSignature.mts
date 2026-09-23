/*
  Le Bilan Profil Signature anti-âge.

  Ce qui est vérifié ici décide de ce qu'on propose à une cliente devant un
  miroir : son profil, son terrain, et le nombre de séances de sa cure.
  Le barème d'essai reprend la mécanique du barème livré — questions à
  points, questions du miroir qui cotent une zone, besoins qui en allument
  d'autres — en plus court.
*/

import { section, verifie, egal } from './harnais.mts';
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
      code: 'q10c',
      groupe: 'hist',
      t: 'Date du dernier peeling, laser ou injection :',
      si: { code: 'q10', option: 0 },
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

  verifie('un peeling de moins d’un mois décale la cure', soinRecent({ q10: 0, q10c: 0 }));
  verifie('un peeling d’il y a six mois ne décale rien', !soinRecent({ q10: 0, q10c: 1 }));
  verifie('sans historique, rien à décaler', !soinRecent({ q10: 1 }));
  verifie(
    'la date du dernier soin ne se pose pas si elle n’a jamais rien fait',
    !relire({ q10: 1 }).some((q) => q.code === 'q10c'),
  );
}

/** Les questions réellement posées, dans l'ordre. */
function relire(reponses: Record<string, number | number[]>) {
  return BAREME.QUESTIONS.filter((q) => !q.si || (reponses[q.si.code] === q.si.option));
}
