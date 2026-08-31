/*
  MAbeautyplus V2 — Migration 002 : fiches clientes et miroir Airtable

  À exécuter après la migration 001, dans le même projet.

  Contenu
    1. Table clientes           — la fiche, avec l'id Airtable stocké
    2. Table airtable_sync      — la file d'attente de synchronisation
    3. Déclencheur d'envoi      — toute création / modification alimente la file
    4. RLS                      — un compte ne voit que les clientes de son centre
*/

-- ---------------------------------------------------------------------------
-- 1. CLIENTES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clientes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id           text NOT NULL REFERENCES centres(id),

  prenom              text NOT NULL,
  nom                 text NOT NULL,
  email               text,
  telephone           text,
  date_naissance      date,
  age                 integer CHECK (age IS NULL OR (age > 0 AND age < 120)),
  adresse             text,
  code_postal         text,
  ville               text,
  source              text,                     -- « comment nous avez-vous connu ? »

  therapeutes         text[] NOT NULL DEFAULT '{}',

  -- Miroir Airtable : renseigné à la première synchro, ne change plus jamais.
  airtable_record_id  text UNIQUE,

  -- Traçabilité de la transition V1 → V2.
  origine             text NOT NULL DEFAULT 'v2' CHECK (origine IN ('v2', 'import_v1')),
  origine_ref         text,                     -- identifiant Firestore si repris de la V1

  archivee_le         timestamptz,
  cree_le             timestamptz NOT NULL DEFAULT now(),
  maj_le              timestamptz NOT NULL DEFAULT now(),
  cree_par            uuid DEFAULT auth.uid()
);

COMMENT ON COLUMN clientes.airtable_record_id IS
  'Identifiant de l''enregistrement Airtable. Remplace la recherche par nom + prénom + centre de la V1.';
COMMENT ON COLUMN clientes.therapeutes IS
  'Prénoms sélectionnés à la main. La connexion se faisant par centre, la thérapeute est choisie sur la fiche.';

CREATE INDEX IF NOT EXISTS clientes_centre_idx  ON clientes (centre_id) WHERE archivee_le IS NULL;
CREATE INDEX IF NOT EXISTS clientes_nom_idx     ON clientes (centre_id, lower(nom), lower(prenom));
CREATE INDEX IF NOT EXISTS clientes_creation_idx ON clientes (centre_id, cree_le DESC);

-- Recherche plein texte simple sur nom / prénom / email / téléphone.
CREATE INDEX IF NOT EXISTS clientes_recherche_idx ON clientes
  USING gin (to_tsvector('simple',
    coalesce(prenom,'') || ' ' || coalesce(nom,'') || ' ' ||
    coalesce(email,'')  || ' ' || coalesce(telephone,'')));

CREATE OR REPLACE FUNCTION touch_maj_le()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.maj_le := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clientes_maj_le ON clientes;
CREATE TRIGGER clientes_maj_le BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

-- ---------------------------------------------------------------------------
-- 2. FILE D'ATTENTE AIRTABLE
--    L'écriture en base n'est jamais bloquée par Airtable. Une fonction Edge
--    dépile cette table, avec réessai et journal des erreurs.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS airtable_sync (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entite            text NOT NULL,
  entite_id         uuid NOT NULL,
  statut            text NOT NULL DEFAULT 'en_attente'
                      CHECK (statut IN ('en_attente', 'en_cours', 'ok', 'erreur')),
  tentatives        integer NOT NULL DEFAULT 0,
  derniere_erreur   text,
  cree_le           timestamptz NOT NULL DEFAULT now(),
  traite_le         timestamptz
);

-- Une seule tâche en attente par entité : les modifications successives
-- fusionnent au lieu de créer une tâche par frappe clavier (défaut de la V1).
CREATE UNIQUE INDEX IF NOT EXISTS airtable_sync_en_attente_unique
  ON airtable_sync (entite, entite_id) WHERE statut IN ('en_attente', 'erreur');

CREATE INDEX IF NOT EXISTS airtable_sync_a_traiter_idx
  ON airtable_sync (cree_le) WHERE statut IN ('en_attente', 'erreur');

-- ---------------------------------------------------------------------------
-- 3. DÉCLENCHEUR
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enfiler_airtable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO airtable_sync (entite, entite_id)
  VALUES (TG_ARGV[0], NEW.id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clientes_vers_airtable ON clientes;
CREATE TRIGGER clientes_vers_airtable
  AFTER INSERT OR UPDATE OF prenom, nom, email, telephone, date_naissance, age,
                            adresse, code_postal, ville, source, therapeutes
  ON clientes
  FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('cliente');

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE airtable_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_lecture ON clientes;
CREATE POLICY clientes_lecture ON clientes FOR SELECT TO authenticated
  USING (acces_centre(centre_id));

DROP POLICY IF EXISTS clientes_creation ON clientes;
CREATE POLICY clientes_creation ON clientes FOR INSERT TO authenticated
  WITH CHECK (acces_centre(centre_id));

DROP POLICY IF EXISTS clientes_modification ON clientes;
CREATE POLICY clientes_modification ON clientes FOR UPDATE TO authenticated
  USING (acces_centre(centre_id)) WITH CHECK (acces_centre(centre_id));

-- Suppression réservée à la direction : on archive, on ne supprime pas.
DROP POLICY IF EXISTS clientes_suppression ON clientes;
CREATE POLICY clientes_suppression ON clientes FOR DELETE TO authenticated
  USING (est_direction());

-- La file de synchro est lisible (écran de contrôle) mais écrite par le serveur.
DROP POLICY IF EXISTS airtable_sync_lecture ON airtable_sync;
CREATE POLICY airtable_sync_lecture ON airtable_sync FOR SELECT TO authenticated
  USING (true);
