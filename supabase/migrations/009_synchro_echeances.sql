/*
  MAbeautyplus V2 — Migration 009 : les encaissements alimentent la file

  Quand une échéance est réglée, Airtable doit voir « Reste à encaisser » et
  « Échéances en retard » bouger. On remet donc le programme dans la file.
*/

CREATE OR REPLACE FUNCTION enfiler_programme_depuis_echeance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO airtable_sync (entite, entite_id)
  VALUES ('programme', COALESCE(NEW.programme_id, OLD.programme_id))
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS echeances_vers_airtable ON echeances;
CREATE TRIGGER echeances_vers_airtable
  AFTER INSERT OR UPDATE OF statut, montant, date_prevue ON echeances
  FOR EACH ROW EXECUTE FUNCTION enfiler_programme_depuis_echeance();

-- La file doit rester lisible par l'application pour afficher les erreurs,
-- mais c'est la fonction serveur qui l'écrit.
DROP POLICY IF EXISTS airtable_sync_relance ON airtable_sync;
CREATE POLICY airtable_sync_relance ON airtable_sync FOR UPDATE TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());
