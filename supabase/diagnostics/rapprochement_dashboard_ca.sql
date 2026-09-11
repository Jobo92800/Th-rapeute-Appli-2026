/*
  MAbeautyplus V2 — Rapprocher le tableau de bord avec le « Dashboard CA »

  Ne modifie rien, se relance à volonté.

  Les deux outils ne comptent pas la même chose, et c'est normal qu'ils
  diffèrent. Ce diagnostic dit DE COMBIEN et POURQUOI, pour comparer
  ligne à ligne avec le Dashboard CA, qui lit Airtable directement.

  Ce que la V2 fait différemment, en lisant son code :
    · une cure par montant Airtable (« Montant Cure » … « Montant cure 9 »),
      donc plus de cures que de fiches ;
    · l'avoir Airtable est DÉDUIT de la première cure ;
    · toutes les cures reprises sont datées à la création de la fiche ;
    · les cures arrêtées sont exclues ;
    · le signé est HORS frais Alma, alors que « Montant Cure » les inclut ;
    · depuis la reprise du CRM, les ventes de l'ancienne application
      n'arrivent plus dans la V2 — elles vont dans Airtable seulement ;
    · les fiches d'essai de la V2 partent dans Airtable par la synchro.

  À comparer avec le « Signé » du tableau de bord, jamais avec l'encaissé.
*/

-- 1. Le total, décomposé. C'est ici que se lit l'écart sur « Tout ».
SELECT
  COUNT(*)                                                    AS cures,
  ROUND(SUM(montant_total))                                   AS signe_total,
  COUNT(*)      FILTER (WHERE numero = 1)                     AS cures_1,
  ROUND(SUM(montant_total) FILTER (WHERE numero = 1))         AS montant_cures_1,
  COUNT(*)      FILTER (WHERE numero > 1)                     AS cures_2_et_plus,
  ROUND(SUM(montant_total) FILTER (WHERE numero > 1))         AS montant_cures_2_et_plus,
  COUNT(*)      FILTER (WHERE origine = 'import_v1')          AS reprises_du_crm,
  COUNT(*)      FILTER (WHERE origine <> 'import_v1')         AS nees_dans_la_v2,
  ROUND(SUM(montant_total) FILTER (WHERE origine <> 'import_v1')) AS montant_nees_dans_la_v2,
  COUNT(*)      FILTER (WHERE statut = 'abandonne')           AS arretees,
  ROUND(SUM(montant_total) FILTER (WHERE statut = 'abandonne')) AS montant_arretees,
  ROUND(SUM(frais_financement))                               AS frais_alma_hors_signe
FROM programmes;

-- 2. Les cures des 30 derniers jours, une par ligne, à pointer contre le
--    Dashboard CA. La colonne airtable dit si la fiche existe dans le CRM.
SELECT
  p.date_validation                          AS date,
  c.nom, c.prenom,
  ce.nom                                     AS centre,
  p.numero                                   AS cure,
  p.montant_total                            AS montant,
  p.frais_financement                        AS frais_alma,
  p.mode_reglement                           AS reglement,
  p.statut,
  p.origine,
  COALESCE(c.airtable_record_id, '— pas dans Airtable') AS airtable
FROM programmes p
JOIN clientes c  ON c.id  = p.cliente_id
LEFT JOIN centres ce ON ce.id = p.centre_id
WHERE p.date_validation >= CURRENT_DATE - 30
ORDER BY p.date_validation DESC, c.nom, p.numero;
