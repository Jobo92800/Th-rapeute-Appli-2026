/*
  MAbeautyplus V2 — Migration 084 : la liste de courses d'un centre

  CE QU'ON AJOUTE.

  Ce qui fait tourner un centre — papier, produit d'entretien, mouchoirs,
  thé — n'était nulle part. `produits_stock` porte ce qu'on vend ou ce
  qu'on donne à une cliente ; ceci porte ce qu'on achète pour le centre.

  LE GESTE. Une thérapeute coche ce qui manque, pendant la semaine. Toutes
  les thérapeutes du centre cochent la même liste : c'est une liste de
  centre, pas une liste de personne.

  LA CLÔTURE NE SE SAISIT PAS. Une liste appartient à une semaine, repérée
  par son lundi. La semaine passée, la liste est close — aucun travail de
  fond, aucune tâche à planifier, rien à rattraper si personne ne clique le
  dimanche soir. C'est la règle de la maison : aucun état dérivable n'est
  stocké.

  LA VALIDATION RESTE À LA DIRECTION. Une liste validée est une liste qu'on
  achète ; personne d'autre ne peut la valider, et la base le vérifie.

  LES PLUS DEMANDÉS REMONTENT. Le catalogue est trié par ce que le centre a
  réellement demandé ces six derniers mois : au bout de quelques semaines,
  la liste se range toute seule dans l'ordre des habitudes du centre.
*/

-- ===========================================================================
-- 1. LE CATALOGUE
--    `centres` à NULL = dans tous les centres, comme pour produits_stock.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS fournitures (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         text NOT NULL,
  categorie   text NOT NULL DEFAULT 'autre'
                CHECK (categorie IN ('hygiene', 'entretien', 'accueil', 'bureau', 'autre')),
  unite       text NOT NULL DEFAULT 'unité',
  centres     text[],
  lien_amazon text,
  ordre       integer NOT NULL DEFAULT 100,
  actif       boolean NOT NULL DEFAULT true,
  cree_le     timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 2. LA LISTE DE LA SEMAINE, UNE PAR CENTRE
-- ===========================================================================

CREATE TABLE IF NOT EXISTS listes_de_courses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id    text NOT NULL REFERENCES centres(id),
  /* Le lundi de la semaine. C'est lui qui dit si la liste est encore ouverte. */
  semaine      date NOT NULL,
  validee_le   timestamptz,
  validee_par  uuid REFERENCES therapeutes(id),
  commandee_le timestamptz,
  note         text,
  cree_le      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centre_id, semaine)
);

-- ===========================================================================
-- 3. CE QUI EST COCHÉ
--    Une ligne est soit un produit du catalogue, soit un texte libre.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS lignes_de_courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liste_id      uuid NOT NULL REFERENCES listes_de_courses(id) ON DELETE CASCADE,
  /* RESTRICT : une fourniture déjà demandée ne se supprime pas, elle se
     désactive — sinon l'historique des listes perdrait son nom. */
  fourniture_id uuid REFERENCES fournitures(id) ON DELETE RESTRICT,
  libelle       text,
  quantite      integer NOT NULL DEFAULT 1 CHECK (quantite > 0),
  demandee_par  uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),
  cree_le       timestamptz NOT NULL DEFAULT now(),
  CHECK ((fourniture_id IS NOT NULL) <> (libelle IS NOT NULL))
);

/* Cocher deux fois le même produit augmente la quantité, ça ne crée pas
   une deuxième ligne. */
CREATE UNIQUE INDEX IF NOT EXISTS lignes_de_courses_une_par_fourniture
  ON lignes_de_courses (liste_id, fourniture_id)
  WHERE fourniture_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS lignes_de_courses_liste_idx ON lignes_de_courses (liste_id);
CREATE INDEX IF NOT EXISTS listes_de_courses_centre_idx ON listes_de_courses (centre_id, semaine DESC);

-- ===========================================================================
-- 4. LES DROITS
--    Le catalogue se lit par tout le monde, ne s'écrit que par la direction.
--    Les listes et leurs lignes suivent le cloisonnement par centre.
-- ===========================================================================

