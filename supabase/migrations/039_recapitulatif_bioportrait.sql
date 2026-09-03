/*
  MAbeautyplus V2 — Migration 039 : le récapitulatif envoyé à celles qui
  veulent réfléchir

  Une cliente fait son bilan, écoute la proposition, et repart sans signer.
  Jusqu'ici elle repartait aussi sans rien : ni son BioPortrait, ni le détail
  de la cure, ni le prix. Trois jours plus tard, elle ne se souvient plus de
  grand-chose, et la thérapeute n'a rien à lui renvoyer.

  Elle reçoit désormais un récapitulatif par mail : son profil, son terrain,
  ce que l'InBody a montré, la cure proposée et son prix.

  DEUX CHOSES À COMPRENDRE ICI.

  1. LA PROPOSITION EST ENREGISTRÉE, PAS RECALCULÉE.

     Le bilan garde déjà ses réponses et sa version de barème : la
     prescription est donc recalculable à l'identique, et c'est bien ainsi.
     Mais la thérapeute ajuste. Elle passe de vingt à seize séances, elle
     choisit la formule Équilibre, elle annonce mille euros. Rien de tout
     cela ne se déduit des réponses.

     Recalculer plus tard donnerait un autre chiffre que celui prononcé de
     vive voix devant la cliente. Le mail contredirait le rendez-vous. On
     écrit donc ce qui a été proposé, tel quel.

  2. LE PDF EST GARDÉ.

     Comme pour le contrat : il est fabriqué par le navigateur, rangé ici en
     base64, et la fonction de synchro le dépose en pièce jointe sur la fiche
     Airtable. C'est une automatisation Airtable qui envoie le mail — la V2
     ne parle jamais directement à un service d'emailing.

     Le garder permet aussi de savoir exactement ce que la cliente a reçu,
     six mois plus tard, quand elle rappelle.
*/

-- ===========================================================================
-- 1. CE QUI A ÉTÉ PROPOSÉ, ET CE QUI A ÉTÉ ENVOYÉ
-- ===========================================================================

ALTER TABLE bilans
  ADD COLUMN IF NOT EXISTS proposition      jsonb,
  ADD COLUMN IF NOT EXISTS recap_pdf        text,
  ADD COLUMN IF NOT EXISTS recap_demande_le timestamptz,
  ADD COLUMN IF NOT EXISTS recap_envoye_le  timestamptz;

COMMENT ON COLUMN bilans.proposition IS
  'La cure telle qu''elle a été présentée à la cliente : soins, séances, montant, règlement. Écrite parce qu''elle ne se recalcule pas — la thérapeute ajuste.';
COMMENT ON COLUMN bilans.recap_pdf IS
  'Le récapitulatif en PDF, encodé en base64. Fabriqué par le navigateur, déposé en pièce jointe sur la fiche Airtable.';
COMMENT ON COLUMN bilans.recap_demande_le IS
  'Quand la thérapeute a demandé l''envoi. Rempli avant le départ effectif.';
COMMENT ON COLUMN bilans.recap_envoye_le IS
  'Quand le PDF est réellement arrivé dans Airtable. Vide alors que demande_le est rempli = l''envoi est en file, ou il a échoué.';

-- ===========================================================================
-- 2. DEMANDER L'ENVOI
--
--    Un seul geste : on range le PDF, on date la demande, et on met la
--    tâche en file. La fonction de synchro fera le reste.
-- ===========================================================================

CREATE OR REPLACE FUNCTION demander_recap(
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
    RAISE EXCEPTION 'Ce bilan n''est rattaché à aucune fiche : le récapitulatif n''aurait pas de destinataire.';
  END IF;
  /*
    Un PDF absent n'est pas une erreur : c'est un renvoi. La thérapeute
    renvoie à une cliente qui rappelle trois semaines plus tard, et elle
    doit recevoir exactement le document qu'on lui avait envoyé — pas une
    version recalculée entre-temps. On garde donc celui qui est rangé.
  */
  IF p_pdf IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM bilans WHERE id = p_bilan_id AND recap_pdf IS NOT NULL) THEN
      RAISE EXCEPTION 'Aucun récapitulatif n''a encore été établi pour ce bilan.';
    END IF;
  ELSIF length(p_pdf) < 100 THEN
    RAISE EXCEPTION 'Le récapitulatif est vide : rien à envoyer.';
  END IF;

  UPDATE bilans
     SET recap_pdf        = COALESCE(p_pdf, recap_pdf),
         recap_demande_le = now(),
         recap_envoye_le  = NULL
   WHERE id = p_bilan_id;

  INSERT INTO airtable_sync (entite, entite_id) VALUES ('recap', p_bilan_id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
END $$;

COMMENT ON FUNCTION demander_recap(uuid, text) IS
  'Range le récapitulatif en PDF et met son envoi en file vers Airtable.';

REVOKE ALL ON FUNCTION demander_recap(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION demander_recap(uuid, text) TO authenticated;

/*
  ===========================================================================
  À FAIRE DANS AIRTABLE — deux champs et une automatisation
  ===========================================================================

  Table Clients (tblfqxwGePzeiWqqY), deux champs à créer :

    · « Récapitulatif BioPortrait »  — type Pièce jointe (Attachment)
    · « Récap envoyé le »            — type Date

  Puis une automatisation :

    Déclencheur : « Quand un enregistrement correspond à des conditions »
                  → Récap envoyé le n'est pas vide
    Action      : « Envoyer un e-mail via Gmail » (pour que le message parte
                  de contact@mabeautyplus.fr et que les réponses reviennent
                  dans la boîte, plutôt que d'un no-reply Airtable)
      À         : le champ Email de la fiche
      Objet     : Votre BioPortrait — MAbeautyplus
      Pièce jointe : le champ Récapitulatif BioPortrait

  Sans ces deux champs, la synchro échouera en le disant clairement, et rien
  d'autre ne sera perturbé : les autres tâches continuent de passer.
*/
