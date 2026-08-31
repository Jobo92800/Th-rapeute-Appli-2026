/*
  MAbeautyplus V2 — Migration 006 : échéances datées et situation de règlement

  1. Date d'échéance     la première tombe le jour de la cure, puis une par mois
  2. Rattrapage          les cures déjà enregistrées reçoivent leurs dates
  3. Vue de situation     ce qui est en retard, encaissé, restant, par cliente
*/

-- ---------------------------------------------------------------------------
-- 1. Rattrapage des cures existantes
--    Première échéance à la date de validation, puis une par mois.
-- ---------------------------------------------------------------------------

UPDATE echeances e
SET date_prevue = (
  COALESCE(p.date_validation, p.cree_le::date) + ((e.rang - 1) * INTERVAL '1 month')
)::date
FROM programmes p
WHERE p.id = e.programme_id
  AND e.date_prevue IS NULL
  AND e.type = 'echeance';

-- ---------------------------------------------------------------------------
-- 2. Situation de règlement par cliente
--    « En retard » se déduit de la date, il n'est jamais saisi : une échéance
--    non réglée dont la date est passée est en retard, point.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW situation_reglement WITH (security_invoker = true) AS
SELECT
  p.cliente_id,
  p.centre_id,

  COUNT(*) FILTER (
    WHERE e.statut IN ('a_venir', 'impaye') AND e.date_prevue < CURRENT_DATE
  ) AS nb_en_retard,

  COALESCE(SUM(e.montant) FILTER (
    WHERE e.statut IN ('a_venir', 'impaye') AND e.date_prevue < CURRENT_DATE
  ), 0) AS montant_en_retard,

  COALESCE(SUM(e.montant) FILTER (WHERE e.statut = 'paye'), 0)   AS montant_encaisse,
  COALESCE(SUM(e.montant) FILTER (WHERE e.statut = 'donne'), 0)  AS montant_donne,

  COALESCE(SUM(e.montant) FILTER (
    WHERE e.statut IN ('a_venir', 'impaye')
  ), 0) AS montant_restant,

  MIN(e.date_prevue) FILTER (
    WHERE e.statut IN ('a_venir', 'impaye') AND e.date_prevue >= CURRENT_DATE
  ) AS prochaine_echeance,

  COUNT(*) AS nb_echeances,
  COUNT(*) FILTER (WHERE e.statut = 'paye') AS nb_payees

FROM programmes p
JOIN echeances e ON e.programme_id = p.id
WHERE p.statut <> 'abandonne'
GROUP BY p.cliente_id, p.centre_id;

COMMENT ON VIEW situation_reglement IS
  'Situation de règlement agrégée par cliente : retards, encaissé, restant, prochaine échéance.';
