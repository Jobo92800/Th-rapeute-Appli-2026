/*
  MAbeautyplus V2 — Migration 090 : « Envoyer au CRM » n'est plus un
  bouton mort.

  CE QUI SE PASSAIT. Une tâche qui a échoué cinq fois est écartée du
  dépilage — c'est volontaire, pour ne pas marteler Airtable. Mais
  `renvoyer_au_crm` reposait la tâche en file en remettant son statut à
  « en_attente » SANS remettre le compteur à zéro. La tâche n'était donc
  plus jamais réclamée : la synchro rendait « 0 traitée, 0 échec », et
  l'écran annonçait que tout allait bien.

  LE SECOND VERROU. `reprendre_taches_airtable`, qui sait remettre le
  compteur à zéro, ne regardait que les statuts « erreur » et « en_cours ».
  Or le bouton venait justement de repasser la tâche en « en_attente ». Les
  deux boutons se neutralisaient : aucun des deux ne pouvait débloquer ce
  que l'autre avait bloqué.

  Constaté le 19 novembre 2026 sur la fiche d'une cliente dont le record
  Airtable avait été supprimé : la cause première était réparée, mais
  l'envoi restait impossible.

  CE QU'ON CORRIGE. Reposer une fiche en file est le geste explicite de
  quelqu'un qui vient de corriger la cause — exactement ce que disait déjà
  la migration 014. Il remet donc le compteur à zéro, comme la relance. Et
  la relance ramasse aussi ce qui a atteint le plafond en « en_attente »,
  pour qu'aucun chemin ne reste sans issue.
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
  IF acces_centre(v_centre) IS NOT TRUE THEN
    RAISE EXCEPTION 'Cette fiche n''est pas dans votre centre.';
  END IF;

  /*
    La fiche elle-même : identité, coordonnées, parcours audio, avoir.

    `tentatives = 0` : sans lui, une tâche déjà écartée restait écartée et
    le bouton n'avait aucun effet — en annonçant le contraire.
  */
  INSERT INTO airtable_sync (entite, entite_id)
  VALUES ('cliente', p_cliente)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', tentatives = 0, cree_le = now(), derniere_erreur = NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_total := v_total + v_n;

  /* Puis ses contrats : ce sont eux qui portent les PDF en pièces jointes. */
  INSERT INTO airtable_sync (entite, entite_id)
  SELECT 'contrat', k.id FROM contrats k WHERE k.cliente_id = p_cliente
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', tentatives = 0, cree_le = now(), derniere_erreur = NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_total := v_total + v_n;

  /* Puis ses cures et ses bilans : « Montant Cure », « Soins », le mode de
     règlement, le profil et le terrain. */
  INSERT INTO airtable_sync (entite, entite_id)
  SELECT 'programme', p.id FROM programmes p WHERE p.cliente_id = p_cliente
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', tentatives = 0, cree_le = now(), derniere_erreur = NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_total := v_total + v_n;

  INSERT INTO airtable_sync (entite, entite_id)
  SELECT 'bilan', b.id FROM bilans b WHERE b.cliente_id = p_cliente AND b.statut = 'termine'
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', tentatives = 0, cree_le = now(), derniere_erreur = NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_total := v_total + v_n;

  RETURN v_total;
END $$;

/*
  La relance ramasse aussi ce qui a atteint le plafond en « en_attente ».
  Sans ça, une tâche reposée en file par l'ancien bouton n'avait plus aucun
  chemin pour repartir.
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
       OR (statut = 'en_attente' AND tentatives >= 5)
    RETURNING 1
  )
  SELECT COUNT(*)::integer FROM reprises;
$$;

REVOKE ALL ON FUNCTION renvoyer_au_crm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION renvoyer_au_crm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reprendre_taches_airtable() TO authenticated;
