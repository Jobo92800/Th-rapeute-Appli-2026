/*
  MAbeautyplus V2 — Migration 045 : remettre une fiche dans la file du CRM

  CE QUI SE PASSAIT.

  Tout part dans Airtable tout seul : signer un contrat met en file son PDF
  et ses consentements, créer l'accès au parcours audio remet la fiche en
  file. Mais quand la synchro passe à côté — Airtable indisponible, fiche
  supprimée à la main, coupure réseau au mauvais moment —, la thérapeute
  n'avait qu'un seul moyen de relancer : retourner dans « Coordonnées » et
  appuyer sur « Enregistrer ». Ça marche, parce que réenregistrer la fiche
  la remet en file et vide la file au passage. Mais c'est un détour que rien
  n'annonce, et à trois onglets de l'endroit où on se trouve.

  CE QU'ON FAIT.

  La même chose, mais nommée. Cette commande remet dans la file la fiche de
  la cliente **et tous ses contrats**, et rend le nombre de choses remises.
  L'application enchaîne en vidant la file, comme le faisait l'enregistrement.

  Elle ne force rien : elle repose une intention. Si Airtable refuse encore,
  la tâche repart en erreur et se lit sur l'accueil, comme avant.
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

  RETURN v_total;
END $$;

REVOKE ALL ON FUNCTION renvoyer_au_crm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION renvoyer_au_crm(uuid) TO authenticated;
