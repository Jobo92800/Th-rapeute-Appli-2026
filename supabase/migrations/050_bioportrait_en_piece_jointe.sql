/*
  MAbeautyplus V2 — Migration 050 : le BioPortrait de chaque bilan, à part

  POURQUOI UN DOCUMENT DE PLUS.

  Le récapitulatif existe déjà, mais il porte deux choses : le BioPortrait,
  et l'offre qui va avec — soins, séances, montant, échéances. On ne peut
  donc pas l'envoyer six mois plus tard : les prix auront changé, et la
  proposition ne vaudra plus rien.

  Le BioPortrait, lui, ne périme pas. Le profil et le terrain d'une personne
  restent ce qu'ils étaient le jour du bilan, et c'est ce qu'on veut pouvoir
  retrouver et renvoyer : à une cliente qui a perdu son document, à celle
  qui n'a pas démarré et rappelle en septembre, ou simplement pour l'avoir
  au dossier.

  QUAND IL EST FABRIQUÉ. À la fin de chaque bilan, quoi qu'il arrive — cure
  validée, bilan seul, récapitulatif envoyé. C'est le sens de « chaque
  personne » : on ne décide pas après coup qu'il aurait fallu le garder.

  CE QUE ÇA N'EST PAS : un envoi. Le PDF est déposé en pièce jointe sur la
  fiche Airtable, rien de plus. Aucun mail ne part — contrairement au
  récapitulatif, dont la date de dépôt déclenche une automatisation.
*/

ALTER TABLE bilans
  ADD COLUMN IF NOT EXISTS bioportrait_pdf       text,
  ADD COLUMN IF NOT EXISTS bioportrait_depose_le timestamptz;

COMMENT ON COLUMN bilans.bioportrait_pdf IS
  'Le BioPortrait seul, en PDF encodé en base64 : le diagnostic sans un mot '
  'sur la cure ni sur le prix. Fabriqué par le navigateur à la fin du bilan.';
COMMENT ON COLUMN bilans.bioportrait_depose_le IS
  'Quand le PDF est arrivé dans Airtable. Vide alors que bioportrait_pdf est '
  'rempli = le dépôt est en file, ou il a échoué.';

-- ---------------------------------------------------------------------------
-- Ranger le BioPortrait, et le mettre en file vers Airtable.
--
-- Comme pour le récapitulatif : un PDF absent n'est pas une erreur, c'est un
-- nouveau dépôt de celui qui est déjà rangé.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ranger_bioportrait(
  p_bilan_id uuid,
  p_pdf      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_centre  text;
  v_cliente uuid;
BEGIN
  SELECT b.centre_id, b.cliente_id INTO v_centre, v_cliente
    FROM bilans b WHERE b.id = p_bilan_id;

  IF v_centre IS NULL THEN
    RAISE EXCEPTION 'Ce bilan n''existe pas.';
  END IF;
  IF NOT acces_centre(v_centre) THEN
    RAISE EXCEPTION 'Ce bilan appartient à un centre qui n''est pas accessible depuis ce compte.';
  END IF;
  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'Ce bilan n''est rattaché à aucune fiche : le BioPortrait n''aurait nulle part où aller.';
  END IF;

  IF p_pdf IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM bilans WHERE id = p_bilan_id AND bioportrait_pdf IS NOT NULL) THEN
      RAISE EXCEPTION 'Aucun BioPortrait n''a encore été établi pour ce bilan.';
    END IF;
  ELSIF length(p_pdf) < 100 THEN
    RAISE EXCEPTION 'Le BioPortrait est vide : rien à déposer.';
  END IF;

  UPDATE bilans
     SET bioportrait_pdf       = COALESCE(p_pdf, bioportrait_pdf),
         bioportrait_depose_le = NULL
   WHERE id = p_bilan_id;

  INSERT INTO airtable_sync (entite, entite_id) VALUES ('bioportrait', p_bilan_id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
END $$;

COMMENT ON FUNCTION ranger_bioportrait(uuid, text) IS
  'Range le BioPortrait d''un bilan et le met en file vers Airtable. Aucun mail.';

-- La règle depuis la 040 : chaque fonction porte son propre droit.
REVOKE ALL ON FUNCTION ranger_bioportrait(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ranger_bioportrait(uuid, text) TO authenticated;

-- Contrôle : doit renvoyer une ligne, ouverte aux connectés et fermée au public.
SELECT
  p.proname                                                 AS fonction,
  has_function_privilege('authenticated', p.oid, 'EXECUTE')  AS ouverte_aux_connectes,
  NOT has_function_privilege('anon', p.oid, 'EXECUTE')       AS fermee_au_public
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'ranger_bioportrait';
