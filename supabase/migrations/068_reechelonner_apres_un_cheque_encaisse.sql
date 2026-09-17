/*
  MAbeautyplus V2 — Migration 068 : le redécoupage échouait dès qu'un
  chèque était encaissé

  LE BUG. `reechelonner_les_echeances` (052) retire les échéances encore
  dues et écrit les nouvelles avec les rangs 1, 2, 3… Or le premier chèque,
  déjà encaissé, reste en place avec son rang 1 : la contrainte d'unicité
  (programme, type, rang) refusait la première nouvelle ligne —
  « duplicate key value violates unique constraint
  echeances_programme_id_type_rang_key », Rémy Boisset, 17 septembre 2026.
  Tant qu'aucune échéance n'était réglée, ça passait ; c'est le cas le plus
  courant en essai, et le moins courant en vrai.

  LA CORRECTION. Les nouvelles échéances prennent la suite du plus haut
  rang encore présent : après un chèque encaissé (rang 1), elles s'appellent
  2, 3, 4 — exactement ce que la fiche affiche. Le reste de la fonction est
  repris mot pour mot de la 052.
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
  v_rang     integer;
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

  /*
    Les nouvelles échéances prennent la suite des rangs déjà pris : le
    premier chèque, encaissé, garde son rang 1, et les suivantes
    s'appellent 2, 3, 4 — comme la fiche les affiche. Repartir de 1
    heurtait la contrainte d'unicité (programme, type, rang) dès qu'une
    échéance réglée restait en place — Rémy Boisset, 17 septembre 2026.
  */
  SELECT COALESCE(MAX(e.rang), 0) INTO v_rang
    FROM echeances e
   WHERE e.programme_id = p_programme_id AND e.type = 'echeance';

  FOR i IN 1 .. array_length(p_montants, 1) LOOP
    INSERT INTO echeances (programme_id, type, rang, montant, date_prevue, statut)
    VALUES (p_programme_id, 'echeance', v_rang + i, p_montants[i], p_dates[i], 'a_venir');
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
  'cures reprises du CRM. Les nouvelles échéances prennent la suite des rangs déjà pris.';

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
