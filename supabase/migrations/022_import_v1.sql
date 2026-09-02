/*
  MAbeautyplus V2 — Migration 022 : préparer la reprise des fiches Airtable

  Les 680 fiches du CRM vont entrer dans la V2 : identité, coordonnées,
  centre, source, date de création. Et pour chaque montant renseigné
  (« Montant Cure », « Montant cure 2 »…), une cure reprise, datée — faute
  de mieux — à la création de la fiche. Airtable ne date que celle-là.

  Trois précautions avant d'écrire quoi que ce soit.

  1. Une cure reprise n'est pas une cure de la V2 : elle n'a ni séances, ni
     échéancier, ni mode de règlement. Il faut pouvoir la reconnaître, sinon
     l'application afficherait une cure vide sans dire pourquoi.

  2. Le mode de règlement est inconnu. Écrire « 4 fois sans frais » par
     défaut serait inventer une information : le tableau de bord annoncerait
     des répartitions fausses. On ajoute donc une valeur « inconnu ».

  3. Le piège : chaque fiche créée dans la V2 part dans Airtable. Importer
     680 fiches déclencherait 680 renvois vers la base d'où elles viennent.
     Une fiche importée ne s'enfile donc pas à sa création — ses
     modifications ultérieures, elles, repartent normalement.
*/

-- ---------------------------------------------------------------------------
-- 1. Reconnaître une cure reprise de l'ancienne application
-- ---------------------------------------------------------------------------

ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'v2'
    CHECK (origine IN ('v2', 'import_v1'));

COMMENT ON COLUMN programmes.origine IS
  'import_v1 : cure reprise du CRM. Montant seul, sans séances ni échéancier, datée à la création de la fiche.';

-- ---------------------------------------------------------------------------
-- 2. Un mode de règlement qu'on ne connaît pas se dit
-- ---------------------------------------------------------------------------

ALTER TABLE programmes DROP CONSTRAINT IF EXISTS programmes_mode_reglement_check;
ALTER TABLE programmes ADD CONSTRAINT programmes_mode_reglement_check
  CHECK (mode_reglement IN ('comptant', '4x_maison', '10x_alma', 'inconnu'));

-- ---------------------------------------------------------------------------
-- 3. Une fiche qui vient d'Airtable n'a rien à y renvoyer en naissant
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enfiler_airtable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT'
     AND COALESCE(to_jsonb(NEW) ->> 'origine', 'v2') = 'import_v1' THEN
    RETURN NEW;
  END IF;

  INSERT INTO airtable_sync (entite, entite_id)
  VALUES (TG_ARGV[0], NEW.id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;

  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Le tableau de bord ne doit pas confondre les cures reprises
--    avec les vraies : elles n'ont pas de mode de règlement.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS programmes_origine_idx
  ON programmes (origine) WHERE origine = 'import_v1';
