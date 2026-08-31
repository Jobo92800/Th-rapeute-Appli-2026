/*
  MAbeautyplus V2 — Migration 001 : référentiel et contrôle d'accès

  À exécuter dans l'éditeur SQL du projet Supabase EXISTANT.
  Cette migration est purement additive : elle ne touche à aucune table
  utilisée par l'application actuelle (stock_*, signed_contracts,
  client_empreinte_bilans restent intacts).

  Contenu
    1. Table centres            — les 5 centres, reprise de la config V1
    2. Table comptes_centre     — relie un compte Supabase Auth à un centre
    3. Fonctions d'accès        — centre du compte connecté, rôle direction
    4. Table therapeutes        — les prénoms proposés à la sélection
    5. Table tarifs             — les prix, datés, jamais en dur dans le code
    6. Table jeux               — la bibliothèque des 60 jeux
*/

-- ---------------------------------------------------------------------------
-- 1. CENTRES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS centres (
  id                    text PRIMARY KEY,
  nom                   text NOT NULL,
  societe               text NOT NULL,
  siren                 text NOT NULL,
  adresse               text NOT NULL,
  code_postal           text NOT NULL,
  ville                 text NOT NULL,
  telephone             text NOT NULL,
  email                 text NOT NULL,
  siege_adresse         text NOT NULL,
  siege_code_postal     text NOT NULL,
  siege_ville           text NOT NULL,
  nom_airtable          text NOT NULL,
  actif                 boolean NOT NULL DEFAULT true,
  cree_le               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN centres.nom_airtable IS
  'Valeur exacte du champ Centre dans la table Airtable Clients.';

INSERT INTO centres (id, nom, societe, siren, adresse, code_postal, ville, telephone, email,
                     siege_adresse, siege_code_postal, siege_ville, nom_airtable) VALUES
  ('grau-du-roi', 'Le Grau-du-Roi', 'MB1PRO', '853 874 428 00016', '577 Rue des Tamaris',    '30240', 'Le Grau-du-Roi', '04 66 73 02 00', 'contact@mabeautyplus.fr', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Le Grau-du-Roi'),
  ('le-cres',     'Le Crès',        'MB2PRO', '982 876 047 00019', '1 Avenue des Chasseurs',  '34920', 'Le Crès',        '04 66 73 02 00', 'contact@mabeautyplus.fr', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Le Crès'),
  ('serignan',    'Sérignan',       'MB3PRO', '928 646 322 00018', '120 Avenue de la Plage',  '34410', 'Sérignan',       '04 66 73 02 00', 'contact@mabeautyplus.fr', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Sérignan'),
  ('cabestany',   'Cabestany',      'MB4PRO', '938 742 541 00015', '4 Rue Ambroise Croizat',  '66330', 'Cabestany',      '04 66 73 02 00', 'contact@mabeautyplus.fr', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Cabestany'),
  ('avignon',     'Avignon',        'MB5PRO', '102 009 677 00018', '8 Bd de la Fraternité',   '84140', 'Avignon',        '04 66 73 02 00', 'contact@mabeautyplus.fr', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Avignon')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. COMPTES DE CENTRE
--    Un compte Supabase Auth par centre. Le rôle "direction" voit tous les centres.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS comptes_centre (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  centre_id   text REFERENCES centres(id),
  role        text NOT NULL DEFAULT 'centre' CHECK (role IN ('centre', 'direction')),
  cree_le     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT centre_requis_sauf_direction
    CHECK (role = 'direction' OR centre_id IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- 3. FONCTIONS D'ACCÈS
--    STABLE + SECURITY DEFINER : lisibles depuis les policies sans récursion.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION centre_courant()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT centre_id FROM comptes_centre WHERE user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION est_direction()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT COALESCE((SELECT role = 'direction' FROM comptes_centre WHERE user_id = auth.uid()), false) $$;

-- Vrai si le compte connecté a le droit d'agir sur ce centre.
CREATE OR REPLACE FUNCTION acces_centre(cible text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT est_direction() OR cible = centre_courant() $$;

-- ---------------------------------------------------------------------------
-- 4. THÉRAPEUTES
--    Simple référentiel de prénoms : la connexion se fait par centre, la
--    thérapeute est sélectionnée à la main sur la fiche (choix retenu en V2).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS therapeutes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id   text NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  prenom      text NOT NULL,
  actif       boolean NOT NULL DEFAULT true,
  ordre       integer NOT NULL DEFAULT 0,
  cree_le     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centre_id, prenom)
);

CREATE INDEX IF NOT EXISTS therapeutes_centre_idx ON therapeutes (centre_id) WHERE actif;

INSERT INTO therapeutes (centre_id, prenom, ordre) VALUES
  ('grau-du-roi', 'Marie', 1), ('grau-du-roi', 'Fanny', 2), ('grau-du-roi', 'Nadia', 3), ('grau-du-roi', 'Stéphanie', 4),
  ('le-cres', 'Alexandra', 1), ('le-cres', 'Paola', 2), ('le-cres', 'Malvina', 3), ('le-cres', 'Flora', 4),
  ('serignan', 'Caroll', 1), ('serignan', 'Aude', 2), ('serignan', 'Marie-san', 3),
  ('cabestany', 'Audrey', 1), ('cabestany', 'Sara', 2), ('cabestany', 'Alexandra C', 3), ('cabestany', 'Marine', 4),
  ('avignon', 'Alexandra 2', 1), ('avignon', 'Laura', 2)
ON CONFLICT (centre_id, prenom) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. TARIFS
--    Chaque prix a une date d'effet. Un programme copie le prix en vigueur
--    au moment de sa validation : les cures passées ne bougent jamais.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tarifs (
  code            text NOT NULL,
  effet_le        date NOT NULL DEFAULT CURRENT_DATE,
  montant         numeric(10,2) NOT NULL CHECK (montant >= 0),
  libelle         text NOT NULL,
  PRIMARY KEY (code, effet_le)
);

INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('seance',  '2026-01-01',  59.00, 'Séance de 30 minutes intégrée à l''accompagnement'),
  ('guide',   '2026-01-01',  29.00, 'Guide de rééquilibrage alimentaire — systématique'),
  ('tenue',   '2026-01-01',  60.00, 'Tenue I-Shape — si électrostimulation'),
  ('bilan',   '2026-01-01',  87.00, 'Bilan Empreinte seul — offert si démarrage'),
  ('dome',    '2026-01-01',  39.00, 'Séance de Dôme (à confirmer : 39 € ou 59 €)')
ON CONFLICT (code, effet_le) DO NOTHING;

-- Prix en vigueur pour un code donné, à une date donnée.
CREATE OR REPLACE FUNCTION tarif_en_vigueur(p_code text, p_date date DEFAULT CURRENT_DATE)
RETURNS numeric
LANGUAGE sql STABLE
AS $$
  SELECT montant FROM tarifs
  WHERE code = p_code AND effet_le <= p_date
  ORDER BY effet_le DESC LIMIT 1
$$;

-- ---------------------------------------------------------------------------
-- 6. JEUX
--    Bibliothèque des 60 jeux. Le contenu est chargé par la migration 003.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS jeux (
  code              text PRIMARY KEY,
  phase             text NOT NULL CHECK (phase IN ('A', 'B', 'C')),
  etape             integer NOT NULL,
  theme             text NOT NULL,
  titre             text NOT NULL,
  materiel          text NOT NULL,
  objectif          text NOT NULL,
  regles            jsonb NOT NULL DEFAULT '[]'::jsonb,
  phrase_lancement  text NOT NULL DEFAULT '',
  mission           text NOT NULL DEFAULT '',
  duree             text NOT NULL DEFAULT '',
  options           jsonb NOT NULL DEFAULT '[]'::jsonb,
  a_enregistrer     text NOT NULL DEFAULT '',
  action_cliente    text NOT NULL DEFAULT '',
  prise_conscience  text NOT NULL DEFAULT '',
  resultat          text NOT NULL DEFAULT '',
  petit_pas         text NOT NULL DEFAULT '',
  nature            text NOT NULL DEFAULT 'action' CHECK (nature IN ('pedagogique', 'action')),
  prioritaire       boolean NOT NULL DEFAULT false,
  ordre             integer NOT NULL DEFAULT 0
);

COMMENT ON COLUMN jeux.nature IS
  'Sert à alterner pédagogique / action quand la cliente vient deux fois dans la semaine.';
COMMENT ON COLUMN jeux.prioritaire IS
  'Jeux conservés en priorité sur les programmes courts.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE centres        ENABLE ROW LEVEL SECURITY;
ALTER TABLE comptes_centre ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapeutes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jeux           ENABLE ROW LEVEL SECURITY;

-- Référentiels : lecture pour tout compte connecté, écriture réservée à la direction.
DROP POLICY IF EXISTS centres_lecture ON centres;
CREATE POLICY centres_lecture ON centres FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS therapeutes_lecture ON therapeutes;
CREATE POLICY therapeutes_lecture ON therapeutes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS therapeutes_ecriture ON therapeutes;
CREATE POLICY therapeutes_ecriture ON therapeutes FOR ALL TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

DROP POLICY IF EXISTS tarifs_lecture ON tarifs;
CREATE POLICY tarifs_lecture ON tarifs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tarifs_ecriture ON tarifs;
CREATE POLICY tarifs_ecriture ON tarifs FOR ALL TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

DROP POLICY IF EXISTS jeux_lecture ON jeux;
CREATE POLICY jeux_lecture ON jeux FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS jeux_ecriture ON jeux;
CREATE POLICY jeux_ecriture ON jeux FOR ALL TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

-- Un compte ne lit que sa propre ligne de rattachement.
DROP POLICY IF EXISTS comptes_centre_soi ON comptes_centre;
CREATE POLICY comptes_centre_soi ON comptes_centre FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR est_direction());
