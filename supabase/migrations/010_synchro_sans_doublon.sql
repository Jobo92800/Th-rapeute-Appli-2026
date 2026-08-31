/*
  MAbeautyplus V2 — Migration 010 : plus de doublons à la synchronisation

  Le parcours du bilan déclenche trois synchros coup sur coup (cliente, bilan,
  cure). Elles partaient en parallèle, prenaient les mêmes tâches, et aucune
  ne voyait l'identifiant Airtable que l'autre venait d'écrire : la fiche
  était créée deux fois.

  Deux verrous règlent le problème :

    1. Les tâches sont réclamées de façon atomique (FOR UPDATE SKIP LOCKED).
       Deux appels simultanés ne peuvent plus prendre la même tâche.

    2. Une cliente ne peut être créée dans Airtable que par un seul appel à
       la fois. Le verrou expire tout seul au bout de deux minutes, pour ne
       pas rester bloqué si une fonction s'interrompt en cours de route.
*/

-- ---------------------------------------------------------------------------
-- 1. Verrou de création, par cliente
-- ---------------------------------------------------------------------------

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS airtable_verrou timestamptz;

COMMENT ON COLUMN clientes.airtable_verrou IS
  'Pose d''un verrou le temps de créer la fiche dans Airtable. Expire seul après 2 minutes.';

/*
  Renvoie true si l'appelant a le droit de créer la fiche Airtable.
  Renvoie false si un autre appel s'en occupe déjà, ou si elle existe déjà.
*/
CREATE OR REPLACE FUNCTION reserver_creation_airtable(p_cliente uuid)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  UPDATE clientes
  SET airtable_verrou = now()
  WHERE id = p_cliente
    AND airtable_record_id IS NULL
    AND (airtable_verrou IS NULL OR airtable_verrou < now() - INTERVAL '2 minutes')
  RETURNING true;
$$;

-- ---------------------------------------------------------------------------
-- 2. Réclamation atomique des tâches
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reclamer_taches_airtable(p_lot integer DEFAULT 15)
RETURNS TABLE (id uuid, entite text, entite_id uuid, tentatives integer)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  UPDATE airtable_sync s
  SET statut = 'en_cours'
  WHERE s.id IN (
    SELECT a.id FROM airtable_sync a
    WHERE a.statut IN ('en_attente', 'erreur')
      AND a.tentatives < 5
    ORDER BY a.cree_le
    LIMIT p_lot
    FOR UPDATE SKIP LOCKED
  )
  RETURNING s.id, s.entite, s.entite_id, s.tentatives;
$$;

-- ---------------------------------------------------------------------------
-- 3. Filet de sécurité : une tâche restée « en_cours » plus de 10 minutes
--    correspond à une fonction interrompue. On la remet en attente.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION debloquer_taches_airtable()
RETURNS integer
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH remises AS (
    UPDATE airtable_sync
    SET statut = 'en_attente'
    WHERE statut = 'en_cours'
      AND cree_le < now() - INTERVAL '10 minutes'
    RETURNING 1
  )
  SELECT COUNT(*)::integer FROM remises;
$$;

GRANT EXECUTE ON FUNCTION reserver_creation_airtable(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION reclamer_taches_airtable(integer) TO service_role;
GRANT EXECUTE ON FUNCTION debloquer_taches_airtable() TO service_role, authenticated;
