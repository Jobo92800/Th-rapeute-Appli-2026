/*
  MAbeautyplus V2 — Migration 066 : effacer les fiches de test d'un bouton

  Le ménage se faisait au script (`supabase/effacer_les_fiches_de_test.sql`),
  collé dans l'éditeur SQL à chaque série d'essais. Jonathan veut le même
  geste depuis le tableau de bord (15 septembre 2026). Même règle, mot
  pour mot : toute fiche NÉE DANS LA V2 dont le nom ou le prénom contient
  « test ». Rien d'autre — une vraie cliente ne s'efface pas par script,
  et une fiche reprise du CRM jamais.

  Deux commandes, RÉSERVÉES À LA DIRECTION et vérifiées côté base :
    — `lister_les_fiches_de_test()` dit ce qui partirait ;
    — `effacer_les_fiches_de_test()` efface, et rend les identifiants
      Airtable des fiches parties, pour que l'application supprime aussi
      leurs copies dans le CRM.

  Tout leur dossier part par la cascade ; les mouvements de stock de leurs
  contrats et leurs tâches Airtable sont retirés à la main, la cascade ne
  le fait pas — comme dans le script.
*/

CREATE OR REPLACE FUNCTION lister_les_fiches_de_test()
RETURNS TABLE (id uuid, fiche text, cree_le timestamptz, airtable_record_id text, cures integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id,
         c.prenom || ' ' || c.nom,
         c.cree_le,
         c.airtable_record_id,
         (SELECT COUNT(*)::integer FROM programmes p WHERE p.cliente_id = c.id)
  FROM clientes c
  WHERE est_direction()
    AND c.origine = 'v2'
    AND (c.nom ILIKE '%test%' OR c.prenom ILIKE '%test%')
  ORDER BY c.cree_le;
$$;

CREATE OR REPLACE FUNCTION effacer_les_fiches_de_test()
RETURNS TABLE (id uuid, fiche text, airtable_record_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT est_direction() THEN
    RAISE EXCEPTION 'Seule la direction peut effacer les fiches de test.';
  END IF;

  CREATE TEMP TABLE a_effacer ON COMMIT DROP AS
    SELECT c.id, c.prenom || ' ' || c.nom AS fiche, c.airtable_record_id
    FROM clientes c
    WHERE c.origine = 'v2'
      AND (c.nom ILIKE '%test%' OR c.prenom ILIKE '%test%');

  -- Les mouvements de stock de leurs contrats.
  DELETE FROM mouvements_stock m
   USING programmes p
   WHERE p.id = m.programme_id
     AND p.cliente_id IN (SELECT a.id FROM a_effacer a);

  -- Leurs tâches Airtable en file.
  DELETE FROM airtable_sync s WHERE s.entite_id IN (SELECT a.id FROM a_effacer a);

  -- Les fiches. La cascade emporte le dossier.
  DELETE FROM clientes c WHERE c.id IN (SELECT a.id FROM a_effacer a);

  RETURN QUERY SELECT a.id, a.fiche, a.airtable_record_id FROM a_effacer a;
END $$;

COMMENT ON FUNCTION effacer_les_fiches_de_test() IS
  'Efface les fiches nées dans la V2 dont le nom ou le prénom contient « test », avec tout leur dossier. Direction seulement.';

REVOKE ALL ON FUNCTION lister_les_fiches_de_test() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION effacer_les_fiches_de_test() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lister_les_fiches_de_test() TO authenticated;
GRANT EXECUTE ON FUNCTION effacer_les_fiches_de_test() TO authenticated;

-- Contrôle : les deux existent, ouvertes aux connectés, fermées au public.
SELECT
  p.proname                                                 AS fonction,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ouverte_aux_connectes,
  NOT has_function_privilege('anon', p.oid, 'EXECUTE')      AS fermee_au_public
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('lister_les_fiches_de_test', 'effacer_les_fiches_de_test');
