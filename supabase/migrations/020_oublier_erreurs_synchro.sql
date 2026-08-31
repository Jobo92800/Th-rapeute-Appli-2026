/*
  MAbeautyplus V2 — Migration 020 : écarter les erreurs de synchronisation

  Toutes les erreurs ne sont pas des pannes. Quand une fiche est supprimée à
  la main dans Airtable — un essai, une fiche de test — la V2 continue de
  vouloir la mettre à jour et échoue, indéfiniment. L'écran d'accueil finit
  alors par crier au feu pour du ménage volontaire.

  Ce bouton retire ces tâches de la file. Rien n'est perdu : la prochaine
  modification de la fiche la remet en file, et une fiche dont l'identifiant
  Airtable a été vidé y sera recréée.
*/

CREATE OR REPLACE FUNCTION oublier_taches_airtable()
RETURNS integer
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH oubliees AS (
    DELETE FROM airtable_sync WHERE statut = 'erreur' RETURNING 1
  )
  SELECT COUNT(*)::integer FROM oubliees;
$$;

-- Retiré à tout le monde, donné à la seule personne connectée : la clé
-- publique du site ne doit pas pouvoir vider la file.
REVOKE ALL ON FUNCTION oublier_taches_airtable() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION oublier_taches_airtable() TO authenticated;
