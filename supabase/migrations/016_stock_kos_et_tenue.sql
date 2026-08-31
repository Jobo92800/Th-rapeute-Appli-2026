/*
  MAbeautyplus V2 — Migration 016 : les cosmétiques du Grau-du-Roi,
  et la tenue qui sort du rayon à la signature

  Deux ajouts au stock mis en place par la 015.

  1. Les cosmétiques KOS, tenus au Grau-du-Roi seulement. Ils étaient au
     stock de la V1 et le centre les vend toujours.

  2. Le guide et la tenue partent du rayon quand le contrat est signé.
     C'est le moment où la cliente repart avec, donc le moment où le rayon
     doit bouger. La taille de la tenue est demandée dans la fenêtre de
     signature : sans elle, on ne saurait pas laquelle décompter.

  Les cures signées avant cette migration ne sont pas rattrapées : leur
  guide et leur tenue sont partis avant que le rayon soit tenu.
*/

-- ---------------------------------------------------------------------------
-- 1. LES COSMÉTIQUES DU GRAU-DU-ROI
-- ---------------------------------------------------------------------------

INSERT INTO produits_stock (code, nom, categorie, unite, centres, ordre) VALUES
  ('KOS_SERUM_LEVRES',  'Sérum lèvres',      'cosmetique', 'flacon', ARRAY['grau-du-roi'], 20),
  ('KOS_BEURRE_CORPS',  'Beurre corps',      'cosmetique', 'flacon', ARRAY['grau-du-roi'], 21),
  ('KOS_CONTOUR_YEUX',  'Contour yeux',      'cosmetique', 'flacon', ARRAY['grau-du-roi'], 22),
  ('KOS_CREME_VISAGE',  'Crème visage',      'cosmetique', 'flacon', ARRAY['grau-du-roi'], 23),
  ('KOS_GOMMAGE_CORPS', 'Gommage corps',     'cosmetique', 'tube',   ARRAY['grau-du-roi'], 24),
  ('KOS_HUILE_BEAUTE',  'Huile beauté',      'cosmetique', 'flacon', ARRAY['grau-du-roi'], 25),
  ('KOS_SERUM_VISAGE',  'Sérum visage KOS',  'cosmetique', 'flacon', ARRAY['grau-du-roi'], 26)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. LA TENUE ET SA TAILLE
--    « tenue » était jusqu'ici déduit d'un prix supérieur à zéro. On le dit
--    franchement, et on retient la taille remise à la cliente.
-- ---------------------------------------------------------------------------

ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS tenue        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS taille_tenue text
    CHECK (taille_tenue IS NULL OR taille_tenue IN ('S', 'M', 'L', 'XL'));

COMMENT ON COLUMN programmes.taille_tenue IS
  'Taille de la tenue I-Shape remise à la cliente. Demandée à la signature du contrat.';

-- Les cures déjà enregistrées : la tenue se lisait dans son prix.
UPDATE programmes SET tenue = true WHERE prix_tenue > 0 AND NOT tenue;

-- ---------------------------------------------------------------------------
-- 3. UN MOUVEMENT PEUT VENIR D'UNE CURE
--    C'est ce qui empêche de sortir deux tenues si le contrat est resigné.
-- ---------------------------------------------------------------------------

ALTER TABLE mouvements_stock
  ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES programmes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mouvements_stock_programme_idx
  ON mouvements_stock (programme_id) WHERE programme_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. LA SIGNATURE FAIT SORTIR LE GUIDE ET LA TENUE
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sortie_stock_depuis_contrat()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  c programmes%ROWTYPE;
  v_produit uuid;
BEGIN
  IF NEW.programme_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO c FROM programmes WHERE id = NEW.programme_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Le guide, remis avec la cure quand il est facturé.
  IF c.guide THEN
    SELECT id INTO v_produit FROM produits_stock WHERE code = 'GUIDE';

    IF v_produit IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM mouvements_stock m
      WHERE m.programme_id = c.id AND m.produit_id = v_produit
    ) THEN
      INSERT INTO mouvements_stock
        (produit_id, centre_id, sens, quantite, motif, programme_id, therapeute_id, note)
      VALUES
        (v_produit, NEW.centre_id, 'sortie', 1, 'vente', c.id, NEW.therapeute_id,
         'Remis à la signature du contrat');
    END IF;
  END IF;

  -- La tenue, dans la taille choisie avec la cliente. Une seule par cure,
  -- même si le contrat est signé deux fois.
  IF c.tenue AND c.taille_tenue IS NOT NULL THEN
    SELECT id INTO v_produit FROM produits_stock WHERE code = 'TENUE_' || c.taille_tenue;

    IF v_produit IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM mouvements_stock m
      JOIN produits_stock p ON p.id = m.produit_id
      WHERE m.programme_id = c.id AND p.categorie = 'tenue'
    ) THEN
      INSERT INTO mouvements_stock
        (produit_id, centre_id, sens, quantite, motif, programme_id, therapeute_id, note)
      VALUES
        (v_produit, NEW.centre_id, 'sortie', 1, 'vente', c.id, NEW.therapeute_id,
         'Tenue ' || c.taille_tenue || ' remise à la signature');
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contrats_vers_stock ON contrats;
CREATE TRIGGER contrats_vers_stock
  AFTER INSERT ON contrats
  FOR EACH ROW EXECUTE FUNCTION sortie_stock_depuis_contrat();
