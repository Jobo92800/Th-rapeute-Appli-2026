/*
  MAbeautyplus V2 — Migration 082 : basculer des séances d'un soin à un autre

  POURQUOI.

  Une cure se vend d'un bloc, et la cliente change d'avis en route : elle
  arrête la relaxation au bout de deux séances et veut de l'I-Shape à la
  place (Jonathan, 22 octobre 2026). Jusqu'ici il n'y avait rien pour ça —
  il fallait arrêter la cure et la refaire, ce qui crée un avoir, déplace la
  date de validation et fausse le tableau de bord pour un échange qui ne
  coûte rien à personne.

  CE QUE FAIT CETTE COMMANDE, ET RIEN D'AUTRE.

  Elle retire N séances **restant à faire** sur un soin et les pose sur un
  autre. C'est tout : le nombre vendu par soin change, le reste ne bouge pas.

  **LE MONTANT DE LA CURE NE BOUGE JAMAIS** (décision de Jonathan). La cure
  est vendue et signée ; on échange des séances, pas de l'argent. Entre deux
  soins à 59 € ça ne se verrait pas de toute façon ; entre deux soins de prix
  différents, le centre ne rend ni ne réclame rien. Pour toucher au prix il y
  a « Corriger les montants » (077), et ça se décide exprès.

  Quand le soin d'arrivée n'a pas encore de ligne, elle naît **au prix de
  celle qu'on quitte** : une séance reste vendue au prix qu'elle valait,
  c'est déjà la règle de la 077. Quand la ligne existe, elle garde le sien —
  une ligne porte un prix, pas deux.

  CE QU'ON NE DÉPLACE PAS.

    — ce qui est déjà fait. On ne bouge que le restant : `seances_prevues`
      moins ce qui a été clôturé. Les séances réalisées racontent ce qui
      s'est passé, et ça ne se réécrit pas depuis cet écran.

    — les séances offertes par parrainage. Elles ont été posées sur un soin
      au moment de la vente et comptent à part (`seances_offertes`) ; la
      commande refuse de déplacer plus que les séances vendues.

    — une cure arrêtée. Son avoir a été calculé sur ce qu'elle contenait.

  LE CRM SUIT. « Nb séances » et « Détail prescription » se lisent dans ces
  lignes : sans remise en file, Airtable annoncerait encore l'ancienne
  répartition.

  OUVERTE À TOUTES. Ce n'est pas une décision d'argent — c'est la cliente
  qui est là, devant la thérapeute, et qui dit ce qu'elle préfère. Les
  garde-fous sont dans la base, pas dans l'écran.

  Sans danger, rejouable autant de fois que nécessaire.
*/

BEGIN;

CREATE OR REPLACE FUNCTION basculer_les_seances(
  p_programme_id uuid,
  p_de           text,
  p_vers         text,
  p_nombre       integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_centre     text;
  v_statut     text;
  v_prevues    integer;
  v_offertes   integer;
  v_faites     integer;
  v_restantes  integer;
  v_prix       numeric;
BEGIN
  IF p_de = p_vers THEN
    RAISE EXCEPTION 'Il faut deux soins différents.';
  END IF;
  IF p_nombre IS NULL OR p_nombre < 1 THEN
    RAISE EXCEPTION 'Le nombre de séances à basculer doit être au moins 1.';
  END IF;

  SELECT p.centre_id, p.statut INTO v_centre, v_statut
    FROM programmes p WHERE p.id = p_programme_id;

  IF v_centre IS NULL THEN
    RAISE EXCEPTION 'Cette cure n''existe pas.';
  END IF;
  IF NOT acces_centre(v_centre) THEN
    RAISE EXCEPTION 'Cette cure appartient à un centre qui n''est pas accessible depuis ce compte.';
  END IF;
  IF v_statut = 'abandonne' THEN
    RAISE EXCEPTION
      'Cette cure est arrêtée : son avoir a été calculé sur ce qu''elle contenait.';
  END IF;

  SELECT l.seances_prevues, l.seances_offertes, l.prix_unitaire
    INTO v_prevues, v_offertes, v_prix
    FROM programme_lignes l
   WHERE l.programme_id = p_programme_id AND l.technologie = p_de;

  IF v_prevues IS NULL THEN
    RAISE EXCEPTION 'Ce soin ne figure pas dans la cure.';
  END IF;

  SELECT count(*) INTO v_faites
    FROM seances s
   WHERE s.programme_id = p_programme_id AND s.technologie = p_de AND s.cloturee;

  v_restantes := v_prevues + COALESCE(v_offertes, 0) - v_faites;

  IF p_nombre > v_restantes THEN
    RAISE EXCEPTION
      'Il ne reste que % séance(s) à faire sur ce soin.', GREATEST(v_restantes, 0);
  END IF;

  /*
    On ne déplace que des séances VENDUES. Les séances offertes par
    parrainage ont été posées sur un soin à la vente et se comptent à part :
    les emporter ferait passer `seances_prevues` sous zéro.
  */
  IF p_nombre > v_prevues THEN
    RAISE EXCEPTION
      'Sur ce soin, % séance(s) seulement ont été vendues — les séances offertes ne se déplacent pas.',
      v_prevues;
  END IF;

  UPDATE programme_lignes
     SET seances_prevues = seances_prevues - p_nombre
   WHERE programme_id = p_programme_id AND technologie = p_de;

  INSERT INTO programme_lignes (programme_id, technologie, seances_prevues, prix_unitaire)
  VALUES (p_programme_id, p_vers, p_nombre, v_prix)
  ON CONFLICT (programme_id, technologie) DO UPDATE
    SET seances_prevues = programme_lignes.seances_prevues + EXCLUDED.seances_prevues;

  /*
    Une ligne vidée disparaît : un soin à zéro séance qui traîne dans la cure
    s'affiche partout — au contrat, au récapitulatif, sur la fiche — comme
    s'il en faisait partie. Sauf si des séances y ont été faites : celles-là
    doivent rester rattachées à leur ligne.
  */
  DELETE FROM programme_lignes l
   WHERE l.programme_id = p_programme_id
     AND l.technologie = p_de
     AND l.seances_prevues = 0
     AND COALESCE(l.seances_offertes, 0) = 0
     AND NOT EXISTS (
       SELECT 1 FROM seances s
        WHERE s.programme_id = p_programme_id AND s.technologie = p_de
     );

  /*
    Le CRM lit « Nb séances » et « Détail prescription » dans ces lignes :
    sans ça, Airtable annoncerait encore l'ancienne répartition.
  */
  INSERT INTO airtable_sync (entite, entite_id)
  SELECT 'programme', p_programme_id
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
END $$;

COMMENT ON FUNCTION basculer_les_seances(uuid, text, text, integer) IS
  'Déplace des séances restant à faire d''un soin vers un autre, sans toucher '
  'au montant de la cure. Refuse une cure arrêtée, plus de séances qu''il n''en '
  'reste, et les séances offertes par parrainage.';

REVOKE ALL ON FUNCTION basculer_les_seances(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION basculer_les_seances(uuid, text, text, integer) TO authenticated;

COMMIT;

-- Contrôle : une ligne, ouverte aux connectés, fermée au public.
SELECT
  p.proname                                                 AS fonction,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ouverte_aux_connectes,
  NOT has_function_privilege('anon', p.oid, 'EXECUTE')      AS fermee_au_public
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'basculer_les_seances';
