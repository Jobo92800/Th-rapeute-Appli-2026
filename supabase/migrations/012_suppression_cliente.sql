/*
  MAbeautyplus V2 — Migration 012 : suppression définitive d'une cliente

  L'archivage existait déjà : il sort la fiche des listes sans rien perdre.
  Cette migration ajoute la suppression réelle, pour les fiches de test et
  les créations par erreur.

  Tout le reste part avec : bilan, cure, échéancier, séances, mensurations,
  notes, contrats et consentements. Les liens sont déjà en ON DELETE CASCADE,
  il ne manquait que le nettoyage de la file de synchronisation, qui ne
  référence pas les clientes par clé étrangère.

  Le droit de supprimer reste réservé à la direction (policy posée en 002).
*/

-- ---------------------------------------------------------------------------
-- 1. La file de synchro ne doit pas garder de tâches orphelines
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nettoyer_file_airtable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM airtable_sync
  WHERE (entite = 'cliente'   AND entite_id = OLD.id)
     OR (entite = 'bilan'     AND entite_id IN (SELECT id FROM bilans     WHERE cliente_id = OLD.id))
     OR (entite = 'programme' AND entite_id IN (SELECT id FROM programmes WHERE cliente_id = OLD.id))
     OR (entite = 'contrat'   AND entite_id IN (SELECT id FROM contrats   WHERE cliente_id = OLD.id));
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS clientes_nettoyage_file ON clientes;
CREATE TRIGGER clientes_nettoyage_file
  BEFORE DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION nettoyer_file_airtable();

-- ---------------------------------------------------------------------------
-- 2. Ce qui sera perdu, pour l'afficher avant de confirmer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION contenu_cliente(p_cliente uuid)
RETURNS TABLE (
  bilans integer,
  programmes integer,
  seances integer,
  mensurations integer,
  notes integer,
  contrats integer,
  ventes integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*)::integer FROM bilans             WHERE cliente_id = p_cliente),
    (SELECT COUNT(*)::integer FROM programmes         WHERE cliente_id = p_cliente),
    (SELECT COUNT(*)::integer FROM seances            WHERE cliente_id = p_cliente),
    (SELECT COUNT(*)::integer FROM mensurations       WHERE cliente_id = p_cliente),
    (SELECT COUNT(*)::integer FROM notes_cliente      WHERE cliente_id = p_cliente),
    (SELECT COUNT(*)::integer FROM contrats           WHERE cliente_id = p_cliente),
    (SELECT COUNT(*)::integer FROM ventes_complements WHERE cliente_id = p_cliente);
$$;

GRANT EXECUTE ON FUNCTION contenu_cliente(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Restaurer une fiche archivée
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN clientes.archivee_le IS
  'Fiche sortie des listes sans rien perdre. Se restaure. À distinguer de la suppression, qui est définitive.';
