/*
  MAbeautyplus V2 — Migration 088 : « Courses faites ».

  LE GESTE. La thérapeute revient des courses et clique une fois : ce
  qu'elle avait coché quitte la liste, et le catalogue redevient vierge
  pour la suite de la semaine.

  POURQUOI ON N'EFFACE PAS. Ce que le centre demande ces six derniers mois
  fait deux choses : il range le catalogue par habitude, et il désigne les
  « Autre » qui méritent d'y entrer. Effacer les lignes faites viderait
  cette mémoire à chaque passage en magasin — au bout d'un mois, le
  catalogue serait retombé dans son ordre d'usine et plus rien ne
  remonterait. La ligne est donc datée, pas supprimée.

  L'INDEX SUIT. « Une seule ligne par produit » ne vaut plus que pour les
  lignes ouvertes : demander à nouveau du papier après être passé au
  magasin est normal, et doit créer une nouvelle demande. Le filtre de
  l'index gagne donc `faite_le IS NULL` — et tout `ON CONFLICT` qui s'y
  appuie doit répéter ce filtre, faute de quoi PostgreSQL refuse l'écriture
  entière (la leçon de la migration 087).

  RIEN NE DISPARAÎT SANS RECOURS. Un clic malheureux se rattrape : chaque
  ligne faite peut être rouverte.
*/

-- ===========================================================================
-- 1. QUAND, ET PAR QUI
-- ===========================================================================

ALTER TABLE lignes_de_courses ADD COLUMN IF NOT EXISTS faite_le  timestamptz;
ALTER TABLE lignes_de_courses ADD COLUMN IF NOT EXISTS faite_par uuid REFERENCES therapeutes(id);

COMMENT ON COLUMN lignes_de_courses.faite_le IS
  'Quand la course a été faite. La ligne reste, pour que l''habitude du centre se souvienne.';

-- ===========================================================================
-- 2. L'UNICITÉ NE PORTE PLUS QUE SUR L'OUVERT
-- ===========================================================================

DROP INDEX IF EXISTS lignes_de_courses_une_par_fourniture;

CREATE UNIQUE INDEX IF NOT EXISTS lignes_de_courses_une_par_fourniture
  ON lignes_de_courses (liste_id, fourniture_id)
  WHERE fourniture_id IS NOT NULL AND faite_le IS NULL;

-- ===========================================================================
-- 3. COCHER : LE FILTRE DE L'INDEX, RÉPÉTÉ À L'IDENTIQUE
-- ===========================================================================

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
    /* Décocher ne touche pas à ce qui est déjà fait. */
    DELETE FROM lignes_de_courses
     WHERE liste_id = v_liste AND fourniture_id = p_fourniture_id AND faite_le IS NULL;
    RETURN;
  END IF;

  INSERT INTO lignes_de_courses (liste_id, fourniture_id, quantite, demandee_par)
  VALUES (v_liste, p_fourniture_id, p_quantite, therapeute_courante())
  ON CONFLICT (liste_id, fourniture_id) WHERE fourniture_id IS NOT NULL AND faite_le IS NULL
  DO UPDATE SET quantite = EXCLUDED.quantite, demandee_par = EXCLUDED.demandee_par;
END;
$$;

-- ===========================================================================
-- 4. LE GESTE : TOUT CE QUI EST COCHÉ PASSE EN « FAIT »
-- ===========================================================================

