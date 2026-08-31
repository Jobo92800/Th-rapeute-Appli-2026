/*
  MAbeautyplus V2 — Migration 014 : un bouton « Relancer » qui relance vraiment

  Une tâche qui a échoué cinq fois est écartée du dépilage, pour ne pas
  marteler Airtable indéfiniment. Mais le bouton de relance ne remettait pas
  ce compteur à zéro : il s'exécutait dans le vide, sans rien dire.

  Cette fonction remet les tâches en échec au début de la file. C'est le
  geste explicite d'une personne qui vient de corriger la cause.
*/

CREATE OR REPLACE FUNCTION reprendre_taches_airtable()
RETURNS integer
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH reprises AS (
    UPDATE airtable_sync
    SET statut = 'en_attente',
        tentatives = 0,
        derniere_erreur = NULL
    WHERE statut IN ('erreur', 'en_cours')
    RETURNING 1
  )
  SELECT COUNT(*)::integer FROM reprises;
$$;

GRANT EXECUTE ON FUNCTION reprendre_taches_airtable() TO authenticated;
