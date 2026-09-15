/*
  MAbeautyplus V2 — Migration 063 : la taille de la combi I-Shape

  Deux tailles se croisent sur l'I-Shape. La TENUE (016) est vendue à la
  signature, sort du rayon, et sa taille est figée sur la cure. La COMBI
  est le matériel du centre que la thérapeute enfile à la cliente à chaque
  séance : sa taille se constate, se note, et CHANGE au fil de la cure —
  c'est même le but. Elle vit donc sur la cliente, pas sur la cure, en
  texte libre : les combis n'ont pas un jeu de tailles fixé.

  Jonathan, 15 septembre 2026.
*/

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS taille_combi_ishape text;

COMMENT ON COLUMN clientes.taille_combi_ishape IS
  'Taille de la combi I-Shape du centre, notée par la thérapeute et modifiable à tout moment — elle change au fil de la cure. Texte libre.';

-- Contrôle : la colonne existe.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'clientes' AND column_name = 'taille_combi_ishape';
