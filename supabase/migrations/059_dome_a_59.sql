/*
  MAbeautyplus V2 — Migration 059 : le Dôme revient, à 59 €, au Grau-du-Roi

  Le Dôme avait été retiré des écrans : le nouveau bilan ne le prescrit pas.
  Il revient comme soin **ajouté à la main** — sous « Modifier », sur le
  devis — au Grau-du-Roi seulement, le seul centre qui le tient. Aucun bilan
  ne le proposera jamais ; c'est l'écran qui le propose, et seulement là.

  Son tarif était resté à 39 € (la V1). Jonathan tranche le 13 septembre
  2026 : 59 € la séance, comme les autres soins de la méthode. Daté, comme
  tous les tarifs : les cures déjà signées gardent leur prix.
*/

INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('dome', '2026-09-13', 59.00, 'Séance de Dôme — ajouté à la main, au Grau-du-Roi')
ON CONFLICT (code, effet_le) DO NOTHING;

-- Contrôle : le tarif en vigueur du Dôme.
SELECT code, montant, effet_le FROM tarifs WHERE code = 'dome' ORDER BY effet_le DESC LIMIT 1;
