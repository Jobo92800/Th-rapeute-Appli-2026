/*
  MAbeautyplus V2 — Retirer la cure 2 d'Alice Fabre, créée par erreur

  ⚠️  IRRÉVERSIBLE.

  Ce qui s'est passé, le 10 septembre 2026 : une cure 2 Alma en 12 fois
  (1 269 €) a été ajoutée par erreur sur la fiche d'Alice Fabre, puis
  arrêtée. Or une cure Alma naît encaissée : l'arrêt a fait « encaissé moins
  consommé » et lui a ouvert un avoir de 1 282,87 € — pour un argent que le
  centre n'a jamais reçu. Jonathan a vérifié chez Alma : seule la cure 1
  (1 269 €, 10 fois) existe.

  CE QUI PART : la cure 2 et tout ce qu'elle a laissé — ses échéances, ses
  séances et lignes (cascade), son contrat s'il y en a un, les sorties de
  stock de sa signature (un guide et une tenue qui n'ont pas été remis), et
  l'avoir. La cure 1, le bilan, les séances faites et les mensurations ne
  bougent pas.

  APRÈS : ouvrir la fiche d'Alice Fabre, onglet Contrat, « Envoyer au CRM »
  — pour que le mode, le statut et les frais dans Airtable redeviennent
  ceux de la cure 1.

  Tout est dans une transaction. Le premier tableau montre ce qui part.
*/

BEGIN;

-- 0. Ce qui va partir : la cure, puis l'avoir.
SELECT p.numero, p.montant_total, p.frais_financement, p.mode_reglement, p.statut,
       (SELECT COUNT(*) FROM contrats k WHERE k.programme_id = p.id)         AS contrats,
       (SELECT COUNT(*) FROM mouvements_stock m WHERE m.programme_id = p.id) AS sorties_stock
FROM programmes p
JOIN clientes c ON c.id = p.cliente_id
WHERE c.airtable_record_id = 'rec4iylI61LyW2PKx'
  AND p.numero = 2
  AND p.statut = 'abandonne';

SELECT a.sens, a.montant, a.motif, a.date_avoir
FROM avoirs a
JOIN clientes c ON c.id = a.cliente_id
WHERE c.airtable_record_id = 'rec4iylI61LyW2PKx';

-- 1. L'avoir né de l'arrêt (et tout autre avoir : elle n'en a aucun de légitime).
DELETE FROM avoirs a
 USING clientes c
 WHERE c.id = a.cliente_id
   AND c.airtable_record_id = 'rec4iylI61LyW2PKx';

-- 2. Les sorties de stock et le contrat de la cure 2 (en SET NULL, la
--    cascade ne les emporterait pas).
DELETE FROM mouvements_stock m
 USING programmes p, clientes c
 WHERE p.id = m.programme_id AND c.id = p.cliente_id
   AND c.airtable_record_id = 'rec4iylI61LyW2PKx'
   AND p.numero = 2 AND p.statut = 'abandonne';

DELETE FROM contrats k
 USING programmes p, clientes c
 WHERE p.id = k.programme_id AND c.id = p.cliente_id
   AND c.airtable_record_id = 'rec4iylI61LyW2PKx'
   AND p.numero = 2 AND p.statut = 'abandonne';

-- 3. La cure 2. La cascade emporte échéances, lignes et séances.
DELETE FROM programmes p
 USING clientes c
 WHERE c.id = p.cliente_id
   AND c.airtable_record_id = 'rec4iylI61LyW2PKx'
   AND p.numero = 2 AND p.statut = 'abandonne';

-- 4. Contrôle : une seule cure, en cours, et aucun avoir.
SELECT p.numero, p.montant_total, p.mode_reglement, p.statut,
       (SELECT COALESCE(SUM(CASE sens WHEN 'accorde' THEN montant ELSE -montant END), 0)
          FROM avoirs a WHERE a.cliente_id = c.id) AS solde_avoir
FROM programmes p
JOIN clientes c ON c.id = p.cliente_id
WHERE c.airtable_record_id = 'rec4iylI61LyW2PKx'
ORDER BY p.numero;

COMMIT;
