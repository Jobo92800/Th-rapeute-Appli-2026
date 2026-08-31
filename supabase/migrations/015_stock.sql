/*
  MAbeautyplus V2 — Migration 015 : le stock, et les ventes qui le décomptent

  La V1 avait un écran de stock et un onglet « Compléments » sur la fiche
  cliente. Les deux s'ignoraient : on vendait une boîte de BURN à une cliente
  et le stock du centre ne bougeait pas. Le comptage devenait faux en
  quelques jours, et plus personne ne le regardait.

  Ici, une vente est un mouvement de stock. C'est le même geste, écrit une
  seule fois.

  L'autre différence avec la V1 : la quantité en rayon n'est stockée nulle
  part. Elle se calcule — entrées moins sorties — comme les séances
  restantes se calculent. Un chiffre qu'on recopie finit toujours par mentir.

  Contenu
    1. produits_stock   le catalogue, commun aux 5 centres
    2. seuils_stock     à partir de quand alerter, par produit et par centre
    3. mouvements_stock ce qui entre, ce qui sort — la seule vérité
    4. etat_stock       la vue qui donne la quantité en rayon
    5. le lien avec les ventes de compléments
    6. l'inventaire : recompter le rayon et recaler l'écart
*/

-- ---------------------------------------------------------------------------
-- 1. CATALOGUE
--    Commun aux 5 centres. « centres » restreint un produit à certains
--    centres (les cosmétiques du Grau-du-Roi) ; NULL = partout.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS produits_stock (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,
  nom             text NOT NULL,
  categorie       text NOT NULL CHECK (categorie IN ('complement', 'guide', 'tenue', 'cosmetique', 'autre')),
  unite           text NOT NULL DEFAULT 'boîte',
  centres         text[],
  jours_par_boite integer CHECK (jours_par_boite IS NULL OR jours_par_boite > 0),
  code_tarif      text,
  ordre           integer NOT NULL DEFAULT 0,
  actif           boolean NOT NULL DEFAULT true,
  cree_le         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN produits_stock.centres IS
  'Centres où le produit est tenu. NULL = les cinq.';
COMMENT ON COLUMN produits_stock.jours_par_boite IS
  'Durée d''une boîte, pour annoncer la fin de la cure. NULL = pas de calcul (le SOS se prend à la demande).';
COMMENT ON COLUMN produits_stock.code_tarif IS
  'Renvoie à la table tarifs. Aucun prix n''est écrit ici.';

INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('complement', '2026-01-01', 37.00, 'Boîte de compléments alimentaires')
ON CONFLICT (code, effet_le) DO NOTHING;

INSERT INTO produits_stock (code, nom, categorie, unite, jours_par_boite, code_tarif, ordre) VALUES
  ('BURN',     'BURN',     'complement', 'boîte', 15,   'complement',  1),
  ('SOS',      'S.O.S',    'complement', 'boîte', NULL, 'complement',  2),
  ('DETOX',    'DÉTOX',    'complement', 'boîte', 15,   'complement',  3),
  ('SKIN',     'SKIN',     'complement', 'boîte', 30,   'complement',  4),
  ('GUIDE',    'Guide alimentaire', 'guide', 'exemplaire', NULL, 'guide', 5),
  ('TENUE_S',  'Tenue I-Shape — S',  'tenue', 'pièce', NULL, 'tenue',  6),
  ('TENUE_M',  'Tenue I-Shape — M',  'tenue', 'pièce', NULL, 'tenue',  7),
  ('TENUE_L',  'Tenue I-Shape — L',  'tenue', 'pièce', NULL, 'tenue',  8),
  ('TENUE_XL', 'Tenue I-Shape — XL', 'tenue', 'pièce', NULL, 'tenue',  9)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. SEUILS D'ALERTE
--    Un seuil n'est pas une donnée calculable : chaque centre décide à
--    partir de quand il doit recommander. Absent = les valeurs par défaut.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS seuils_stock (
  produit_id      uuid NOT NULL REFERENCES produits_stock(id) ON DELETE CASCADE,
  centre_id       text NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  seuil_bas       integer NOT NULL DEFAULT 5  CHECK (seuil_bas >= 0),
  seuil_critique  integer NOT NULL DEFAULT 2  CHECK (seuil_critique >= 0),
  maj_le          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (produit_id, centre_id),
  CONSTRAINT seuils_coherents CHECK (seuil_critique <= seuil_bas)
);

-- ---------------------------------------------------------------------------
-- 3. MOUVEMENTS
--    Tout passe par là : une réception, une vente, une boîte offerte, une
--    perte, un pot utilisé en cabine, un recalage d'inventaire.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mouvements_stock (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id    uuid NOT NULL REFERENCES produits_stock(id) ON DELETE RESTRICT,
  centre_id     text NOT NULL REFERENCES centres(id),
  sens          text NOT NULL CHECK (sens IN ('entree', 'sortie')),
  quantite      integer NOT NULL CHECK (quantite > 0),
  motif         text NOT NULL CHECK (motif IN ('reception', 'vente', 'offert', 'perte', 'usage_centre', 'inventaire')),

  -- Rempli quand le mouvement vient d'une vente à une cliente. La vente
  -- supprimée emporte son mouvement : le stock revient tout seul.
  vente_id      uuid UNIQUE REFERENCES ventes_complements(id) ON DELETE CASCADE,

  therapeute_id uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),
  auteur        text NOT NULL DEFAULT '',
  note          text NOT NULL DEFAULT '',
  fait_le       timestamptz NOT NULL DEFAULT now(),
  cree_le       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mouvements_stock_rayon_idx
  ON mouvements_stock (centre_id, produit_id);
