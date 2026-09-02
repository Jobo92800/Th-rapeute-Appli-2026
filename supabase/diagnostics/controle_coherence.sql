/*
  MAbeautyplus V2 — Contrôle de cohérence

  À coller dans l'éditeur SQL de Supabase (projet MAbeautyplus V2).
  CE SCRIPT NE MODIFIE RIEN : il compte, il montre, il ne supprime pas.

  Chaque ligne est un contrôle. « nb » à zéro veut dire que tout va bien.
  La colonne « exemples » donne de quoi retrouver les fiches concernées.
*/

WITH controles AS (

  -- 1. Une fiche archivée n'apparaît plus dans les listes, mais ses
  --    échéances impayées continuent de compter dans « En retard ».
  SELECT 1 AS ordre,
    'Fiches archivées avec des échéances impayées' AS controle,
    COUNT(DISTINCT c.id) AS nb,
    COALESCE(SUM(e.montant), 0)::text || ' €' AS montant,
    string_agg(DISTINCT c.prenom || ' ' || c.nom, ', ' ORDER BY c.prenom || ' ' || c.nom) AS exemples
  FROM clientes c
  JOIN programmes p ON p.cliente_id = c.id
  JOIN echeances e ON e.programme_id = p.id
  WHERE c.archivee_le IS NOT NULL
    AND e.statut IN ('a_venir', 'impaye')
    AND e.date_prevue < CURRENT_DATE

  UNION ALL

  -- 2. Les fiches qui ressemblent à des essais.
  SELECT 2,
    'Fiches dont le nom ressemble à un test',
    COUNT(*), '',
    string_agg(prenom || ' ' || nom || ' (' || centre_id || ')', ', ' ORDER BY cree_le)
  FROM clientes
  WHERE prenom || ' ' || nom ILIKE ANY (ARRAY[
    '%test%', '%essai%', '%jojo%', '%azerty%', '%qwerty%', '%aaa%', '%xxx%', '%demo%'
  ])

  UNION ALL

  -- 3. Une cure validée sans la moindre échéance : rien à encaisser, donc
  --    invisible dans le suivi des règlements. Les cures reprises du CRM
  --    sont exclues, la 023 leur en a posé une.
  SELECT 3,
    'Cures de la V2 sans échéancier',
    COUNT(*),
    COALESCE(SUM(p.montant_total), 0)::text || ' €',
    string_agg(c.prenom || ' ' || c.nom || ' — cure ' || p.numero, ', ' ORDER BY p.cree_le)
  FROM programmes p
  JOIN clientes c ON c.id = p.cliente_id
  WHERE p.origine = 'v2'
    AND p.statut <> 'abandonne'
    AND NOT EXISTS (SELECT 1 FROM echeances e WHERE e.programme_id = p.id)

  UNION ALL

  -- 4. Le total des échéances doit faire le montant de la cure. Un écart
  --    veut dire qu'on a modifié l'un sans l'autre.
  SELECT 4,
    'Cures dont les échéances ne font pas le montant',
    COUNT(*), '',
    string_agg(x.qui || ' (écart ' || round(x.ecart)::text || ' €)', ', ')
  FROM (
    SELECT c.prenom || ' ' || c.nom AS qui,
           p.montant_total + p.frais_financement - SUM(e.montant) AS ecart
    FROM programmes p
    JOIN clientes c ON c.id = p.cliente_id
    JOIN echeances e ON e.programme_id = p.id
    WHERE p.origine = 'v2' AND p.statut <> 'abandonne'
    GROUP BY p.id, c.prenom, c.nom, p.montant_total, p.frais_financement
    HAVING abs(p.montant_total + p.frais_financement - SUM(e.montant)) > 1
  ) x

  UNION ALL

  -- 5. Deux fiches pour la même personne dans le même centre.
  SELECT 5,
    'Doublons probables (même nom, même centre)',
    COUNT(*), '',
    string_agg(x.qui || ' ×' || x.n::text, ', ')
  FROM (
    SELECT lower(trim(prenom)) || ' ' || lower(trim(nom)) AS qui, centre_id, COUNT(*) AS n
    FROM clientes
    WHERE archivee_le IS NULL
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  ) x

  UNION ALL

  -- 6. Une fiche sans identifiant Airtable n'est jamais partie dans le CRM.
  SELECT 6,
    'Fiches jamais synchronisées vers Airtable',
    COUNT(*), '',
    string_agg(prenom || ' ' || nom, ', ' ORDER BY cree_le DESC)
  FROM clientes
  WHERE airtable_record_id IS NULL AND archivee_le IS NULL

  UNION ALL

  -- 7. Ce qui bloque dans la file de synchronisation.
  SELECT 7,
    'Tâches de synchronisation en échec',
    COUNT(*), '',
    string_agg(DISTINCT entite || ' : ' || left(coalesce(derniere_erreur, ''), 60), ' | ')
  FROM airtable_sync
  WHERE statut = 'erreur'

  UNION ALL

  SELECT 8,
    'Tâches de synchronisation en attente',
    COUNT(*), '',
    string_agg(DISTINCT entite, ', ')
  FROM airtable_sync
  WHERE statut = 'en_attente'

  UNION ALL

  -- 9. Une cure reprise à zéro euro n'apporte rien et fausse le panier moyen.
  SELECT 9,
    'Cures reprises à 0 €',
    COUNT(*), '',
    string_agg(c.prenom || ' ' || c.nom, ', ')
  FROM programmes p
  JOIN clientes c ON c.id = p.cliente_id
  WHERE p.origine = 'import_v1' AND p.montant_total <= 0

  UNION ALL

  -- 10. Un contrat signé pour une cure qui n'existe plus.
  SELECT 10,
    'Contrats rattachés à aucune cure',
    COUNT(*), '',
    string_agg(c.prenom || ' ' || c.nom, ', ')
  FROM contrats k
  JOIN clientes c ON c.id = k.cliente_id
  WHERE k.programme_id IS NULL

  UNION ALL

  -- 11. Des séances sans cure : impossible en principe, à vérifier.
  SELECT 11,
    'Séances rattachées à une cure absente',
    COUNT(*), '', ''
  FROM seances s
  WHERE NOT EXISTS (SELECT 1 FROM programmes p WHERE p.id = s.programme_id)

  UNION ALL

  -- 12. Une fiche sans téléphone ni email ne peut pas être rappelée.
  SELECT 12,
    'Fiches actives sans téléphone ni email',
    COUNT(*), '',
    string_agg(prenom || ' ' || nom || ' (' || centre_id || ')', ', ' ORDER BY cree_le DESC)
  FROM clientes
  WHERE archivee_le IS NULL
    AND coalesce(telephone, '') = ''
    AND coalesce(email, '') = ''

  UNION ALL

  -- 13. Le mouvement de stock d'une vente supprimée doit partir avec elle.
  SELECT 13,
    'Mouvements de stock liés à une vente disparue',
    COUNT(*), '', ''
  FROM mouvements_stock m
  WHERE m.vente_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ventes_complements v WHERE v.id = m.vente_id)

  UNION ALL

  -- 14. Un stock négatif signale un comptage à refaire.
  SELECT 14,
    'Produits en stock négatif',
    COUNT(*), '',
    string_agg(nom || ' (' || centre_id || ' : ' || quantite::text || ')', ', ')
  FROM etat_stock
  WHERE quantite < 0

  UNION ALL

  -- 15. Une filleule qui se parraine elle-même, ou une boucle.
  SELECT 15,
    'Parrainages incohérents',
    COUNT(*), '',
    string_agg(c.prenom || ' ' || c.nom, ', ')
  FROM clientes c
  JOIN clientes m ON m.id = c.parrain_id
  WHERE c.parrain_id = c.id OR m.parrain_id = c.id
)

SELECT controle, nb, montant, left(coalesce(exemples, ''), 400) AS exemples
FROM controles
ORDER BY (nb = 0), ordre;
