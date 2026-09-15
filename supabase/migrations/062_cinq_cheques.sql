/*
  MAbeautyplus V2 — Migration 062 : cinq chèques au centre

  Jonathan, 15 septembre 2026 : une cure d'au moins vingt luxo peut se
  régler en cinq fois au centre. C'est la cure la plus longue — cinq mois —
  et la plus chère ; en dessous, quatre chèques au plus, comme avant. La
  règle des vingt luxo est tenue par l'application (`echeancesCentrePossibles`,
  `Changer le nombre d'échéances`) ; la base, elle, doit seulement admettre
  le mode `centre_5x`.

  La liste reprend la 031, avec une valeur de plus.
*/

ALTER TABLE programmes DROP CONSTRAINT IF EXISTS programmes_mode_reglement_check;
ALTER TABLE programmes ADD CONSTRAINT programmes_mode_reglement_check
  CHECK (mode_reglement IN (
    'comptant',
    'centre_2x', 'centre_3x', 'centre_4x', 'centre_5x',
    'alma_2x', 'alma_3x', 'alma_4x', 'alma_10x', 'alma_12x',
    '4x_maison', '10x_alma',
    'inconnu'
  ));

-- Contrôle : la contrainte connaît le 5×.
SELECT conname, pg_get_constraintdef(oid) LIKE '%centre_5x%' AS admet_le_5x
FROM pg_constraint
WHERE conname = 'programmes_mode_reglement_check';
