/*
  MAbeautyplus V2 — Migration 077 : corriger les montants d'une cure

  POURQUOI.

  Une cure se vend au comptoir, et la vie s'en mêle : un geste commercial
  consenti devant la cliente, une erreur de saisie qu'on découvre le
  lendemain, un chèque qu'elle demande à arrondir. Jusqu'ici il n'y avait
  qu'un geste pour ça — arrêter la cure et la refaire —, qui crée un avoir,
  déplace la date de validation et fausse le tableau de bord pour une
  histoire de quelques euros.

  CE QUE FAIT CETTE COMMANDE, ET RIEN D'AUTRE.

  Elle écrit un nouveau montant de cure et de nouveaux montants d'échéances.
  Elle ne touche ni aux dates, ni au mode de règlement, ni aux séances
  vendues, ni aux lignes de la cure : le contrat signé, lui, garde ce qui a
  été signé — c'est un document qui engage, il ne se réécrit pas.

  RÉSERVÉE À LA DIRECTION, et vérifiée ici.

  Changer un montant après coup, c'est décider de ce qu'on ne réclamera
  plus, exactement comme un avoir ou un arrêt de cure. Une thérapeute ne
  décide pas de ça seule au comptoir. L'écran le sait déjà, mais un écran
  peut mentir et une requête peut arriver d'ailleurs : la base le vérifie.

  LES GARDE-FOUS.

    — la somme des échéances doit retomber sur le montant de la cure, frais
      de financement compris. C'est le contrôle qui compte : il interdit
      qu'une correction fasse apparaître ou disparaître de l'argent entre le
      montant annoncé et ce qu'on réclame. Un écran qui se trompe d'un
      centime est arrêté ici.

    — ce qui est réglé ne bouge pas. Une échéance `paye` ou `donne`, celle
      du bilan déjà versé, l'acompte : ce sont des faits, pas des
      prévisions. Pour corriger un montant déjà encaissé, il faut d'abord
      remettre la ligne « À venir » dans son menu — un geste qui se voit.

    — pas sur une cure arrêtée. Son avoir a été calculé sur ces montants ;
      les changer sous lui le rendrait faux sans que rien ne le dise.

    — aucun montant négatif, et un total qui ne peut pas être négatif non
      plus.

  Le CRM suit : « Montant Cure » et « Reste à encaisser » viennent de ces
  lignes.
*/

BEGIN;

CREATE OR REPLACE FUNCTION corriger_les_montants(
  p_programme_id  uuid,
  p_montant_total numeric,
  p_echeances     jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_centre text;
  v_statut text;
  v_frais  numeric;
  v_somme  numeric;
  v_attendu numeric;
  v_ligne  jsonb;
BEGIN
  IF NOT est_direction() THEN
    RAISE EXCEPTION 'Corriger les montants d''une cure est réservé à la direction.';
  END IF;

  SELECT p.centre_id, p.statut, COALESCE(p.frais_financement, 0)
    INTO v_centre, v_statut, v_frais
    FROM programmes p WHERE p.id = p_programme_id;

  IF v_centre IS NULL THEN
    RAISE EXCEPTION 'Cette cure n''existe pas.';
  END IF;
  IF NOT acces_centre(v_centre) THEN
    RAISE EXCEPTION 'Cette cure appartient à un centre qui n''est pas accessible depuis ce compte.';
  END IF;
  IF v_statut = 'abandonne' THEN
    RAISE EXCEPTION
      'Cette cure est arrêtée : son avoir a été calculé sur ces montants, les corriger le rendrait faux.';
  END IF;
  IF p_montant_total IS NULL OR p_montant_total < 0 THEN
    RAISE EXCEPTION 'Le montant de la cure ne peut pas être négatif.';
  END IF;

  /*
    Les corrections demandées, une par une. On refuse ligne par ligne plutôt
    que d'ignorer en silence : une correction qui ne s'applique pas à moitié
    est pire qu'une correction refusée.
  */
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_echeances) LOOP
    IF (v_ligne->>'montant')::numeric < 0 THEN
      RAISE EXCEPTION 'Une échéance ne peut pas être négative.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM echeances e
       WHERE e.id = (v_ligne->>'id')::uuid AND e.programme_id = p_programme_id
    ) THEN
      RAISE EXCEPTION 'Une des échéances n''appartient pas à cette cure.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM echeances e
       WHERE e.id = (v_ligne->>'id')::uuid
         AND (e.statut IN ('paye', 'donne') OR e.type IN ('bilan', 'acompte'))
         AND round(e.montant, 2) <> round((v_ligne->>'montant')::numeric, 2)
    ) THEN
      RAISE EXCEPTION
        'Une échéance déjà réglée ne se corrige pas : remettez-la « À venir » d''abord.';
    END IF;

    UPDATE echeances
       SET montant = round((v_ligne->>'montant')::numeric, 2)
     WHERE id = (v_ligne->>'id')::uuid;
  END LOOP;

  /*
    LE CONTRÔLE QUI COMPTE. Chez Alma, les échéances portent les frais du
    crédit en plus du prix de la cure : la somme attendue est donc le
    montant plus les frais, et non le montant seul.
  */
  SELECT COALESCE(SUM(e.montant), 0) INTO v_somme
    FROM echeances e WHERE e.programme_id = p_programme_id;

  v_attendu := round(p_montant_total + v_frais, 2);

  IF round(v_somme, 2) <> v_attendu THEN
    RAISE EXCEPTION
      'Les montants ne tombent pas juste : % € d''échéances pour % € attendus.',
      round(v_somme, 2), v_attendu;
  END IF;

  UPDATE programmes
     SET montant_total = round(p_montant_total, 2)
   WHERE id = p_programme_id;

  /*
    Le CRM doit suivre : « Montant Cure », « Reste à encaisser » et les
    relances viennent de ces lignes.
  */
  INSERT INTO airtable_sync (entite, entite_id)
  SELECT 'programme', p_programme_id
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
END $$;

COMMENT ON FUNCTION corriger_les_montants(uuid, numeric, jsonb) IS
  'Direction seulement. Réécrit le montant d''une cure et les montants de ses '
  'échéances. Refuse une cure arrêtée, une échéance déjà réglée, et toute '
  'somme qui ne retombe pas sur le montant plus les frais.';

REVOKE ALL ON FUNCTION corriger_les_montants(uuid, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION corriger_les_montants(uuid, numeric, jsonb) TO authenticated;

COMMIT;

-- Contrôle : une ligne, ouverte aux connectés, fermée au public.
SELECT
  p.proname                                                 AS fonction,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ouverte_aux_connectes,
  NOT has_function_privilege('anon', p.oid, 'EXECUTE')      AS fermee_au_public
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'corriger_les_montants';
