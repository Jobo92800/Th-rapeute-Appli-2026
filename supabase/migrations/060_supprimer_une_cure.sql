/*
  MAbeautyplus V2 — Migration 060 : supprimer une cure

  ARRÊTER N'EST PAS SUPPRIMER. Arrêter une cure, c'est dire qu'elle a
  existé et qu'elle s'interrompt : on annule ce qui reste dû, on fait un
  avoir. Supprimer, c'est dire qu'elle n'aurait jamais dû exister — une
  cure ajoutée sur la mauvaise fiche, un essai, une erreur de saisie. Le
  10 septembre 2026, une cure 2 Alma ajoutée par erreur sur la fiche
  d'Alice Fabre a été ARRÊTÉE faute de pouvoir être supprimée : une cure
  Alma naissant encaissée, l'arrêt lui a ouvert un avoir de 1 282,87 €
  pour un argent jamais reçu. Il a fallu un script à la main
  (`supabase/corriger_alice_fabre.sql`). Cette commande en est la forme
  générale.

  RÉSERVÉ À LA DIRECTION, comme l'arrêt et comme la suppression d'une
  fiche : effacer une cure efface des séances faites et des règlements.
  Vérifié ici, côté base — un écran peut mentir.

  CE QUI PART AVEC LA CURE :
    — ses échéances, ses lignes et ses séances (cascade) ;
    — son contrat signé et ses consentements (la clé est en SET NULL, la
      cascade ne les emporterait pas — et un contrat orphelin ne dit plus
      rien) ;
    — les sorties de stock de sa signature : le guide et la tenue
      reviennent au rayon. S'ils ont vraiment été remis, une sortie
      manuelle les ressort ;
    — l'avoir que son arrêt avait créé, s'il n'a pas été dépensé (sinon on
      refuse : effacer un avoir déjà utilisé creuserait un trou) ;
    — l'avoir dépensé sur elle : il revient à la cliente, puisque la cure
      sur laquelle il est parti n'existe plus ;
    — ses tâches Airtable en file.

  CE QUI RESTE : la fiche, le bilan, les mensurations et les ventes de
  compléments (leur lien vers la cure se vide, elles sont à la cliente).

  Les cures suivantes GARDENT LEUR NUMÉRO : « Montant cure 3 » dans
  Airtable correspond au numéro 3, renuméroter déplacerait les montants
  dans le CRM.

  CE QUE LA BASE NE FAIT PAS : vider « Montant cure N » dans Airtable —
  la synchro n'écrit que les cures qui existent. C'est l'application qui
  le demande à la fonction Edge juste après (`vider_montant_cure`).
*/

CREATE OR REPLACE FUNCTION supprimer_cure(p_programme_id uuid)
RETURNS TABLE (numero integer, cliente_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente uuid;
  v_centre  text;
  v_numero  integer;
  v_accorde numeric;
  v_solde   numeric;
BEGIN
  IF NOT est_direction() THEN
    RAISE EXCEPTION 'Seule la direction peut supprimer une cure.';
  END IF;

  SELECT p.cliente_id, p.centre_id, p.numero
    INTO v_cliente, v_centre, v_numero
    FROM programmes p WHERE p.id = p_programme_id;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'Cette cure n''existe pas.';
  END IF;

  /*
    L'avoir né de son arrêt : on ne peut le reprendre que s'il est encore
    là. S'il a été dépensé ou remboursé, même en partie, l'effacer
    laisserait la cliente avec un solde négatif — on refuse, et on dit
    pourquoi.
  */
  SELECT COALESCE(SUM(montant), 0) INTO v_accorde
    FROM avoirs WHERE programme_id = p_programme_id AND sens = 'accorde';
  IF v_accorde > 0 THEN
    SELECT COALESCE(s.solde, 0) INTO v_solde FROM solde_avoir s WHERE s.cliente_id = v_cliente;
    IF COALESCE(v_solde, 0) < v_accorde THEN
      RAISE EXCEPTION 'Impossible de supprimer cette cure : l''avoir de % € né de son arrêt a déjà été utilisé ou remboursé, au moins en partie.', v_accorde;
    END IF;
  END IF;

  -- L'avoir qu'elle a créé part avec elle ; celui qui a été dépensé sur
  -- elle revient à la cliente.
  DELETE FROM avoirs WHERE programme_id = p_programme_id;

  -- Le guide et la tenue reviennent au rayon.
  DELETE FROM mouvements_stock WHERE programme_id = p_programme_id;

  -- Les tâches Airtable de la cure et de son contrat, avant que le contrat
  -- ne disparaisse : une tâche sur une cure absente échouerait pour toujours.
  DELETE FROM airtable_sync
   WHERE (entite = 'programme' AND entite_id = p_programme_id)
      OR (entite = 'contrat' AND entite_id IN (SELECT id FROM contrats WHERE programme_id = p_programme_id));

  DELETE FROM contrats WHERE programme_id = p_programme_id;

  -- La cure. La cascade emporte échéances, lignes et séances ; les
  -- mensurations et les ventes de compléments se détachent et restent.
  DELETE FROM programmes WHERE id = p_programme_id;

  -- Le CRM doit revoir la fiche : reste à encaisser, retards, avoir.
  INSERT INTO airtable_sync (entite, entite_id) VALUES ('cliente', v_cliente)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;

  RETURN QUERY SELECT v_numero, v_cliente;
END $$;

COMMENT ON FUNCTION supprimer_cure(uuid) IS
  'Efface définitivement une cure et ce qu''elle a laissé (échéances, séances, contrat, sorties de stock, avoir). Direction seulement.';

REVOKE ALL ON FUNCTION supprimer_cure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION supprimer_cure(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Ce que la suppression va emporter, pour l'afficher avant de confirmer —
-- même parti pris que `contenu_cliente` (012).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION contenu_cure(p_programme_id uuid)
RETURNS TABLE (
  seances_faites   integer,
  echeances_payees integer,
  montant_paye     numeric,
  contrats         integer,
  sorties_stock    integer,
  avoir_accorde    numeric,
  avoir_utilise    numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*)::integer FROM seances   WHERE programme_id = p_programme_id AND cloturee),
    (SELECT COUNT(*)::integer FROM echeances WHERE programme_id = p_programme_id AND statut = 'paye'),
    (SELECT COALESCE(SUM(montant), 0) FROM echeances WHERE programme_id = p_programme_id AND statut = 'paye'),
    (SELECT COUNT(*)::integer FROM contrats  WHERE programme_id = p_programme_id),
    (SELECT COUNT(*)::integer FROM mouvements_stock WHERE programme_id = p_programme_id),
    (SELECT COALESCE(SUM(montant), 0) FROM avoirs WHERE programme_id = p_programme_id AND sens = 'accorde'),
    (SELECT COALESCE(SUM(montant), 0) FROM avoirs WHERE programme_id = p_programme_id AND sens = 'utilise');
$$;

REVOKE ALL ON FUNCTION contenu_cure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION contenu_cure(uuid) TO authenticated;

-- Contrôle : les deux fonctions existent, ouvertes aux connectés, fermées au public.
SELECT
  p.proname                                                 AS fonction,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ouverte_aux_connectes,
  NOT has_function_privilege('anon', p.oid, 'EXECUTE')      AS fermee_au_public
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('supprimer_cure', 'contenu_cure');
