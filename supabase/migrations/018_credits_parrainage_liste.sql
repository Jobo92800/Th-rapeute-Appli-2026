/*
  MAbeautyplus V2 — Migration 018 : les crédits de parrainage en un coup d'œil

  La liste des clientes doit pouvoir afficher une pastille discrète — « 4 »
  à côté du nom — sans poser une question par ligne. Et comme une filleule
  peut être suivie dans un autre centre, la liste ne peut pas faire ce
  calcul elle-même : ses fiches lui sont invisibles.

  Une seule fonction, un seul aller-retour, et rien que des compteurs : ni
  nom, ni coordonnées, ni montant. La règle (2 séances par filleule, plafond
  10) reste dans le code, avec le reste des règles métier.
*/

CREATE OR REPLACE FUNCTION credits_parrainage_du_centre(p_centre text)
RETURNS TABLE (
  cliente_id         uuid,
  filleules_engagees integer,
  seances_utilisees  integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT acces_centre(p_centre) THEN
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
  WHERE c.centre_id = p_centre
    AND c.archivee_le IS NULL
    -- Seules les marraines dont une filleule a signé nous intéressent :
    -- les autres n'ont rien à afficher.
    AND EXISTS (
      SELECT 1 FROM clientes f
      WHERE f.parrain_id = c.id
        AND f.archivee_le IS NULL
        AND EXISTS (SELECT 1 FROM contrats k WHERE k.cliente_id = f.id)
    );
END $$;

REVOKE ALL ON FUNCTION credits_parrainage_du_centre(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION credits_parrainage_du_centre(text) TO authenticated;
