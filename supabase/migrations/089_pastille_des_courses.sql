/*
  MAbeautyplus V2 — Migration 089 : la direction voit qu'il y a des
  courses à faire sans avoir à ouvrir la page.

  CE QUE COMPTE LA PASTILLE. Un centre « a des courses à faire » quand sa
  liste de la semaine porte au moins un produit qui reste à acheter —
  donc ni déjà rapporté par une thérapeute, ni déjà commandé par la
  direction. Le jour où la commande est passée, la pastille s'éteint
  toute seule : aucun état à cliquer, aucun compteur à remettre à zéro.

  POURQUOI CETTE FONCTION NE REFUSE PAS, ELLE REND VIDE. Les autres
  fonctions du catalogue lèvent une erreur quand le compte n'est pas la
  direction, parce qu'elles répondent à un geste : l'erreur dit à
  quelqu'un pourquoi son clic n'a rien fait. Celle-ci est interrogée toute
  seule, chaque minute, par le menu. Lever une erreur y ferait clignoter
  un message que personne n'a demandé, une fois par minute. Elle rend donc
  une liste vide — ce qui ne divulgue rien, et n'allume aucune pastille.
*/

CREATE OR REPLACE FUNCTION courses_a_faire()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_centres jsonb;
BEGIN
  IF est_direction() IS NOT TRUE THEN
    RETURN jsonb_build_object('centres', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'centre_id', s.centre_id,
           'nom',       s.nom,
           'produits',  s.produits
         ) ORDER BY s.nom), '[]'::jsonb)
    INTO v_centres
    FROM (
      SELECT l.centre_id,
             c.nom,
             count(x.id) AS produits
        FROM listes_de_courses l
        JOIN centres c ON c.id = l.centre_id
        JOIN lignes_de_courses x ON x.liste_id = l.id AND x.faite_le IS NULL
       WHERE l.semaine = date_trunc('week', CURRENT_DATE)::date
         AND l.commandee_le IS NULL
       GROUP BY l.centre_id, c.nom
    ) s;

  RETURN jsonb_build_object('centres', v_centres);
END;
$$;

REVOKE ALL ON FUNCTION courses_a_faire() FROM public;
GRANT EXECUTE ON FUNCTION courses_a_faire() TO authenticated;
