/*
  MAbeautyplus V2 — Migration 027 : les crédits de parrainage sur les cinq
  centres

  La direction peut désormais regarder les cinq centres d'un coup. La liste
  des clientes affiche alors tout le monde, et sa pastille de crédits doit
  suivre — sans quoi elle disparaîtrait au moment précis où elle est la plus
  utile.

  Passer NULL demande tous les centres, et c'est réservé à la direction :
  une thérapeute ne peut pas s'en servir pour lire les autres.
*/

CREATE OR REPLACE FUNCTION credits_parrainage_du_centre(p_centre text DEFAULT NULL)
RETURNS TABLE (
  cliente_id         uuid,
  filleules_engagees integer,
  seances_utilisees  integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_centre IS NULL THEN
    IF NOT est_direction() THEN
      RAISE EXCEPTION 'La vue d''ensemble est réservée à la direction.';
    END IF;
  ELSIF NOT acces_centre(p_centre) THEN
    RAISE EXCEPTION 'Ce centre n''est pas accessible depuis ce compte.';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    (SELECT COUNT(*)::integer
       FROM clientes f
      WHERE f.parrain_id = c.id
        AND f.archivee_le IS NULL
        AND EXISTS (SELECT 1 FROM contrats k WHERE k.cliente_id = f.id)),
    (SELECT COALESCE(SUM(l.seances_offertes), 0)::integer
       FROM programmes p
       JOIN programme_lignes l ON l.programme_id = p.id
      WHERE p.cliente_id = c.id)
  FROM clientes c
  WHERE c.archivee_le IS NULL
    AND (p_centre IS NULL OR c.centre_id = p_centre)
    AND EXISTS (
      SELECT 1 FROM clientes f
      WHERE f.parrain_id = c.id
        AND f.archivee_le IS NULL
        AND EXISTS (SELECT 1 FROM contrats k WHERE k.cliente_id = f.id)
    );
END $$;

REVOKE ALL ON FUNCTION credits_parrainage_du_centre(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION credits_parrainage_du_centre(text) TO authenticated;