CREATE OR REPLACE FUNCTION marquer_les_courses_faites(p_centre_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_liste uuid := liste_ouverte(p_centre_id);
  v_combien integer;
BEGIN
  UPDATE lignes_de_courses
     SET faite_le = now(), faite_par = therapeute_courante()
   WHERE liste_id = v_liste AND faite_le IS NULL;

  GET DIAGNOSTICS v_combien = ROW_COUNT;

  IF v_combien = 0 THEN
    RAISE EXCEPTION 'Il n''y a rien de coché à marquer comme fait.';
  END IF;

  RETURN v_combien;
END;
$$;

/* Le rattrapage d'un clic malheureux. */
CREATE OR REPLACE FUNCTION rouvrir_la_course(p_ligne_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_centre  text;
  v_liste   uuid;
  v_four    uuid;
  v_qte     integer;
BEGIN
  SELECT l.centre_id, x.liste_id, x.fourniture_id, x.quantite
    INTO v_centre, v_liste, v_four, v_qte
    FROM lignes_de_courses x JOIN listes_de_courses l ON l.id = x.liste_id
   WHERE x.id = p_ligne_id AND x.faite_le IS NOT NULL;

  IF v_centre IS NULL THEN RETURN; END IF;

  IF acces_centre(v_centre) IS NOT TRUE THEN
    RAISE EXCEPTION 'Cette liste n''est pas celle de votre centre.';
  END IF;

  /* Le produit a pu être recoché depuis : on additionne au lieu de buter
     sur l'unicité, et la ligne faite disparaît dans l'autre. */
  IF v_four IS NOT NULL AND EXISTS (
    SELECT 1 FROM lignes_de_courses
     WHERE liste_id = v_liste AND fourniture_id = v_four AND faite_le IS NULL
  ) THEN
    UPDATE lignes_de_courses
       SET quantite = quantite + v_qte
     WHERE liste_id = v_liste AND fourniture_id = v_four AND faite_le IS NULL;
    DELETE FROM lignes_de_courses WHERE id = p_ligne_id;
    RETURN;
  END IF;

  UPDATE lignes_de_courses
     SET faite_le = NULL, faite_par = NULL
   WHERE id = p_ligne_id;
END;
$$;

-- ===========================================================================
-- 5. CE QUE L'ÉCRAN LIT : L'OUVERT D'UN CÔTÉ, LE FAIT DE L'AUTRE
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
        'liens',       to_jsonb(f.liens),
        'quantite',    COALESCE(li.quantite, 0),
        'demandee_par', (SELECT t.prenom FROM therapeutes t WHERE t.id = li.demandee_par),
        /* Ce que ce centre demande le plus souvent, sur six mois — ce qui
           est déjà fait compte autant que ce qui reste à acheter. */
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
        ON li.fourniture_id = f.id AND li.liste_id = v_liste.id AND li.faite_le IS NULL
      WHERE f.actif
        AND (f.centres IS NULL OR p_centre_id = ANY (f.centres))
    ), '[]'::jsonb),

    /* Ce qui a été tapé à la main, hors catalogue, et reste à acheter. */
    'libres', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id,
        'libelle', x.libelle,
        'quantite', x.quantite,
        'demandee_par', (SELECT t.prenom FROM therapeutes t WHERE t.id = x.demandee_par)
      ) ORDER BY x.cree_le)
      FROM lignes_de_courses x
      WHERE x.liste_id = v_liste.id AND x.libelle IS NOT NULL AND x.faite_le IS NULL
    ), '[]'::jsonb),

    /* Ce qui a été rapporté cette semaine. Rien ne disparaît sans recours. */
    'faites', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id,
        'libelle', COALESCE(f.nom, x.libelle),
        'unite', f.unite,
        'quantite', x.quantite,
        'faite_le', x.faite_le,
        'faite_par', (SELECT t.prenom FROM therapeutes t WHERE t.id = x.faite_par)
      ) ORDER BY x.faite_le DESC, COALESCE(f.nom, x.libelle))
      FROM lignes_de_courses x
      LEFT JOIN fournitures f ON f.id = x.fourniture_id
      WHERE x.liste_id = v_liste.id AND x.faite_le IS NOT NULL
    ), '[]'::jsonb)

  ) INTO resultat;

  RETURN resultat;
END;
$$;

-- ===========================================================================
-- 6. PROMOUVOIR NE TOUCHE QUE CE QUI RESTE À ACHETER
--    Une demande déjà faite appartient à l'histoire : on ne la réécrit pas.
-- ===========================================================================

CREATE OR REPLACE FUNCTION promouvoir_la_course(
  p_libelle   text,
  p_categorie text DEFAULT 'autre',
  p_unite     text DEFAULT 'unité',
  p_liens     text[] DEFAULT '{}',
  p_centres   text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_libelle text := btrim(COALESCE(p_libelle, ''));
  v_id      uuid;
  v_semaine date := date_trunc('week', CURRENT_DATE)::date;
  v_ligne   record;
BEGIN
  IF est_direction() IS NOT TRUE THEN
    RAISE EXCEPTION 'Le catalogue des fournitures est réservé à la direction.';
  END IF;

  IF v_libelle = '' THEN
    RAISE EXCEPTION 'Indiquez le produit à faire entrer au catalogue.';
  END IF;

  IF EXISTS (SELECT 1 FROM fournitures WHERE lower(btrim(nom)) = lower(v_libelle)) THEN
    RAISE EXCEPTION 'Une fourniture porte déjà ce nom : modifiez-la plutôt que d''en créer une seconde.';
  END IF;

  v_id := enregistrer_la_fourniture(NULL, v_libelle, p_categorie, p_unite, p_liens, p_centres, true);

  FOR v_ligne IN
    SELECT x.id, x.liste_id, x.quantite
      FROM lignes_de_courses x
      JOIN listes_de_courses l ON l.id = x.liste_id
     WHERE x.libelle IS NOT NULL
       AND x.faite_le IS NULL
       AND lower(btrim(x.libelle)) = lower(v_libelle)
       AND l.semaine = v_semaine
     ORDER BY x.cree_le
  LOOP
    IF EXISTS (
      SELECT 1 FROM lignes_de_courses
       WHERE liste_id = v_ligne.liste_id AND fourniture_id = v_id AND faite_le IS NULL
    ) THEN
      UPDATE lignes_de_courses
         SET quantite = quantite + v_ligne.quantite
       WHERE liste_id = v_ligne.liste_id AND fourniture_id = v_id AND faite_le IS NULL;
      DELETE FROM lignes_de_courses WHERE id = v_ligne.id;
    ELSE
      UPDATE lignes_de_courses
         SET fourniture_id = v_id, libelle = NULL
       WHERE id = v_ligne.id;
    END IF;
  END LOOP;

  RETURN v_id;
END;
$$;

-- ===========================================================================
-- 7. LES DROITS D'APPEL
-- ===========================================================================

REVOKE ALL ON FUNCTION marquer_les_courses_faites(text) FROM public;
REVOKE ALL ON FUNCTION rouvrir_la_course(uuid) FROM public;

GRANT EXECUTE ON FUNCTION marquer_les_courses_faites(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rouvrir_la_course(uuid) TO authenticated;
