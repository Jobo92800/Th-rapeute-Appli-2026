/*
  MAbeautyplus V2 — Effacer les fiches nées dans la V2

  ⚠️  IRRÉVERSIBLE. Aucune corbeille, aucun retour arrière.

  À NE LANCER QU'APRÈS avoir lu `diagnostics/fiches_de_test.sql` et vérifié
  qu'aucune ligne « ⚠️ À REGARDER » ne correspond à une vraie cliente.

  UNE FICHE EST ÉPARGNÉE : « jonathan Schwartz test », l'essai en cours du
  6 septembre 2026. Elle est protégée deux fois — par son identifiant et par
  son nom. Un seul des deux suffit à la sauver : si l'identifiant avait été
  mal recopié, le nom la retiendrait quand même. Quand cet essai sera fini,
  supprimez-la depuis sa fiche, le geste existe (direction, avec le nom à
  retaper).

  CE QUI PART : les autres fiches dont `origine = 'v2'`, avec tout leur
  dossier — bilans, cures, échéances, séances, mensurations, contrats,
  consentements, notes, ventes, avoirs. Les clés étrangères sont en CASCADE :
  rien ne reste orphelin côté cliente.

  CE QUI RESTE : les fiches `import_v1`, venues du CRM, et tout ce qui ne
  dépend pas d'une cliente — centres, thérapeutes, produits, tarifs,
  barèmes, Missions Déclic, messages internes.

  DEUX MÉNAGES QUE LA CASCADE NE FAIT PAS, et qu'on fait ici :

    — les mouvements de stock nés d'un contrat de test (guide et tenue
      sortis à la signature). Leur `programme_id` est en SET NULL : ils
      survivraient à la suppression et fausseraient le rayon d'autant.
      On les repère avant d'effacer les clientes, pendant qu'on peut
      encore remonter jusqu'à elles.

    — les tâches Airtable en file pour ces fiches. Sans ça, la synchro
      passerait sa vie à essayer de mettre à jour des fiches disparues.

  Tout est dans une transaction : si une seule ligne échoue, rien n'est fait.
*/

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. La liste exacte de ce qui va partir. Lisez-la avant de laisser tourner :
--    « jonathan Schwartz test » ne doit PAS y figurer.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE a_effacer ON COMMIT DROP AS
SELECT id, prenom || ' ' || nom AS fiche, cree_le::date AS creee_le
  FROM clientes
 WHERE origine = 'v2'
   AND id <> 'dd9863de-4cd8-40fe-9f74-d74d4aa436d8'
   AND lower(nom) NOT LIKE '%schwartz%';

SELECT * FROM a_effacer ORDER BY creee_le;

-- ---------------------------------------------------------------------------
-- 1. Les mouvements de stock des contrats de test.
--    Repérés MAINTENANT : après le DELETE, plus rien ne les relie.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE mouvements_a_effacer ON COMMIT DROP AS
SELECT m.id
  FROM mouvements_stock m
  JOIN programmes p ON p.id = m.programme_id
  JOIN a_effacer c ON c.id = p.cliente_id;

DELETE FROM mouvements_stock
 WHERE id IN (SELECT id FROM mouvements_a_effacer);

-- ---------------------------------------------------------------------------
-- 2. La file de synchronisation Airtable.
-- ---------------------------------------------------------------------------
DELETE FROM airtable_sync
 WHERE entite_id IN (SELECT id FROM a_effacer);

-- ---------------------------------------------------------------------------
-- 3. Les fiches. La cascade emporte tout le dossier.
-- ---------------------------------------------------------------------------
DELETE FROM clientes WHERE id IN (SELECT id FROM a_effacer);

-- ---------------------------------------------------------------------------
-- 4. Contrôle. `essais_restants` doit valoir 1 — jonathan Schwartz test —
--    et `reprises_du_crm` votre nombre de fiches importées, inchangé.
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (WHERE origine = 'v2')         AS essais_restants,
  COUNT(*) FILTER (WHERE origine = 'import_v1')  AS reprises_du_crm
FROM clientes;

SELECT prenom || ' ' || nom AS essai_conserve
  FROM clientes WHERE origine = 'v2';

COMMIT;
