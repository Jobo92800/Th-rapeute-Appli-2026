/*
  MAbeautyplus V2 — Migration 052 : redécouper l'échéancier d'une cure

  POURQUOI.

  La cliente a signé en quatre chèques et rappelle trois jours plus tard
  pour en demander trois. Jusqu'ici il fallait arrêter la cure et la
  refaire : un geste lourd, qui crée un avoir et fausse le tableau de bord
  pour une histoire de chèques.

  CE QUE FAIT CETTE FONCTION, ET RIEN D'AUTRE.

  Elle remplace les échéances **encore dues** par celles qu'on lui donne.
  Elle ne touche ni au montant de la cure, ni aux règlements déjà passés, ni
  au mode de règlement.

  LES GARDE-FOUS SONT ICI, PAS DANS L'ÉCRAN.

  Le calcul de la répartition vit dans le code, avec le reste de la
  tarification et son banc d'essai. Mais un écran peut se tromper, et une
  requête peut arriver d'ailleurs : cette fonction refuse donc elle-même
  tout ce qui n'a pas de sens.

    — pas chez Alma. Le calendrier appartient à l'organisme de crédit ;
      le redécouper ici ne changerait rien à ce qu'il prélève, et
      l'échéancier de la fiche mentirait à la cliente.

    — pas sur une cure arrêtée, ni sur une cure reprise du CRM dont on ne
      connaît pas le mode de règlement.

    — la somme doit tomber juste, au centime. C'est le contrôle qui compte :
      il interdit qu'un redécoupage fasse disparaître ou apparaître de
      l'argent. Une erreur d'arrondi dans l'écran est rattrapée ici, avant
      d'entrer en base.

    — rien de réglé ne bouge. Les échéances `paye` et `donne`, celle du
      bilan payé en ligne et l'acompte restent où elles sont : ce sont des
      faits, pas des prévisions.
*/

CREATE OR REPLACE FUNCTION reechelonner_les_echeances(
  p_programme_id uuid,
  p_montants     numeric[],
  p_dates        date[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_centre   text;
  v_mode     text;
  v_statut   text;
  v_du       numeric;
  v_propose  numeric;
  i          integer;
BEGIN
  SELECT p.centre_id, p.mode_reglement, p.statut
    INTO v_centre, v_mode, v_statut
    FROM programmes p WHERE p.id = p_programme_id;

  IF v_centre IS NULL THEN
    RAISE EXCEPTION 'Cette cure n''existe pas.';
  END IF;
  IF NOT acces_centre(v_centre) THEN
    RAISE EXCEPTION 'Cette cure appartient à un centre qui n''est pas accessible depuis ce compte.';
  END IF;
  IF v_statut = 'abandonne' THEN
    RAISE EXCEPTION 'Cette cure est arrêtée : son échéancier ne se redécoupe plus.';
  END IF;
  IF v_mode LIKE 'alma%' THEN
    RAISE EXCEPTION 'Réglée par Alma : le calendrier appartient à l''organisme de crédit.';
  END IF;
  IF v_mode = 'inconnu' THEN
    RAISE EXCEPTION 'Cure reprise du CRM : son échéancier ne vient pas de nous.';
  END IF;

  IF array_length(p_montants, 1) IS NULL OR array_length(p_montants, 1) < 1 THEN
    RAISE EXCEPTION 'Il faut au moins une échéance.';
  END IF;
  IF array_length(p_montants, 1) <> array_length(p_dates, 1) THEN
    RAISE EXCEPTION 'Autant de dates que de montants.';
  END IF;
  IF array_length(p_montants, 1) > 12 THEN
    RAISE EXCEPTION 'Douze échéances au maximum.';
  END IF;

  -- Ce qui reste dû aujourd'hui, et ce qu'on propose d'écrire à la place.
  SELECT COALESCE(SUM(e.montant), 0) INTO v_du
    FROM echeances e
   WHERE e.programme_id = p_programme_id
     AND e.statut IN ('a_venir', 'impaye')
     AND e.type NOT IN ('bilan', 'acompte');

  SELECT COALESCE(SUM(m), 0) INTO v_propose FROM unnest(p_montants) AS m;

  IF round(v_du, 2) <> round(v_propose, 2) THEN
    RAISE EXCEPTION
      'Le redécoupage ne tombe pas juste : % € restent dus, % € proposés.',
      round(v_du, 2), round(v_propose, 2);
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(p_montants) AS m WHERE m < 0) THEN
    RAISE EXCEPTION 'Une échéance ne peut pas être négative.';
  END IF;

  -- On ne retire que ce qui était encore à réclamer.
  DELETE FROM echeances e
   WHERE e.programme_id = p_programme_id
     AND e.statut IN ('a_venir', 'impaye')
     AND e.type NOT IN ('bilan', 'acompte');

  FOR i IN 1 .. array_length(p_montants, 1) LOOP
    INSERT INTO echeances (programme_id, type, rang, montant, date_prevue, statut)
    VALUES (p_programme_id, 'echeance', i, p_montants[i], p_dates[i], 'a_venir');
  END LOOP;

  /*
    Le CRM doit suivre : « Reste à encaisser » et les dates de relance
    viennent de ces lignes. Sans ça, Airtable réclamerait encore l'ancien
    calendrier.
  */
  INSERT INTO airtable_sync (entite, entite_id)
  SELECT 'programme', p_programme_id
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
END $$;

COMMENT ON FUNCTION reechelonner_les_echeances(uuid, numeric[], date[]) IS
  'Redécoupe ce qui reste dû sur une cure réglée au centre. Ne touche ni au '
  'montant, ni aux règlements passés. Refuse Alma, les cures arrêtées et les '
  'cures reprises du CRM.';

-- La règle depuis la 040 : chaque fonction porte son propre droit.
REVOKE ALL ON FUNCTION reechelonner_les_echeances(uuid, numeric[], date[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reechelonner_les_echeances(uuid, numeric[], date[]) TO authenticated;

-- Contrôle : une ligne, ouverte aux connectés, fermée au public.
SELECT
  p.proname                                                 AS fonction,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ouverte_aux_connectes,
  NOT has_function_privilege('anon', p.oid, 'EXECUTE')      AS fermee_au_public
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'reechelonner_les_echeances';
