/*
  MAbeautyplus V2 — Effacer les fiches nées dans la V2

  ⚠️  IRRÉVERSIBLE. Aucune corbeille, aucun retour arrière.

  À NE LANCER QU'APRÈS avoir lu `diagnostics/fiches_de_test.sql` et vérifié
  qu'aucune ligne « ⚠️ À REGARDER » ne correspond à une vraie cliente.

  CE QUI PART : toutes les fiches dont `origine = 'v2'`, avec tout leur
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
-- 0. Ce qu'on s'apprête à effacer. À comparer avec le diagnostic.
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS fiches_a_effacer FROM clientes WHERE origine = 'v2';

-- ---------------------------------------------------------------------------
-- 1. Les mouvements de stock des contrats de test.
--    Repérés MAINTENANT : après le DELETE, plus rien ne les relie.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE mouvements_a_effacer ON COMMIT DROP AS
SELECT m.id
  FROM mouvements_stock m
  JOIN programmes p ON p.id = m.programme_id
  JOIN clientes  c ON c.id = p.cliente_id
 WHERE c.origine = 'v2';

DELETE FROM mouvements_stock
 WHERE id IN (SELECT id FROM mouvements_a_effacer);

-- ---------------------------------------------------------------------------
-- 2. La file de synchronisation Airtable.
-- ---------------------------------------------------------------------------
DELETE FROM airtable_sync
 WHERE entite_id IN (SELECT id FROM clientes WHERE origine = 'v2');

-- ---------------------------------------------------------------------------
-- 3. Les fiches. La cascade emporte tout le dossier.
-- ---------------------------------------------------------------------------
DELETE FROM clientes WHERE origine = 'v2';

-- ---------------------------------------------------------------------------
-- 4. Contrôle. `restantes` doit valoir 0, `gardees` doit être votre nombre
--    de fiches reprises du CRM.
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (WHERE origine = 'v2')         AS restantes,
  COUNT(*) FILTER (WHERE origine = 'import_v1')  AS gardees
FROM clientes;

COMMIT;