ALTER TABLE fournitures        ENABLE ROW LEVEL SECURITY;
ALTER TABLE listes_de_courses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_de_courses  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fournitures_lecture ON fournitures;
CREATE POLICY fournitures_lecture ON fournitures FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fournitures_ecriture ON fournitures;
CREATE POLICY fournitures_ecriture ON fournitures FOR ALL TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

DROP POLICY IF EXISTS listes_de_courses_acces ON listes_de_courses;
CREATE POLICY listes_de_courses_acces ON listes_de_courses FOR ALL TO authenticated
  USING (acces_centre(centre_id)) WITH CHECK (acces_centre(centre_id));

DROP POLICY IF EXISTS lignes_de_courses_acces ON lignes_de_courses;
CREATE POLICY lignes_de_courses_acces ON lignes_de_courses FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM listes_de_courses l
    WHERE l.id = lignes_de_courses.liste_id AND acces_centre(l.centre_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM listes_de_courses l
    WHERE l.id = lignes_de_courses.liste_id AND acces_centre(l.centre_id)
  ));

-- ===========================================================================
-- 5. LES BASES DU CATALOGUE
--    De quoi démarrer sans écran de saisie vide. Le reste viendra de ce que
--    les thérapeutes tapent dans « Autre ».
-- ===========================================================================

INSERT INTO fournitures (nom, categorie, unite, ordre)
SELECT * FROM (VALUES
  ('Papier toilette',              'hygiene',   'paquet', 10),
  ('Essuie-tout',                  'hygiene',   'paquet', 11),
  ('Mouchoirs',                    'hygiene',   'boîte',  12),
  ('Savon pour les mains',         'hygiene',   'flacon', 13),
  ('Gel hydroalcoolique',          'hygiene',   'flacon', 14),
  ('Produit ménage sol',           'entretien', 'bidon',  20),
  ('Produit d''entretien surfaces','entretien', 'flacon', 21),
  ('Produit vitres',               'entretien', 'flacon', 22),
  ('Lingettes désinfectantes',     'entretien', 'paquet', 23),
  ('Sacs poubelle',                'entretien', 'rouleau',24),
  ('Éponges',                      'entretien', 'paquet', 25),
  ('Thé',                          'accueil',   'boîte',  30),
  ('Café',                         'accueil',   'paquet', 31),
  ('Sucre',                        'accueil',   'paquet', 32),
  ('Gobelets',                     'accueil',   'paquet', 33),
  ('Bouteilles d''eau',            'accueil',   'pack',   34),
  ('Papier imprimante',            'bureau',    'ramette',40),
  ('Stylos',                       'bureau',    'boîte',  41),
  ('Piles',                        'bureau',    'paquet', 42)
) AS v(nom, categorie, unite, ordre)
WHERE NOT EXISTS (SELECT 1 FROM fournitures);

/*
  POURQUOI « IS NOT TRUE » ET PAS « NOT ».

  `acces_centre` vaut `est_direction() OR cible = centre_courant()`. Pour un
  compte connecté mais rattaché à aucune thérapeute, `centre_courant()` est
  NULL : la comparaison rend NULL, et `false OR NULL` rend NULL. Or
  `IF NOT NULL` n'est pas vrai — la garde se laissait traverser sans un mot.

  Les politiques RLS, elles, n'ont pas ce défaut : une politique n'ouvre que
  sur un vrai `true`. Mais ces fonctions sont SECURITY DEFINER, donc elles
  passent au-dessus des politiques : la garde écrite ici est la seule qu'il
  y ait. Elle doit donc exiger un vrai `true`.
*/

-- ===========================================================================
-- 6. CE QUE L'ÉCRAN LIT
--    Le catalogue du centre, chaque produit portant déjà sa quantité cochée
--    et le nombre de fois qu'il a été demandé ces six derniers mois.
-- ===========================================================================

