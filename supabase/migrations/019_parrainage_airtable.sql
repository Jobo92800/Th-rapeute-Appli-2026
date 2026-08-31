/*
  MAbeautyplus V2 — Migration 019 : le parrainage remonte dans Airtable

  Quatre champs ont été créés dans la table Clients : « Parrain »,
  « Filleules », « Filleules engagées » et « Séances offertes restantes ».
  C'est la fonction Edge qui les remplit ; il reste à dire quand.

  Le cas qui compte n'est pas évident : quand une filleule signe son
  contrat, c'est la fiche de **sa marraine** qui change de valeur — pas la
  sienne. Sans le déclencheur ci-dessous, le CRM annoncerait toujours zéro
  filleule engagée, et personne ne serait relancé.
*/

-- ---------------------------------------------------------------------------
-- 1. Le parrainage part avec la fiche
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS clientes_vers_airtable ON clientes;
CREATE TRIGGER clientes_vers_airtable
  AFTER INSERT OR UPDATE OF prenom, nom, email, telephone, date_naissance, age,
                            adresse, code_postal, ville, source, therapeutes,
                            parcours_audio, acces_audio_le, parrain_id, parrain_libre
  ON clientes
  FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('cliente');

-- ---------------------------------------------------------------------------
-- 2. La filleule signe : c'est la marraine qu'il faut renvoyer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enfiler_marraine()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_marraine uuid;
BEGIN
  SELECT c.parrain_id INTO v_marraine FROM clientes c WHERE c.id = NEW.cliente_id;

  IF v_marraine IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO airtable_sync (entite, entite_id)
  VALUES ('cliente', v_marraine)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contrats_vers_marraine ON contrats;
CREATE TRIGGER contrats_vers_marraine
  AFTER INSERT ON contrats
  FOR EACH ROW EXECUTE FUNCTION enfiler_marraine();

-- ---------------------------------------------------------------------------
-- 3. Les séances offertes posées sur une cure : le solde a changé
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enfiler_cliente_du_programme()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_cliente uuid;
BEGIN
  IF COALESCE(NEW.seances_offertes, 0) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT p.cliente_id INTO v_cliente FROM programmes p WHERE p.id = NEW.programme_id;

  IF v_cliente IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO airtable_sync (entite, entite_id)
  VALUES ('cliente', v_cliente)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS programme_lignes_vers_airtable ON programme_lignes;
CREATE TRIGGER programme_lignes_vers_airtable
  AFTER INSERT OR UPDATE OF seances_offertes ON programme_lignes
  FOR EACH ROW EXECUTE FUNCTION enfiler_cliente_du_programme();
