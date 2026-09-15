/*
  MAbeautyplus V2 — Migration 064 : le programme utilisé sur l'appareil

  Sur l'I-Shape et la Pressodynamie, la thérapeute choisit un programme sur
  la machine, et la suivante doit savoir lequel pour reprendre où l'autre
  s'est arrêtée. Il se notait dans le commentaire, mêlé au ressenti de la
  cliente ; Jonathan (15 septembre 2026) demande deux cases : le
  commentaire / ressenti, et le programme utilisé. Texte libre — chaque
  appareil a ses propres noms de programmes.
*/

ALTER TABLE seances
  ADD COLUMN IF NOT EXISTS programme_utilise text;

COMMENT ON COLUMN seances.programme_utilise IS
  'Programme choisi sur l''appareil (I-Shape, Pressodynamie). Texte libre, à part du commentaire.';

-- Contrôle : la colonne existe.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'seances' AND column_name = 'programme_utilise';