CREATE INDEX IF NOT EXISTS mouvements_stock_journal_idx
  ON mouvements_stock (centre_id, fait_le DESC);

-- ---------------------------------------------------------------------------
-- 4. L'ÉTAT DU RAYON
--    Une ligne par produit et par centre, même sans aucun mouvement : un
--    produit jamais reçu doit apparaître à zéro, pas disparaître.
--
--    security_invoker : la vue applique les droits de l'appelant, donc le
--    cloisonnement par centre des mouvements s'applique aussi ici.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW etat_stock WITH (security_invoker = true) AS
SELECT
  p.id                                        AS produit_id,
  p.code,
  p.nom,
  p.categorie,
  p.unite,
  p.ordre,
  p.jours_par_boite,
  c.id                                        AS centre_id,
  COALESCE(m.entrees, 0) - COALESCE(m.sorties, 0) AS quantite,
  COALESCE(s.seuil_bas, 5)                    AS seuil_bas,
  COALESCE(s.seuil_critique, 2)               AS seuil_critique,
  m.dernier_mouvement_le
FROM produits_stock p
JOIN centres c
  ON (p.centres IS NULL OR c.id = ANY (p.centres))
LEFT JOIN seuils_stock s
  ON s.produit_id = p.id AND s.centre_id = c.id
LEFT JOIN LATERAL (
  SELECT
    COALESCE(SUM(x.quantite) FILTER (WHERE x.sens = 'entree'), 0) AS entrees,
    COALESCE(SUM(x.quantite) FILTER (WHERE x.sens = 'sortie'), 0) AS sorties,
    MAX(x.fait_le)                                                AS dernier_mouvement_le
  FROM mouvements_stock x
  WHERE x.produit_id = p.id AND x.centre_id = c.id
) m ON true
WHERE p.actif AND c.actif;

COMMENT ON VIEW etat_stock IS
  'Quantité en rayon par produit et par centre. Calculée, jamais stockée.';

-- ---------------------------------------------------------------------------
-- 5. UNE VENTE EST UNE SORTIE DE STOCK
--    Le défaut de la V1 tenait en une ligne : personne ne faisait ce lien.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sortie_stock_depuis_vente()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_produit uuid;
BEGIN
  SELECT id INTO v_produit FROM produits_stock WHERE code = NEW.produit;

  IF v_produit IS NULL THEN
    RAISE EXCEPTION
      'Le produit « % » ne figure pas au catalogue du stock : la vente ne peut pas être décomptée.', NEW.produit;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO mouvements_stock (produit_id, centre_id, sens, quantite, motif, vente_id, therapeute_id, fait_le)
    VALUES (v_produit, NEW.centre_id, 'sortie', NEW.quantite, 'vente', NEW.id, NEW.therapeute_id, NEW.date_vente);
  ELSE
    UPDATE mouvements_stock
    SET produit_id = v_produit,
        centre_id  = NEW.centre_id,
        quantite   = NEW.quantite,
        fait_le    = NEW.date_vente
    WHERE vente_id = NEW.id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ventes_complements_vers_stock ON ventes_complements;
CREATE TRIGGER ventes_complements_vers_stock
  AFTER INSERT OR UPDATE OF produit, quantite, centre_id, date_vente
  ON ventes_complements
  FOR EACH ROW EXECUTE FUNCTION sortie_stock_depuis_vente();

