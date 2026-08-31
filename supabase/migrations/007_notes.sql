/*
  MAbeautyplus V2 — Migration 007 : notes entre thérapeutes

  Un fil de notes par cliente. Chaque note porte son auteur et sa date :
  c'est un journal, pas un champ libre que la suivante écrase.

  Une note peut être épinglée. Les notes épinglées remontent en tête et
  s'affichent sur la fiche : « allergie », « ne pas appeler avant 10 h »,
  ce genre d'information qui ne doit pas se perdre dans l'historique.
*/

CREATE TABLE IF NOT EXISTS notes_cliente (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  centre_id     text NOT NULL REFERENCES centres(id),
  therapeute_id uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),

  -- Prénom figé au moment de l'écriture : la note reste lisible même si la
  -- thérapeute quitte le centre.
  auteur        text NOT NULL DEFAULT '',

  texte         text NOT NULL CHECK (length(trim(texte)) > 0),
  epinglee      boolean NOT NULL DEFAULT false,
  cree_le       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_cliente_idx
  ON notes_cliente (cliente_id, epinglee DESC, cree_le DESC);
CREATE INDEX IF NOT EXISTS notes_centre_idx ON notes_cliente (centre_id);

-- Résumé par cliente, pour le bouton de la liste des clientes.
CREATE OR REPLACE VIEW notes_resume WITH (security_invoker = true) AS
SELECT
  cliente_id,
  centre_id,
  COUNT(*)                       AS nb,
  MAX(cree_le)                   AS derniere_le,
  BOOL_OR(epinglee)              AS a_epinglee
FROM notes_cliente
GROUP BY cliente_id, centre_id;

COMMENT ON VIEW notes_resume IS
  'Nombre de notes et présence d''une note épinglée, par cliente.';

-- ---------------------------------------------------------------------------
-- RLS : cloisonnement par centre, comme le reste
-- ---------------------------------------------------------------------------

ALTER TABLE notes_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_lecture ON notes_cliente;
CREATE POLICY notes_lecture ON notes_cliente FOR SELECT TO authenticated
  USING (acces_centre(centre_id));

DROP POLICY IF EXISTS notes_ecriture ON notes_cliente;
CREATE POLICY notes_ecriture ON notes_cliente FOR INSERT TO authenticated
  WITH CHECK (acces_centre(centre_id));

-- Épingler ou désépingler reste ouvert à tout le centre : c'est une
-- information d'équipe, pas la propriété de celle qui l'a écrite.
DROP POLICY IF EXISTS notes_modification ON notes_cliente;
CREATE POLICY notes_modification ON notes_cliente FOR UPDATE TO authenticated
  USING (acces_centre(centre_id)) WITH CHECK (acces_centre(centre_id));

-- En revanche, on ne supprime que ses propres notes. La direction peut tout.
DROP POLICY IF EXISTS notes_suppression ON notes_cliente;
CREATE POLICY notes_suppression ON notes_cliente FOR DELETE TO authenticated
  USING (est_direction() OR therapeute_id = therapeute_courante());
