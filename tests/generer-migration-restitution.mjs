/*
  Écrit la migration 076 à partir de `supabase/contenu/restitution-bioportrait.json`.

  Les textes de la restitution vivent dans le barème, en base — c'est là que
  l'application les lit, bilan par bilan, dans la version qu'il retient. Mais
  un fichier de 20 Ko recopié à la main dans du SQL finit par diverger de ce
  que le banc d'essai contrôle. Le JSON est donc la source, et la migration
  en est générée.

      node tests/generer-migration-restitution.mjs

  Rejouer le script ne change rien tant que le JSON n'a pas bougé.
*/
import { readFileSync, writeFileSync } from 'node:fs';

const CONTENU = JSON.parse(
  readFileSync(new URL('../supabase/contenu/restitution-bioportrait.json', import.meta.url), 'utf8'),
);

/** Un littéral SQL jsonb : les apostrophes du français se doublent. */
const lit = (o) => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";

const entete = `/*
  MAbeautyplus V2 — Migration 076 : le contenu de la restitution BioPortrait

  La restitution remise à la cliente passe de deux pages à quatre — trois pour
  celle qui démarre, qui a son contrat pour le prix. Elle raconte ce qu'elle
  vit, ce qui se passe dans son corps, et met chaque élément de sa cure en
  face d'un point précis de son analyse.

  TOUT CE QU'ELLE DIT VIENT D'ICI, c'est-à-dire du barème. Les textes
  d'interprétation vivaient jusqu'à présent à moitié en base et à moitié dans
  le code du PDF ; une liste figée à côté d'un contenu versionné finit
  toujours par mentir — c'est ce qui avait fait écrire « Rétention » sous le
  score InBody.

  Ce que la migration ajoute, SANS TOUCHER à une seule question, à un seul
  point ni à un seul palier. À réponses identiques, une cliente paie
  exactement pareil :

    · \`AX[code]\` gagne de quoi écrire deux pages — \`resume\`, \`manif\`,
      \`vecu\` (ce qu'elle vit, les profils seulement), \`meca\` (ce qui se
      passe réellement), \`prio\` pour un profil, \`agir\` pour un terrain. Et
      \`sig\`, le sous-titre, est réécrit sur cinq axes : « le corps consolé »
      plutôt que « l'aliment refuge ». L'écran de restitution lit le même
      champ, donc la thérapeute dira devant la cliente ce que le document
      écrira.

    · Chaque question d'analyse gagne \`lecture\`, un tableau parallèle à ses
      réponses : pour chacune, la situation en deux mots, le nombre de
      pastilles, s'il faut alerter, et la phrase qui explique. LE POINT DE
      VIGILANCE DE LA PAGE 1 EN SORT : c'est la première réponse en alerte,
      et s'il n'y en a aucune il n'y a pas de point — l'ancienne version en
      désignait un au hasard pendant que le tableau disait, deux lignes plus
      haut, qu'il n'y avait rien à signaler.

    · \`RESTITUTION\` porte les soins — titre, description, atouts,
      pictogramme —, le socle commun, et la matrice qui met un soin en face de
      chaque point de l'analyse, avec ce qu'il y apporte.

  LE VOCABULAIRE EST CELUI DE LA MAISON : « I-Shape » et non
  « Electrostimulation », « Mon Parcours » et non « l'application Nutrition »,
  « Missions Déclic » et non « défis », « guide de rééquilibrage alimentaire »
  et non « rééducation ». La Luxothérapie Ménopause n'existe pas ici et n'est
  pas reprise ; le Dôme, qui n'a rien à voir avec le BioPortrait, n'entre dans
  aucune association.

  LE GENRE. Quatre textes étaient écrits au féminin. Ils portent \`{e}\`, que
  l'application remplace par « e » ou par rien selon la civilité : une fiche
  d'homme ne lira pas « vous êtes allongée ».

  Les soins sont nommés par LEURS CODES de la maison (LUXO, RELAX, ISHAPE,
  PRESSO) et les mesures par LEUR RANG dans le questionnaire, jamais par leur
  libellé — « Score InBody / 100 » ici, « Score global » dans le paquet
  d'origine.

  CE FICHIER EST GÉNÉRÉ depuis \`supabase/contenu/restitution-bioportrait.json\`,
  que le banc d'essai lit aussi. Ne pas le modifier à la main :
  \`node tests/generer-migration-restitution.mjs\`.

  Rejouable sans risque.
*/

BEGIN;
`;

