/*
  MAbeautyplus V2 — Migration 070 : la Mission Déclic, sur la luxothérapie
  perte de poids seulement

  Jonathan (21 septembre 2026) : la Mission Déclic n'accompagne que la
  Luxothérapie perte de poids. L'I-Shape, la presso, la relaxation, le
  Dôme se clôturent sur leurs relevés et leur commentaire, comme
  l'Advance Lift depuis la 056. La base l'admettait pour l'Advance Lift et
  pour les séances reprises de l'ancienne application ; elle l'admet
  désormais pour tout ce qui n'est pas de la luxo perte de poids.

  Ce qu'elle continue d'exiger : une séance de luxo ne se clôture pas sans
  sa mission validée.

  Rejouable sans risque.
*/

ALTER TABLE seances DROP CONSTRAINT IF EXISTS cloture_exige_le_jeu;
ALTER TABLE seances ADD CONSTRAINT cloture_exige_le_jeu
  CHECK (NOT cloturee OR jeu_valide OR technologie <> 'luxo' OR origine = 'import_v1');

COMMENT ON CONSTRAINT cloture_exige_le_jeu ON seances IS
  'Une séance de luxothérapie perte de poids ne se clôture pas sans sa Mission Déclic validée. Les autres soins et les séances reprises en sont dispensés.';

-- Contrôle : la contrainte ne vise plus que la luxo.
SELECT pg_get_constraintdef(oid) AS contrainte,
       pg_get_constraintdef(oid) LIKE '%<> ''luxo''%' AS luxo_seulement
FROM pg_constraint WHERE conname = 'cloture_exige_le_jeu';
