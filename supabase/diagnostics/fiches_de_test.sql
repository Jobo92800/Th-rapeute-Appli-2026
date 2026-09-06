/*
  MAbeautyplus V2 — Diagnostic : les fiches nées dans la V2

  NE MODIFIE RIEN. À lire avant d'effacer quoi que ce soit.

  Le tri se fait sur `clientes.origine` : `import_v1` pour les fiches venues
  du CRM, `v2` pour toutes les autres — les essais, mais aussi une vraie
  cliente qui aurait été créée ici. C'est tout l'objet de ce diagnostic :
  la colonne « origine » ne fait pas la différence entre un essai et une
  vraie personne, seul le contenu de la fiche la fait.

  REGARDEZ LA DERNIÈRE COLONNE. « À REGARDER » signale une fiche qui porte
  un contrat signé, des séances faites ou de l'argent encaissé. Un essai
  n'a normalement rien de tout ça.
*/

-- 1. Le partage, d'un coup d'œil.
SELECT
  origine,
  COUNT(*)                                   AS fiches,
  MIN(cree_le)::date                         AS la_plus_ancienne,
  MAX(cree_le)::date                         AS la_plus_recente
FROM clientes
GROUP BY origine
ORDER BY origine;

-- 2. Le détail de ce qui serait effacé, une ligne par fiche.
SELECT
  c.prenom || ' ' || c.nom                   AS fiche,
  ce.nom                                     AS centre,
  c.cree_le::date                            AS creee_le,
  (SELECT COUNT(*) FROM bilans b     WHERE b.cliente_id = c.id)      AS bilans,
  (SELECT COUNT(*) FROM programmes p WHERE p.cliente_id = c.id)      AS cures,
  (SELECT COUNT(*) FROM contrats k   WHERE k.cliente_id = c.id)      AS contrats,
  (SELECT COUNT(*) FROM seances s    WHERE s.cliente_id = c.id
                                       AND s.cloturee)                AS seances_faites,
  COALESCE((SELECT SUM(e.montant) FROM echeances e
              JOIN programmes p2 ON p2.id = e.programme_id
             WHERE p2.cliente_id = c.id AND e.statut = 'paye'), 0)   AS encaisse,
  CASE
    WHEN EXISTS (SELECT 1 FROM contrats k WHERE k.cliente_id = c.id)
      OR EXISTS (SELECT 1 FROM seances s WHERE s.cliente_id = c.id AND s.cloturee)
      OR EXISTS (SELECT 1 FROM echeances e
                   JOIN programmes p3 ON p3.id = e.programme_id
                  WHERE p3.cliente_id = c.id AND e.statut = 'paye')
    THEN '⚠️ À REGARDER'
    ELSE 'essai probable'
  END                                        AS verdict
FROM clientes c
LEFT JOIN centres ce ON ce.id = c.centre_id
WHERE c.origine = 'v2'
ORDER BY verdict DESC, c.cree_le;
