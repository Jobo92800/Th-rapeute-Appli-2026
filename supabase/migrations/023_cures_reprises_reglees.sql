/*
  MAbeautyplus V2 — Migration 023 : solder les cures reprises du CRM

  Après la reprise, le tableau de bord affichait 630 000 € signés et 3 000 €
  encaissés. Ce n'est pas une erreur de calcul : les cures reprises n'ont
  aucune échéance, parce qu'Airtable ne garde aucune trace des règlements.
  L'argent de ces cures est rentré — ou perdu — depuis longtemps.

  On leur pose donc une échéance unique, déjà réglée, à la date de la cure.
  C'est une approximation, et elle est assumée : la date de règlement vaut
  celle de la cure, faute de mieux. Sans elle, ces 630 000 € resteraient
  éternellement « à encaisser » et fausseraient tous les indicateurs.

  Au passage, on rattache la thérapeute : elle est sur la fiche cliente,
  reprise du CRM, mais les cures ne la portaient pas — sans quoi un chiffre
  d'affaires par thérapeute serait vide sur tout l'historique.

  Rejouable : ce qui est déjà fait n'est pas refait.
*/

-- ---------------------------------------------------------------------------
-- 1. Une échéance unique, réglée, pour chaque cure reprise
-- ---------------------------------------------------------------------------

INSERT INTO echeances (programme_id, type, rang, montant, date_prevue, statut, date_reglement, note)
SELECT
  p.id,
  'echeance',
  1,
  p.montant_total,
  p.date_validation,
  'paye',
  p.date_validation,
  'Cure reprise du CRM : règlement supposé à la date de la cure'
FROM programmes p
WHERE p.origine = 'import_v1'
  AND p.montant_total > 0
  AND NOT EXISTS (SELECT 1 FROM echeances e WHERE e.programme_id = p.id);

-- ---------------------------------------------------------------------------
-- 2. La thérapeute de la fiche devient celle de ses cures reprises
-- ---------------------------------------------------------------------------

UPDATE programmes p
SET therapeute_id = t.id
FROM clientes c
JOIN therapeutes t
  ON t.centre_id = c.centre_id
 AND lower(trim(t.prenom)) = lower(trim(c.therapeutes[1]))
WHERE p.cliente_id = c.id
  AND p.origine = 'import_v1'
  AND p.therapeute_id IS NULL
  AND array_length(c.therapeutes, 1) >= 1;
