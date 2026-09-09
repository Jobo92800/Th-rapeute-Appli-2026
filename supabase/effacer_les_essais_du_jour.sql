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

  PAS DE TABLE TEMPORAIRE, ET C'EST VOLONTAIRE. L'éditeur de Supabase
  s'alarme dès qu'il voit un `CREATE TABLE`, même temporaire : il propose
  d'y activer la sécurité par ligne, ce qui n'a aucun sens sur une table qui
  vit trois instructions. Plutôt que d'apprendre à ignorer un avertissement
  — l'habitude qui fait cliquer trop vite le jour où il est fondé —, on
  répète la condition dans chaque instruction. Elle est déterministe, et les
  suppressions vont du plus dépendant au moins dépendant.
*/

-- La condition, la même partout : née dans la V2, créée aujourd'hui à Paris.
-- (`CURRENT_DATE` seul travaille en UTC et raterait les fiches saisies
--  entre minuit et deux heures du matin.)

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. La liste exacte de ce qui va partir. LISEZ-LA avant de laisser tourner.
-- ---------------------------------------------------------------------------
SELECT
  prenom || ' ' || nom                                          AS fiche,
  to_char(cree_le AT TIME ZONE 'Europe/Paris', 'HH24:MI')       AS creee_a
FROM clientes
WHERE origine = 'v2'
  AND (cree_le AT TIME ZONE 'Europe/Paris')::date
    = (now()   AT TIME ZONE 'Europe/Paris')::date
ORDER BY cree_le;

-- ---------------------------------------------------------------------------
-- 1. Les mouvements de stock des contrats d'essai.
--    Repérés maintenant : après le DELETE, plus rien ne les relie.
-- ---------------------------------------------------------------------------
DELETE FROM mouvements_stock m
 USING programmes p, clientes c
 WHERE p.id = m.programme_id
   AND c.id = p.cliente_id
   AND c.origine = 'v2'
   AND (c.cree_le AT TIME ZONE 'Europe/Paris')::date
     = (now()     AT TIME ZONE 'Europe/Paris')::date;

-- ---------------------------------------------------------------------------
-- 2. La file de synchronisation Airtable.
-- ---------------------------------------------------------------------------
DELETE FROM airtable_sync
 WHERE entite_id IN (
   SELECT id FROM clientes
    WHERE origine = 'v2'
      AND (cree_le AT TIME ZONE 'Europe/Paris')::date
        = (now()   AT TIME ZONE 'Europe/Paris')::date
 );

-- ---------------------------------------------------------------------------
-- 3. Les fiches. La cascade emporte tout le dossier.
-- ---------------------------------------------------------------------------
DELETE FROM clientes
 WHERE origine = 'v2'
   AND (cree_le AT TIME ZONE 'Europe/Paris')::date
     = (now()   AT TIME ZONE 'Europe/Paris')::date;

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
