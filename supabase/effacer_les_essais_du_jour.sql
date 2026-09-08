/*
  MAbeautyplus V2 — Effacer les essais d'aujourd'hui

  ⚠️  IRRÉVERSIBLE. Aucune corbeille, aucun retour arrière.

  À LANCER APRÈS avoir lu `diagnostics/fiches_de_test.sql`, dont le second
  tableau liste les fiches jour par jour : vous devez y reconnaître, à la
  date du jour, exactement les essais que vous voulez voir disparaître.

  CE QUI PART : les fiches nées dans la V2 (`origine = 'v2'`) et créées
  AUJOURD'HUI, avec tout leur dossier — bilans, cures, échéances, séances,
  mensurations, contrats, consentements, notes, ventes, avoirs. Les clés
  étrangères sont en cascade : rien ne reste orphelin.

  CE QUI RESTE : les fiches reprises du CRM, les essais des jours
  précédents, et tout ce qui ne dépend pas d'une cliente.

  L'HEURE EST LUE À PARIS. `CURRENT_DATE` seul travaille en UTC : une fiche
  saisie à une heure du matin serait rangée la veille et survivrait au
  ménage sans qu'on comprenne pourquoi.

  DEUX MÉNAGES QUE LA CASCADE NE FAIT PAS, et qu'on fait ici : les
  mouvements de stock nés d'un contrat d'essai — leur `programme_id` est en
  SET NULL, ils fausseraient le rayon — et les tâches Airtable en file pour
  des fiches qui n'existeront plus.

  DEUX CHOSES QUE CE SCRIPT NE PEUT PAS FAIRE, et qui restent à votre main :

    — les fiches déjà parties dans AIRTABLE n'en sortiront pas toutes
      seules. Elles y restent, à supprimer depuis le CRM.

    — les comptes créés dans MON PARCOURS le sont dans une autre
      application, avec sa propre base. Une cliente d'essai à qui on a donné
      l'accès audio garde son compte là-bas.

  Tout est dans une transaction : si une seule ligne échoue, rien n'est fait.
*/

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. La liste exacte de ce qui va partir. LISEZ-LA avant de laisser tourner.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE a_effacer ON COMMIT DROP AS
SELECT id, prenom || ' ' || nom AS fiche, cree_le
  FROM clientes
 WHERE origine = 'v2'
   AND (cree_le AT TIME ZONE 'Europe/Paris')::date
     = (now()    AT TIME ZONE 'Europe/Paris')::date;

SELECT fiche, to_char(cree_le AT TIME ZONE 'Europe/Paris', 'HH24:MI') AS creee_a
  FROM a_effacer ORDER BY cree_le;

-- ---------------------------------------------------------------------------
-- 1. Les mouvements de stock des contrats d'essai.
--    Repérés maintenant : après le DELETE, plus rien ne les relie.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE mouvements_a_effacer ON COMMIT DROP AS
SELECT m.id
  FROM mouvements_stock m
  JOIN programmes p  ON p.id = m.programme_id
  JOIN a_effacer  c  ON c.id = p.cliente_id;

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
-- 4. Contrôle. `essais_du_jour` doit valoir 0 ; `reprises_du_crm` n'a pas
--    bougé, et `essais_des_jours_precedents` non plus.
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (
    WHERE origine = 'v2'
      AND (cree_le AT TIME ZONE 'Europe/Paris')::date
        = (now()   AT TIME ZONE 'Europe/Paris')::date
  )                                              AS essais_du_jour,
  COUNT(*) FILTER (
    WHERE origine = 'v2'
      AND (cree_le AT TIME ZONE 'Europe/Paris')::date
        < (now()   AT TIME ZONE 'Europe/Paris')::date
  )                                              AS essais_des_jours_precedents,
  COUNT(*) FILTER (WHERE origine = 'import_v1')  AS reprises_du_crm
FROM clientes;

COMMIT;
