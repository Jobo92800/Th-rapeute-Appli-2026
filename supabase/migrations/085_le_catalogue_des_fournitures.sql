/*
  MAbeautyplus V2 — Migration 085 : le catalogue des fournitures se gère
  depuis l'application, et chaque produit porte plusieurs liens.

  POURQUOI PLUSIEURS LIENS. Un seul lien et la semaine où il est en rupture,
  la liste ne sert plus à rien. Le premier lien est celui qu'on achète, les
  suivants sont les replis. Aucun plafond : trois aujourd'hui, un quatrième
  le jour où il faudra.

  LES LIENS NE SONT PAS FORCÉMENT AMAZON. Une pharmacie, un grossiste, un
  fournisseur local : la base stocke l'adresse telle qu'elle est donnée.
  C'est l'application qui sait reconnaître et nettoyer un lien Amazon.

  CE QUI EST TAPÉ À LA MAIN FINIT AU CATALOGUE. Une thérapeute tape « sacs
  poubelle 100 L » trois semaines de suite : ce n'est plus un achat de
  circonstance, c'est une fourniture du centre. La direction le voit et le
  promeut d'un geste — et la demande en cours suit, elle n'est pas perdue.

  LE CATALOGUE EST À LA DIRECTION. Les thérapeutes cochent, la direction
  décide de ce qu'il y a à cocher. La base le vérifie.
*/

-- ===========================================================================
-- 1. PLUSIEURS LIENS PAR FOURNITURE
--    `lien_amazon` devient le premier élément de `liens`, puis disparaît.
-- ===========================================================================

ALTER TABLE fournitures ADD COLUMN IF NOT EXISTS liens text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'fournitures' AND column_name = 'lien_amazon'
  ) THEN
    UPDATE fournitures
       SET liens = ARRAY[lien_amazon]
     WHERE lien_amazon IS NOT NULL
       AND btrim(lien_amazon) <> ''
       AND liens = '{}';
    ALTER TABLE fournitures DROP COLUMN lien_amazon;
  END IF;
END $$;

COMMENT ON COLUMN fournitures.liens IS
  'Où acheter, par ordre de préférence. Le premier est celui qu''on achète, les suivants sont les replis en cas de rupture.';

-- ===========================================================================
-- 2. CE QUE L'ÉCRAN DE COURSES LIT
--    Même fonction qu'en 084 : `lien_amazon` devient `liens`.
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
-- 3. CE QUE L'ÉDITEUR DE CATALOGUE LIT
--    Tout, y compris les fournitures désactivées, plus les textes libres
--    qui reviennent et mériteraient d'entrer au catalogue.
-- ===========================================================================

CREATE OR REPLACE FUNCTION catalogue_des_fournitures()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  resultat jsonb;
BEGIN
  IF est_direction() IS NOT TRUE THEN
    RAISE EXCEPTION 'Le catalogue des fournitures est réservé à la direction.';
  END IF;

  SELECT jsonb_build_object(

    'fournitures', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',        f.id,
        'nom',       f.nom,
        'categorie', f.categorie,
        'unite',     f.unite,
        'liens',     to_jsonb(f.liens),
        'centres',   to_jsonb(f.centres),
        'actif',     f.actif,
        /* Combien de fois demandée, tous centres confondus, sur six mois. */
        'demandes', (
          SELECT count(*) FROM lignes_de_courses x
          JOIN listes_de_courses l ON l.id = x.liste_id
          WHERE x.fourniture_id = f.id
            AND l.semaine >= CURRENT_DATE - INTERVAL '6 months'
        )
      ) ORDER BY f.categorie, f.ordre, f.nom)
      FROM fournitures f
    ), '[]'::jsonb),

    /* Les « Autre » qui reviennent : demandés au moins deux fois en six
       mois et absents du catalogue. Ce sont eux qu'il faut promouvoir. */
    'a_promouvoir', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'libelle',  s.libelle,
               'demandes', s.demandes,
               'centres',  to_jsonb(s.centres),
               'en_cours', s.en_cours
             ) ORDER BY s.demandes DESC, s.libelle)
      FROM (
        /* Un seul groupe par produit, quelle que soit la casse tapée : le
           libellé affiché est le premier dans l'ordre alphabétique. */
        SELECT min(btrim(x.libelle))                 AS libelle,
               count(*)                              AS demandes,
               array_agg(DISTINCT l.centre_id)        AS centres,
               /* Demandé cette semaine : la promotion rattachera la demande. */
               bool_or(l.semaine = date_trunc('week', CURRENT_DATE)::date) AS en_cours
          FROM lignes_de_courses x
          JOIN listes_de_courses l ON l.id = x.liste_id
         WHERE x.libelle IS NOT NULL
           AND l.semaine >= CURRENT_DATE - INTERVAL '6 months'
           AND NOT EXISTS (
             SELECT 1 FROM fournitures f2
              WHERE lower(btrim(f2.nom)) = lower(btrim(x.libelle))
           )
         GROUP BY lower(btrim(x.libelle))
        HAVING count(*) >= 2
      ) s
    ), '[]'::jsonb),

    'centres', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.nom) ORDER BY c.nom)
      FROM centres c
    ), '[]'::jsonb)

  ) INTO resultat;

  RETURN resultat;