-- Rattrapage : les ventes déjà enregistrées avant cette migration n'avaient
-- pas de mouvement. On le leur crée, sinon le rayon démarrerait faux.
INSERT INTO mouvements_stock (produit_id, centre_id, sens, quantite, motif, vente_id, therapeute_id, fait_le)
SELECT p.id, v.centre_id, 'sortie', v.quantite, 'vente', v.id, v.therapeute_id, v.date_vente
FROM ventes_complements v
JOIN produits_stock p ON p.code = v.produit
WHERE NOT EXISTS (SELECT 1 FROM mouvements_stock m WHERE m.vente_id = v.id);

-- ---------------------------------------------------------------------------
-- 6. INVENTAIRE
--    On recompte le rayon, on saisit ce qu'on a trouvé, et l'écart est
--    écrit comme un mouvement. Rien n'est réécrit : l'histoire reste.
--
--    SECURITY INVOKER : la fonction n'ouvre aucun droit, elle écrit avec
--    ceux de la personne connectée, donc le cloisonnement par centre tient.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION recaler_stock(
  p_produit  uuid,
  p_centre   text,
  p_compte   integer,
  p_note     text DEFAULT ''
)
RETURNS integer
LANGUAGE plpgsql VOLATILE SET search_path = public, pg_temp AS $$
DECLARE
  v_actuel integer;
  v_ecart  integer;
BEGIN
  IF p_compte < 0 THEN
    RAISE EXCEPTION 'Un comptage ne peut pas être négatif.';
  END IF;

  SELECT quantite INTO v_actuel
  FROM etat_stock WHERE produit_id = p_produit AND centre_id = p_centre;

  IF v_actuel IS NULL THEN
    RAISE EXCEPTION 'Ce produit n''est pas tenu dans ce centre.';
  END IF;

  v_ecart := p_compte - v_actuel;
  IF v_ecart = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO mouvements_stock (produit_id, centre_id, sens, quantite, motif, note)
  VALUES (p_produit, p_centre,
          CASE WHEN v_ecart > 0 THEN 'entree' ELSE 'sortie' END,
          abs(v_ecart), 'inventaire',
          COALESCE(NULLIF(p_note, ''), 'Comptage du rayon'));

  RETURN v_ecart;
END $$;

-- ---------------------------------------------------------------------------
-- 7. RLS : chaque centre voit son rayon, le catalogue est commun
-- ---------------------------------------------------------------------------

ALTER TABLE produits_stock   ENABLE ROW LEVEL SECURITY;
ALTER TABLE seuils_stock     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS produits_stock_lecture ON produits_stock;
CREATE POLICY produits_stock_lecture ON produits_stock FOR SELECT TO authenticated
  USING (true);

-- Le catalogue est commun aux cinq centres : le modifier engage tout le
-- monde, c'est donc un geste de direction.
DROP POLICY IF EXISTS produits_stock_ecriture ON produits_stock;
CREATE POLICY produits_stock_ecriture ON produits_stock FOR ALL TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

DROP POLICY IF EXISTS seuils_stock_acces ON seuils_stock;
CREATE POLICY seuils_stock_acces ON seuils_stock FOR ALL TO authenticated
  USING (acces_centre(centre_id)) WITH CHECK (acces_centre(centre_id));

-- Un mouvement n'est pas un champ que l'on rectifie : on annule par un
-- mouvement inverse, et le journal garde tout. Seuls les mouvements nés
-- d'une vente se laissent modifier, parce qu'ils suivent la vente.
DROP POLICY IF EXISTS mouvements_stock_acces        ON mouvements_stock;
DROP POLICY IF EXISTS mouvements_stock_lecture      ON mouvements_stock;
DROP POLICY IF EXISTS mouvements_stock_ecriture     ON mouvements_stock;
DROP POLICY IF EXISTS mouvements_stock_suivi_vente  ON mouvements_stock;
DROP POLICY IF EXISTS mouvements_stock_suppression  ON mouvements_stock;

CREATE POLICY mouvements_stock_lecture ON mouvements_stock FOR SELECT TO authenticated
  USING (acces_centre(centre_id));

CREATE POLICY mouvements_stock_ecriture ON mouvements_stock FOR INSERT TO authenticated
  WITH CHECK (acces_centre(centre_id));

CREATE POLICY mouvements_stock_suivi_vente ON mouvements_stock FOR UPDATE TO authenticated
  USING (acces_centre(centre_id) AND vente_id IS NOT NULL)
  WITH CHECK (acces_centre(centre_id) AND vente_id IS NOT NULL);

-- Effacer une ligne du journal reste un geste de direction. La vente
-- supprimée, elle, emporte son mouvement toute seule (ON DELETE CASCADE).
CREATE POLICY mouvements_stock_suppression ON mouvements_stock FOR DELETE TO authenticated
  USING (acces_centre(centre_id) AND est_direction());