const morceaux = [];

morceaux.push("\n-- 1. De quoi écrire les deux premières pages, axe par axe.\n");
for (const code of Object.keys(CONTENU.AXES).sort()) {
  morceaux.push(
    `UPDATE bareme_empreinte\n` +
      `SET contenu = jsonb_set(contenu, '{AX,${code}}', (contenu->'AX'->'${code}') || ${lit(CONTENU.AXES[code])})\n` +
      `WHERE version = 3 AND contenu->'AX' ? '${code}';\n`,
  );
}

const lecture = Object.fromEntries(
  Object.entries(CONTENU.LECTURE).map(([question, reponses]) => [
    question,
    reponses.map(([s, n, a, t]) => ({ s, n, a, t })),
  ]),
);

morceaux.push(`
/*
  2. La lecture des cinq mesures d'analyse.

  Le tableau \`lecture\` suit les réponses une à une : la réponse cochée donne
  directement sa ligne du tableau de composition corporelle. Il se pose par le
  LIBELLÉ de la question, et le script s'arrête net si l'une d'elles a changé
  de nom ou de nombre de réponses — mieux vaut un échec bruyant qu'une phrase
  écrite sous la mauvaise réponse.
*/
DO $$
DECLARE
  attendu jsonb := ${lit(lecture)};
  question text;
  idx      int;
  combien  int;
BEGIN
  FOR question IN SELECT jsonb_object_keys(attendu) LOOP
    SELECT (ord - 1)::int INTO idx
    FROM bareme_empreinte b, jsonb_array_elements(b.contenu->'STEPS') WITH ORDINALITY AS t(st, ord)
    WHERE b.version = 3 AND st->>'t' = question
    LIMIT 1;

    IF idx IS NULL THEN
      RAISE EXCEPTION 'Question d''analyse introuvable dans le barème 3 : %', question;
    END IF;

    SELECT jsonb_array_length(contenu->'STEPS'->idx->'o') INTO combien
    FROM bareme_empreinte WHERE version = 3;

    IF combien <> jsonb_array_length(attendu->question) THEN
      RAISE EXCEPTION '« % » a % réponses, la lecture en décrit %.',
        question, combien, jsonb_array_length(attendu->question);
    END IF;

    UPDATE bareme_empreinte
    SET contenu = jsonb_set(contenu, ARRAY['STEPS', idx::text, 'lecture'], attendu->question)
    WHERE version = 3;
  END LOOP;
END $$;
`);

morceaux.push(
  "\n-- 3. Les soins, le socle, et ce que chacun apporte à chaque point de l'analyse.\n" +
    `UPDATE bareme_empreinte\n` +
    `SET contenu = jsonb_set(contenu, '{RESTITUTION}', ${lit(CONTENU.RESTITUTION)})\n` +
    `WHERE version = 3;\n`,
);

const pied = `
COMMIT;

-- Contrôle : tout est en place, et les questions n'ont pas bougé.
SELECT
  (SELECT count(*) FROM jsonb_object_keys(contenu->'AX')) AS axes,
  (SELECT count(*) FROM jsonb_array_elements(contenu->'STEPS') s WHERE s ? 'lecture') AS mesures_lues,
  (SELECT count(*) FROM jsonb_object_keys(contenu->'RESTITUTION'->'EFFET')) AS effets,
  (SELECT count(*) FROM jsonb_array_elements(contenu->'STEPS')) AS etapes,
  contenu->'AX'->'P1'->>'sig' AS sous_titre_reconfort
FROM bareme_empreinte WHERE version = 3;
`;

const chemin = new URL('../supabase/migrations/076_restitution_bioportrait.sql', import.meta.url);
writeFileSync(chemin, entete + morceaux.join('') + pied, 'utf8');
console.log('076 écrite —', Object.keys(CONTENU.AXES).length, 'axes,',
  Object.keys(CONTENU.LECTURE).length, 'mesures,',
  Object.keys(CONTENU.RESTITUTION.EFFET).length, 'effets');