CREATE OR REPLACE FUNCTION liste_de_courses(p_centre_id text, p_semaine date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_semaine date := COALESCE(p_semaine, date_trunc('week', CURRENT_DATE)::date);
  v_liste   listes_de_courses;
  resultat  jsonb;
BEGIN
  IF acces_centre(p_centre_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Cette liste n''est pas celle de votre centre.';
  END IF;

  SELECT * INTO v_liste FROM listes_de_courses
   WHERE centre_id = p_centre_id AND semaine = v_semaine;

  SELECT jsonb_build_object(
    'centre_id', p_centre_id,
    'semaine',   v_semaine,
    'ouverte',   v_semaine = date_trunc('week', CURRENT_DATE)::date AND v_liste.validee_le IS NULL,
    'validee_le',   v_liste.validee_le,
    'commandee_le', v_liste.commandee_le,
    'validee_par', (SELECT t.prenom FROM therapeutes t WHERE t.id = v_liste.validee_par),

    'catalogue', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',          f.id,
        'nom',         f.nom,
        'categorie',   f.categorie,
        'unite',       f.unite,
        'lien_amazon', f.lien_amazon,
        'quantite',    COALESCE(li.quantite, 0),
        'demandee_par', (SELECT t.prenom FROM therapeutes t WHERE t.id = li.demandee_par),
        /* Ce que ce centre demande le plus souvent, sur six mois. */
        'habitude', (
          SELECT count(*) FROM lignes_de_courses x
          JOIN listes_de_courses l2 ON l2.id = x.liste_id
          WHERE x.fourniture_id = f.id
            AND l2.centre_id = p_centre_id
            AND l2.semaine >= CURRENT_DATE - INTERVAL '6 months'
        )
      ) ORDER BY f.categorie, f.ordre, f.nom)
      FROM fournitures f
      LEFT JOIN lignes_de_courses li
        ON li.fourniture_id = f.id AND li.liste_id = v_liste.id
      WHERE f.actif
        AND (f.centres IS NULL OR p_centre_id = ANY (f.centres))
    ), '[]'::jsonb),

    /* Ce qui a été tapé à la main, hors catalogue. */
    'libres', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id,
        'libelle', x.libelle,
        'quantite', x.quantite,
        'demandee_par', (SELECT t.prenom FROM therapeutes t WHERE t.id = x.demandee_par)
      ) ORDER BY x.cree_le)
      FROM lignes_de_courses x
      WHERE x.liste_id = v_liste.id AND x.libelle IS NOT NULL
    ), '[]'::jsonb)

  ) INTO resultat;

  RETURN resultat;
END;
$$;

-- ===========================================================================
-- 7. LES GESTES
--    Toujours sur la semaine en cours : on ne modifie pas une liste close.
-- ===========================================================================

