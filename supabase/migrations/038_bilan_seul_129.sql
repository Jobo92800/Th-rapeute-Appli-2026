/*
  MAbeautyplus V2 — Migration 038 : le bilan seul passe à 129 €

  Il était à 87 €. Il vaut 129 € à partir d'aujourd'hui.

  On ne modifie pas la ligne existante, on en ajoute une datée. C'est toute
  la raison d'être de la table `tarifs` : le prix en vigueur est celui de la
  ligne la plus récente dont la date est passée. Les bilans déjà facturés
  gardent leurs 87 €, parce que le montant a été recopié sur le bilan au
  moment de sa validation.

  Corriger la ligne de 2026 aurait réécrit l'histoire : le tableau de bord
  aurait annoncé 129 € pour des bilans encaissés à 87 €.

  Pour revenir en arrière, il suffit de supprimer cette ligne :

    DELETE FROM tarifs WHERE code = 'bilan' AND effet_le = '2026-09-03';
*/

INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('bilan', '2026-09-03', 129.00, 'Bilan BioPortrait seul — offert si la cure démarre')
ON CONFLICT (code, effet_le) DO UPDATE
  SET montant = EXCLUDED.montant, libelle = EXCLUDED.libelle;
