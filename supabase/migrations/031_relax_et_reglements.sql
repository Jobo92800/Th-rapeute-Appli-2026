/*
  MAbeautyplus V2 — Migration 031 : la Relaxation, et les règlements réels

  Deux choses que la base refusait encore d'enregistrer.

  1. La **Luxothérapie Relaxation**. Le nouveau bilan la recommande quand le
     stress et le sommeil ressortent. C'est une quatrième prestation, à
     côté de la Luxo perte de poids, de l'I-Shape et de la Pressodynamie.

  2. Les **modes de règlement tels qu'ils se pratiquent** au comptoir :
     au centre par chèque, en une à quatre fois sans frais ; ou chez Alma
     par carte, en 2, 3, 4, 10 ou 12 fois, avec des frais à la charge de la
     cliente. Jusqu'ici la base ne connaissait que « 4 fois maison » et
     « 10 fois Alma » — deux cases pour neuf situations.

  Les anciennes valeurs restent acceptées : les cures déjà signées ne se
  réécrivent pas.
*/

-- ---------------------------------------------------------------------------
-- 1. La Relaxation entre au catalogue des soins
-- ---------------------------------------------------------------------------

ALTER TABLE programme_lignes DROP CONSTRAINT IF EXISTS programme_lignes_technologie_check;
ALTER TABLE programme_lignes ADD CONSTRAINT programme_lignes_technologie_check
  CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome', 'relax'));

ALTER TABLE seances DROP CONSTRAINT IF EXISTS seances_technologie_check;
ALTER TABLE seances ADD CONSTRAINT seances_technologie_check
  CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome', 'relax'));

INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('relax', '2026-01-01', 59.00, 'Séance de Luxothérapie Relaxation')
ON CONFLICT (code, effet_le) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Les modes de règlement, tels qu'on les propose vraiment
--
--    « comptant » reste le règlement en une fois. Les valeurs « 4x_maison »
--    et « 10x_alma » sont conservées pour l'historique, mais les nouvelles
--    cures utilisent les formes explicites : on sait alors combien de fois,
--    et si les frais Alma s'appliquent.
-- ---------------------------------------------------------------------------

ALTER TABLE programmes DROP CONSTRAINT IF EXISTS programmes_mode_reglement_check;
ALTER TABLE programmes ADD CONSTRAINT programmes_mode_reglement_check
  CHECK (mode_reglement IN (
    'comptant',
    'centre_2x', 'centre_3x', 'centre_4x',
    'alma_2x', 'alma_3x', 'alma_4x', 'alma_10x', 'alma_12x',
    '4x_maison', '10x_alma',
    'inconnu'
  ));

COMMENT ON COLUMN programmes.mode_reglement IS
  'centre_Nx : chèques au centre, sans frais. alma_Nx : carte, frais Alma à la charge de la cliente, portés par frais_financement. 4x_maison et 10x_alma sont les anciennes valeurs, gardées pour l''historique.';