/* La liste de la semaine, créée au premier geste et pas avant. */
CREATE OR REPLACE FUNCTION liste_ouverte(p_centre_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_semaine date := date_trunc('week', CURRENT_DATE)::date;
  v_id uuid;
BEGIN
  IF acces_centre(p_centre_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Cette liste n''est pas celle de votre centre.';
  END IF;

  INSERT INTO listes_de_courses (centre_id, semaine)
  VALUES (p_centre_id, v_semaine)
  ON CONFLICT (centre_id, semaine) DO NOTHING;

  SELECT id INTO v_id FROM listes_de_courses
   WHERE centre_id = p_centre_id AND semaine = v_semaine;

  IF (SELECT validee_le FROM listes_de_courses WHERE id = v_id) IS NOT NULL THEN
    RAISE EXCEPTION 'La liste de cette semaine est déjà validée : elle ne se modifie plus.';
  END IF;

  RETURN v_id;
END;
$$;

/* Cocher, ou changer la quantité. Zéro décoche. */
CREATE OR REPLACE FUNCTION cocher_la_fourniture(
  p_centre_id text, p_fourniture_id uuid, p_quantite integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_liste uuid := liste_ouverte(p_centre_id);
BEGIN
  IF p_quantite <= 0 THEN
    DELETE FROM lignes_de_courses
     WHERE liste_id = v_liste AND fourniture_id = p_fourniture_id;
    RETURN;
  END IF;

  INSERT INTO lignes_de_courses (liste_id, fourniture_id, quantite, demandee_par)
  VALUES (v_liste, p_fourniture_id, p_quantite, therapeute_courante())
  ON CONFLICT (liste_id, fourniture_id)
  DO UPDATE SET quantite = EXCLUDED.quantite, demandee_par = EXCLUDED.demandee_par;
END;
$$;

/* La ligne « Autre » : ce que le catalogue ne connaît pas encore. */
CREATE OR REPLACE FUNCTION ajouter_une_course(
  p_centre_id text, p_libelle text, p_quantite integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_liste uuid := liste_ouverte(p_centre_id);
  v_texte text := NULLIF(btrim(p_libelle), '');
BEGIN
  IF v_texte IS NULL THEN
    RAISE EXCEPTION 'Il faut écrire ce qu''il faut acheter.';
  END IF;

  INSERT INTO lignes_de_courses (liste_id, libelle, quantite, demandee_par)
  VALUES (v_liste, v_texte, GREATEST(1, COALESCE(p_quantite, 1)), therapeute_courante());
END;
$$;

CREATE OR REPLACE FUNCTION retirer_la_course(p_ligne_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_centre text;
  v_validee timestamptz;
BEGIN
  SELECT l.centre_id, l.validee_le INTO v_centre, v_validee
    FROM lignes_de_courses x JOIN listes_de_courses l ON l.id = x.liste_id
   WHERE x.id = p_ligne_id;

  IF v_centre IS NULL THEN RETURN; END IF;

  IF acces_centre(v_centre) IS NOT TRUE THEN
    RAISE EXCEPTION 'Cette liste n''est pas celle de votre centre.';
  END IF;

  IF v_validee IS NOT NULL THEN
    RAISE EXCEPTION 'La liste est déjà validée : elle ne se modifie plus.';
  END IF;

  DELETE FROM lignes_de_courses WHERE id = p_ligne_id;
END;
$$;

-- ===========================================================================
-- 8. LA VALIDATION, RÉSERVÉE À LA DIRECTION
-- ===========================================================================

CREATE OR REPLACE FUNCTION valider_la_liste(
  p_centre_id text, p_semaine date, p_validee boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT est_direction() THEN
    RAISE EXCEPTION 'Seule la direction valide une liste de courses.';
  END IF;

  UPDATE listes_de_courses
     SET validee_le  = CASE WHEN p_validee THEN now() ELSE NULL END,
         validee_par = CASE WHEN p_validee THEN therapeute_courante() ELSE NULL END,
         commandee_le = CASE WHEN p_validee THEN commandee_le ELSE NULL END
   WHERE centre_id = p_centre_id AND semaine = p_semaine;
END;
$$;

CREATE OR REPLACE FUNCTION marquer_commandee(p_centre_id text, p_semaine date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT est_direction() THEN
    RAISE EXCEPTION 'Seule la direction passe une commande.';
  END IF;

  UPDATE listes_de_courses
     SET commandee_le = now()
   WHERE centre_id = p_centre_id AND semaine = p_semaine AND validee_le IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION liste_de_courses(text, date)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION liste_ouverte(text)                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cocher_la_fourniture(text, uuid, integer)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ajouter_une_course(text, text, integer)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION retirer_la_course(uuid)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION valider_la_liste(text, date, boolean)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION marquer_commandee(text, date)               FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION liste_de_courses(text, date)              TO authenticated;
GRANT EXECUTE ON FUNCTION liste_ouverte(text)                       TO authenticated;
GRANT EXECUTE ON FUNCTION cocher_la_fourniture(text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION ajouter_une_course(text, text, integer)   TO authenticated;
GRANT EXECUTE ON FUNCTION retirer_la_course(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION valider_la_liste(text, date, boolean)     TO authenticated;
GRANT EXECUTE ON FUNCTION marquer_commandee(text, date)             TO authenticated;
