/*
  MAbeautyplus V2 — Migration 067 : le Dôme passe à 49 €

  Jonathan, 16 septembre 2026. Le Dôme était revenu à 59 € (059) ; il se
  vend désormais 49 € la séance. Daté, comme tous les tarifs : les cures
  déjà signées gardent leur prix, une cure signée à partir d'aujourd'hui
  copie 49 € sur sa ligne.
*/

INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('dome', '2026-09-16', 49.00, 'Séance de Dôme — ajouté à la main, au Grau-du-Roi')
ON CONFLICT (code, effet_le) DO NOTHING;

-- Contrôle : le tarif en vigueur du Dôme doit être 49.
SELECT code, montant, effet_le FROM tarifs WHERE code = 'dome' ORDER BY effet_le DESC LIMIT 1;
