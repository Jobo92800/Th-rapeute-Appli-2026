/*
  MAbeautyplus V2 — Qui est en retard, exactement

  Le tableau de bord annonce un montant en retard, mais un montant ne se
  rappelle pas : il faut un nom. Cette requête nomme chaque échéance
  dépassée, dit à quelle cure elle appartient, et dans quel état est la
  fiche — active, archivée, de test, reprise du CRM.

  NE MODIFIE RIEN.
*/

SELECT
  c.prenom || ' ' || c.nom                        AS cliente,
  ce.nom                                          AS centre,
  CASE
    WHEN c.archivee_le IS NOT NULL THEN 'ARCHIVÉE'
    WHEN c.prenom || ' ' || c.nom ILIKE '%test%'  THEN 'FICHE DE TEST'
    WHEN p.origine = 'import_v1'                  THEN 'cure reprise du CRM'
    ELSE 'active'
  END                                             AS etat,
  'cure ' || p.numero                             AS cure,
  e.rang                                          AS echeance,
  e.montant,
  e.date_prevue,
  (CURRENT_DATE - e.date_prevue)                  AS jours_de_retard,
  e.statut,
  coalesce(t.prenom, '—')                         AS therapeute,
  coalesce(c.telephone, c.email, 'pas de contact') AS pour_relancer
FROM echeances e
JOIN programmes p ON p.id = e.programme_id
JOIN clientes c   ON c.id = p.cliente_id
JOIN centres ce   ON ce.id = p.centre_id
LEFT JOIN therapeutes t ON t.id = p.therapeute_id
WHERE e.statut IN ('a_venir', 'impaye')
  AND e.date_prevue < CURRENT_DATE
  AND p.statut <> 'abandonne'
ORDER BY e.date_prevue;
