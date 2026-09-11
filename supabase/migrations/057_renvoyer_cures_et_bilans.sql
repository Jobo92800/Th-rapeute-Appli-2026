/*
  MAbeautyplus V2 — Migration 057 : « Envoyer au CRM » renvoie aussi les
  cures et les bilans

  CE QUI MANQUAIT. La commande de la 045 remettait en file la fiche et ses
  contrats — pas ses cures ni ses bilans. Or ce sont eux qui portent ce que
  le CRM lit le plus : « Montant Cure », « Soins », le mode de règlement,
  le profil et le terrain. Le 11 septembre 2026, la synchro a appris à
  écrire « Anti-âge » dans « Soins » ; une fiche partie la veille avec
  « Perte de poids » n'avait aucun bouton pour se corriger.

  La fonction est reprise de la 045, avec deux insertions de plus.
*/

CREATE OR REPLACE FUNCTION renvoyer_au_crm(p_cliente uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_centre text;
  v_total  integer := 0;
  v_n      integer;
BEGIN
  SELECT centre_id INTO v_centre FROM clientes WHERE id = p_cliente;

  IF v_centre IS NULL THEN
    RAISE EXCEPTION 'Cette fiche n''existe plus.';
  END IF;
  IF NOT acces_centre(v_centre) THEN
    RAISE EXCEPTION 'Cette fiche n''est pas dans votre centre.';
  END IF;

  /*
    La fiche elle-même : identité, coordonnées, parcours audio, avoir. C'est
    ce que « Enregistrer » remettait en file sans le dire.
  */
  INSERT INTO airtable_sync (entite, entite_id)
  VALUES ('cliente', p_cliente)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_total := v_total + v_n;

  /*
    Puis ses contrats : ce sont eux qui portent les PDF en pièces jointes,
    contrat et consentements. Une cliente qui revient en a plusieurs, et on
    les repose tous — renvoyer un document déjà arrivé ne coûte qu'un
    remplacement à l'identique.
  */
  INSERT INTO airtable_sync (entite, entite_id)
  SELECT 'contrat', k.id FROM contrats k WHERE k.cliente_id = p_cliente
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_total := v_total + v_n;

  /*
    Puis ses cures et ses bilans. Ce sont eux qui portent « Montant Cure »,
    « Soins », le mode de règlement, le profil et le terrain : sans eux,
    « Envoyer au CRM » renvoyait la fiche sans ce que le CRM en attend le
    plus. Le jour où la synchro a changé ce qu'elle écrit dans « Soins »,
    aucune fiche déjà partie ne pouvait se corriger autrement qu'en la
    modifiant pour rien.
  */
  INSERT INTO airtable_sync (entite, entite_id)
  SELECT 'programme', p.id FROM programmes p WHERE p.cliente_id = p_cliente
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_total := v_total + v_n;

  INSERT INTO airtable_sync (entite, entite_id)
  SELECT 'bilan', b.id FROM bilans b WHERE b.cliente_id = p_cliente AND b.statut = 'termine'
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_total := v_total + v_n;

  RETURN v_total;
END $$;

REVOKE ALL ON FUNCTION renvoyer_au_crm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION renvoyer_au_crm(uuid) TO authenticated;

-- Contrôle : la fonction existe, ouverte aux comptes connectés, fermée au public.
SELECT
  p.proname                                                 AS fonction,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ouverte_aux_connectes,
  NOT has_function_privilege('anon', p.oid, 'EXECUTE')      AS fermee_au_public
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'renvoyer_au_crm';
