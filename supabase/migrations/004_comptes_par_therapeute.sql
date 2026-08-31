/*
  MAbeautyplus V2 — Migration 004 : un compte de connexion par thérapeute

  Remplace le modèle « un compte par centre » par « un compte par personne ».
  Chaque thérapeute se connecte avec sa propre adresse : on sait donc qui a
  créé chaque fiche, réalisé chaque séance et encaissé chaque règlement.

  La table `therapeutes` devient la table des personnes. `comptes_centre`
  disparaît, son rôle est repris par les colonnes ajoutées ici.

  Une thérapeute peut exister sans compte de connexion (colonne user_id
  vide) : elle reste sélectionnable sur les fiches, elle ne peut simplement
  pas se connecter.
*/

-- ---------------------------------------------------------------------------
-- 1. La table des thérapeutes devient la table des comptes
-- ---------------------------------------------------------------------------

ALTER TABLE therapeutes
  ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nom     text,
  ADD COLUMN IF NOT EXISTS email   text UNIQUE,
  ADD COLUMN IF NOT EXISTS role    text NOT NULL DEFAULT 'therapeute'
                                   CHECK (role IN ('therapeute', 'direction'));

COMMENT ON COLUMN therapeutes.user_id IS
  'Compte Supabase Auth. Vide = la personne est sélectionnable mais ne se connecte pas.';
COMMENT ON COLUMN therapeutes.email IS
  'Adresse de connexion. C''est elle qui relie la personne à son compte Auth.';

-- La direction n'est rattachée à aucun centre : elle les voit tous.
ALTER TABLE therapeutes ALTER COLUMN centre_id DROP NOT NULL;

ALTER TABLE therapeutes DROP CONSTRAINT IF EXISTS therapeutes_centre_requis;
ALTER TABLE therapeutes ADD CONSTRAINT therapeutes_centre_requis
  CHECK (role = 'direction' OR centre_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS therapeutes_user_idx ON therapeutes (user_id);

-- ---------------------------------------------------------------------------
-- 2. Adresses de connexion proposées
--    Modifiables : c'est cette colonne qui sert au rattachement, pas le prénom.
--    Les trois Alexandra sont distinguées par leur centre.
-- ---------------------------------------------------------------------------

UPDATE therapeutes SET email = v.email
FROM (VALUES
  ('grau-du-roi', 'Marie',       'marie@mabeautyplus.fr'),
  ('grau-du-roi', 'Fanny',       'fanny@mabeautyplus.fr'),
  ('grau-du-roi', 'Nadia',       'nadia@mabeautyplus.fr'),
  ('grau-du-roi', 'Stéphanie',   'stephanie@mabeautyplus.fr'),
  ('le-cres',     'Alexandra',   'alexandra.lecres@mabeautyplus.fr'),
  ('le-cres',     'Paola',       'paola@mabeautyplus.fr'),
  ('le-cres',     'Malvina',     'malvina@mabeautyplus.fr'),
  ('le-cres',     'Flora',       'flora@mabeautyplus.fr'),
  ('serignan',    'Caroll',      'caroll@mabeautyplus.fr'),
  ('serignan',    'Aude',        'aude@mabeautyplus.fr'),
  ('serignan',    'Marie-san',   'marie-san@mabeautyplus.fr'),
  ('cabestany',   'Audrey',      'audrey@mabeautyplus.fr'),
  ('cabestany',   'Sara',        'sara@mabeautyplus.fr'),
  ('cabestany',   'Alexandra C', 'alexandra.cabestany@mabeautyplus.fr'),
  ('cabestany',   'Marine',      'marine@mabeautyplus.fr'),
  ('avignon',     'Alexandra 2', 'alexandra.avignon@mabeautyplus.fr'),
  ('avignon',     'Laura',       'laura@mabeautyplus.fr')
) AS v(centre_id, prenom, email)
WHERE therapeutes.centre_id = v.centre_id
  AND therapeutes.prenom = v.prenom
  AND therapeutes.email IS DISTINCT FROM v.email;

-- Compte direction : accès à tous les centres.
INSERT INTO therapeutes (centre_id, prenom, email, role, ordre)
VALUES (NULL, 'Direction', 'direction@mabeautyplus.fr', 'direction', 0)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Les fonctions d'accès lisent désormais therapeutes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION centre_courant()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT centre_id FROM therapeutes WHERE user_id = auth.uid() AND actif $$;

CREATE OR REPLACE FUNCTION est_direction()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT role = 'direction' FROM therapeutes WHERE user_id = auth.uid() AND actif),
    false)
$$;

-- Identifiant de la thérapeute connectée, pour tracer qui fait quoi.
CREATE OR REPLACE FUNCTION therapeute_courante()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT id FROM therapeutes WHERE user_id = auth.uid() AND actif $$;

-- ---------------------------------------------------------------------------
-- 4. Ancienne table de comptes
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS comptes_centre;

-- ---------------------------------------------------------------------------
-- 5. Lecture des thérapeutes : son centre, ou tous pour la direction
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS therapeutes_lecture ON therapeutes;
CREATE POLICY therapeutes_lecture ON therapeutes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR est_direction() OR centre_id = centre_courant());

-- ---------------------------------------------------------------------------
-- 6. Traçabilité sur les fiches clientes
-- ---------------------------------------------------------------------------

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS creee_par_therapeute uuid REFERENCES therapeutes(id);

ALTER TABLE clientes
  ALTER COLUMN creee_par_therapeute SET DEFAULT therapeute_courante();

COMMENT ON COLUMN clientes.creee_par_therapeute IS
  'Qui a créé la fiche. Rempli automatiquement à partir du compte connecté.';
