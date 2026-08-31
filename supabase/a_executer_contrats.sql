/*
  MAbeautyplus V2 — Migration 008 : contrats et consentements signés

  Les PDF sont stockés dans la base, sous les mêmes règles d'accès que le
  reste. L'ancienne application les déposait dans un bucket public : une URL
  devinée suffisait alors à lire un contrat nominatif avec adresse, téléphone
  et montants. Ici, il faut être connecté et rattaché au bon centre.
*/

CREATE TABLE IF NOT EXISTS contrats (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  programme_id   uuid REFERENCES programmes(id) ON DELETE SET NULL,
  centre_id      text NOT NULL REFERENCES centres(id),
  therapeute_id  uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),

  nom_cliente    text NOT NULL DEFAULT '',
  signe_le       timestamptz NOT NULL DEFAULT now(),

  -- Le PDF complet, en base64. Postgres le stocke hors ligne (TOAST) :
  -- la table reste légère tant qu'on ne demande pas la colonne.
  pdf_base64     text NOT NULL,

  -- L'état exact du contrat au moment de la signature : montants, échéances,
  -- coordonnées. Il ne doit pas bouger si la cure est modifiée ensuite.
  donnees        jsonb NOT NULL DEFAULT '{}'::jsonb,

  envoye_le      timestamptz,
  envoye_a       text,

  cree_le        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contrats_cliente_idx ON contrats (cliente_id, signe_le DESC);
CREATE INDEX IF NOT EXISTS contrats_centre_idx  ON contrats (centre_id, signe_le DESC);

CREATE TABLE IF NOT EXISTS consentements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id   uuid NOT NULL REFERENCES contrats(id) ON DELETE CASCADE,
  service_id   text NOT NULL,
  nom_fichier  text NOT NULL,
  pdf_base64   text NOT NULL,
  cree_le      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consentements_contrat_idx ON consentements (contrat_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE contrats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE consentements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contrats_acces ON contrats;
CREATE POLICY contrats_acces ON contrats FOR ALL TO authenticated
  USING (acces_centre(centre_id)) WITH CHECK (acces_centre(centre_id));

-- Les consentements suivent l'accès de leur contrat.
DROP POLICY IF EXISTS consentements_acces ON consentements;
CREATE POLICY consentements_acces ON consentements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM contrats c WHERE c.id = contrat_id AND acces_centre(c.centre_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM contrats c WHERE c.id = contrat_id AND acces_centre(c.centre_id)));

-- ---------------------------------------------------------------------------
-- Liste des contrats sans les PDF : la fiche affiche l'historique sans
-- télécharger plusieurs centaines de kilo-octets à chaque ouverture.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW contrats_resume WITH (security_invoker = true) AS
SELECT
  c.id,
  c.cliente_id,
  c.programme_id,
  c.centre_id,
  c.nom_cliente,
  c.signe_le,
  c.envoye_le,
  c.envoye_a,
  t.prenom AS therapeute,
  (c.donnees ->> 'totalAmount')          AS montant,
  COUNT(cs.id)                           AS nb_consentements
FROM contrats c
LEFT JOIN therapeutes t   ON t.id = c.therapeute_id
LEFT JOIN consentements cs ON cs.contrat_id = c.id
GROUP BY c.id, t.prenom;


/*
  MAbeautyplus V2 — Migration 011 : les contrats partent dans Airtable

  À exécuter APRÈS la migration 008, qui crée les tables contrats et
  consentements.

  Les PDF sont envoyés dans les champs pièces jointes « Contrat » et
  « Consentements » de la table Clients. La thérapeute peut alors les
  transmettre directement depuis Airtable.

  L'envoi se fait par l'API de contenu d'Airtable, qui accepte le fichier
  encodé en base64. Aucun lien public n'est créé : contrairement à
  l'ancienne application, un contrat nominatif ne se retrouve pas
  accessible à qui devine une URL.
*/

-- Marque le moment où les pièces jointes sont arrivées dans Airtable.
-- Sert de garde-fou : une tâche rejouée ne réenverra pas les mêmes PDF.
ALTER TABLE contrats
  ADD COLUMN IF NOT EXISTS airtable_le timestamptz;

COMMENT ON COLUMN contrats.airtable_le IS
  'Horodatage de l''envoi des pièces jointes vers Airtable. Empêche un double envoi si la tâche est rejouée.';

DROP TRIGGER IF EXISTS contrats_vers_airtable ON contrats;
CREATE TRIGGER contrats_vers_airtable
  AFTER INSERT ON contrats
  FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('contrat');