END;
$$;

-- ===========================================================================
-- 4. CRÉER OU MODIFIER UNE FOURNITURE
--    `p_id` à NULL crée ; sinon on modifie. `p_centres` à NULL = tous les
--    centres, comme partout ailleurs.
-- ===========================================================================

CREATE OR REPLACE FUNCTION enregistrer_la_fourniture(
  p_id        uuid,
  p_nom       text,
  p_categorie text,
  p_unite     text,
  p_liens     text[],
  p_centres   text[] DEFAULT NULL,
  p_actif     boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nom   text := btrim(COALESCE(p_nom, ''));
  v_unite text := btrim(COALESCE(p_unite, ''));
  v_liens text[];
  v_id    uuid;
BEGIN
  IF est_direction() IS NOT TRUE THEN
    RAISE EXCEPTION 'Le catalogue des fournitures est réservé à la direction.';
  END IF;

  IF v_nom = '' THEN
    RAISE EXCEPTION 'Donnez un nom à la fourniture : c''est ce que la thérapeute lira sur sa liste.';
  END IF;

  /* On ne garde que les adresses non vides, dans l'ordre donné. */
  SELECT COALESCE(array_agg(l ORDER BY i), '{}')
    INTO v_liens
    FROM unnest(COALESCE(p_liens, '{}')) WITH ORDINALITY AS u(l, i)
   WHERE btrim(COALESCE(l, '')) <> '';

  /* Un centre inconnu est une faute de frappe, pas un filtre. */
  IF p_centres IS NOT NULL THEN
    IF array_length(p_centres, 1) IS NULL THEN
      RAISE EXCEPTION 'Choisissez au moins un centre, ou laissez « tous les centres ».';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(p_centres) AS c(id)
       WHERE NOT EXISTS (SELECT 1 FROM centres x WHERE x.id = c.id)
    ) THEN
      RAISE EXCEPTION 'Un des centres indiqués n''existe pas.';
    END IF;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO fournitures (nom, categorie, unite, liens, centres, actif)
    VALUES (v_nom, p_categorie, COALESCE(NULLIF(v_unite, ''), 'unité'),
            v_liens, p_centres, COALESCE(p_actif, true))
    RETURNING id INTO v_id;
  ELSE
    UPDATE fournitures
       SET nom       = v_nom,
           categorie = p_categorie,
           unite     = COALESCE(NULLIF(v_unite, ''), unite),
           liens     = v_liens,
           centres   = p_centres,
           actif     = COALESCE(p_actif, true)
     WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Cette fourniture n''existe plus : rechargez la page.';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- ===========================================================================
-- 5. PROMOUVOIR UN TEXTE LIBRE EN FOURNITURE
--    Le produit est créé, et toutes les demandes de la semaine en cours
--    portant ce libellé le désignent désormais. Les semaines passées ne
--    sont pas réécrites : elles racontent ce qui s'est passé.
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

  /* Les demandes de la semaine suivent le produit créé. Une par une : si le
     produit est déjà coché dans la même liste, on additionne au lieu de
     buter sur l'unicité (liste_id, fourniture_id). */
  FOR v_ligne IN
    SELECT x.id, x.liste_id, x.quantite
      FROM lignes_de_courses x
      JOIN listes_de_courses l ON l.id = x.liste_id
     WHERE x.libelle IS NOT NULL
       AND lower(btrim(x.libelle)) = lower(v_libelle)
       AND l.semaine = v_semaine
     ORDER BY x.cree_le
  LOOP
    IF EXISTS (
      SELECT 1 FROM lignes_de_courses
       WHERE liste_id = v_ligne.liste_id AND fourniture_id = v_id
    ) THEN
      UPDATE lignes_de_courses
         SET quantite = quantite + v_ligne.quantite
       WHERE liste_id = v_ligne.liste_id AND fourniture_id = v_id;
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
-- 6. LES DROITS D'APPEL
-- ===========================================================================

REVOKE ALL ON FUNCTION catalogue_des_fournitures() FROM public;
REVOKE ALL ON FUNCTION enregistrer_la_fourniture(uuid, text, text, text, text[], text[], boolean) FROM public;
REVOKE ALL ON FUNCTION promouvoir_la_course(text, text, text, text[], text[]) FROM public;

GRANT EXECUTE ON FUNCTION catalogue_des_fournitures() TO authenticated;
GRANT EXECUTE ON FUNCTION enregistrer_la_fourniture(uuid, text, text, text, text[], text[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION promouvoir_la_course(text, text, text, text[], text[]) TO authenticated;
