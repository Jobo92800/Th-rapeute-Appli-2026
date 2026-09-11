/*
  MAbeautyplus V2 — Effacer les fiches de test nommément

  ⚠️  IRRÉVERSIBLE. Aucune corbeille, aucun retour arrière.

  Le ménage « essais du jour » ne voit que les fiches créées aujourd'hui.
  Celui-ci vise des fiches précises, quel que soit leur âge :

    — toute fiche née dans la V2 dont le nom ou le prénom contient « test ».

  Rien d'autre : une vraie cliente ne s'efface pas par script.

  Tout leur dossier part avec elles — bilans, cures, échéances, séances,
  contrats, avoirs — par la cascade des clés étrangères. Les mouvements de
  stock nés de leurs contrats et leurs tâches Airtable en file sont
  retirés aussi, la cascade ne le fait pas.

  CE QUE CE SCRIPT NE FAIT PAS : leurs copies dans AIRTABLE, à supprimer
  depuis le CRM, et leurs comptes dans MON PARCOURS.

  Tout est dans une transaction : si une seule ligne échoue, rien n'est fait.
  Le premier tableau liste ce qui va partir — LISEZ-LE.
*/

BEGIN;

-- 0. La liste exacte de ce qui va partir.
SELECT
  prenom || ' ' || nom                                    AS fiche,
  to_char(cree_le AT TIME ZONE 'Europe/Paris', 'DD/MM')   AS creee_le,
  airtable_record_id                                      AS airtable,
  (SELECT COUNT(*) FROM programmes p WHERE p.cliente_id = c.id) AS cures
FROM clientes c
WHERE origine = 'v2'
  AND (nom ILIKE '%test%' OR prenom ILIKE '%test%')
ORDER BY cree_le;

-- 1. Les mouvements de stock de leurs contrats.
DELETE FROM mouvements_stock m
 USING programmes p, clientes c
 WHERE p.id = m.programme_id
   AND c.id = p.cliente_id
   AND c.origine = 'v2'
   AND (c.nom ILIKE '%test%' OR c.prenom ILIKE '%test%');

-- 2. Leurs tâches Airtable en file.
DELETE FROM airtable_sync
 WHERE entite_id IN (
   SELECT id FROM clientes
    WHERE origine = 'v2'
      AND (nom ILIKE '%test%' OR prenom ILIKE '%test%')
 );

-- 3. Les fiches. La cascade emporte le dossier.
DELETE FROM clientes
 WHERE origine = 'v2'
   AND (nom ILIKE '%test%' OR prenom ILIKE '%test%');

-- 4. Contrôle : `restantes` doit valoir 0.
SELECT
  COUNT(*) FILTER (
    WHERE origine = 'v2'
      AND (nom ILIKE '%test%' OR prenom ILIKE '%test%')
  )                                             AS restantes,
  COUNT(*) FILTER (WHERE origine = 'v2')        AS fiches_v2,
  COUNT(*) FILTER (WHERE origine = 'import_v1') AS reprises_du_crm
FROM clientes;

COMMIT;
