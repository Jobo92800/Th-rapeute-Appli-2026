/*
  MAbeautyplus V2 — Migration 043 : les messages internes

  Deux besoins qui se ressemblent et qu'il ne faut surtout pas confondre,
  parce que leur état utile n'est pas le même.

    UNE ANNONCE part de la direction vers une ou plusieurs thérapeutes.
    « Les tarifs changent lundi », « fermeture exceptionnelle jeudi ». Ce
    qu'on veut savoir, c'est **qui l'a lue**. Il n'y a rien à « traiter ».

    UN SIGNALEMENT part d'une thérapeute vers la direction. « Le bouton
    Valider ne répond pas », « le stock de tenues M est faux ». Ce qu'on
    veut savoir, c'est **où en est le traitement** : nouveau, en cours,
    traité, ou sans suite.

  D'où deux notions distinctes dans le même socle : un statut de traitement
  porté par le message, et une date de lecture portée par chaque
  destinataire. Un seul « statut » pour les deux aurait obligé à répondre
  « traité » à une annonce, ce qui ne veut rien dire.

  CE QU'ON NE FAIT PAS. Pas de conversation à plusieurs allers-retours, pas
  de pièce jointe, pas de messagerie entre thérapeutes. C'est un carnet de
  liaison, pas une messagerie. La direction peut écrire une réponse — une
  seule, celle qui clôt le sujet — et elle s'affiche sous le message.
*/

-- ===========================================================================
-- 1. LES MESSAGES
-- ===========================================================================

CREATE TABLE IF NOT EXISTS messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL CHECK (type IN ('annonce', 'signalement')),

  auteur_id     uuid REFERENCES therapeutes(id) ON DELETE SET NULL
                  DEFAULT therapeute_courante(),
  /*
    Le prénom est figé à l'écriture, comme sur les notes de fiche : le
    message reste lisible même si la personne quitte les centres.
  */
  auteur        text NOT NULL DEFAULT '',
  /* Le centre depuis lequel il a été écrit. Nul pour la direction. */
  centre_id     text REFERENCES centres(id),

  sujet         text NOT NULL CHECK (length(trim(sujet)) > 0),
  corps         text NOT NULL DEFAULT '',

  /*
    L'avancement du traitement. Il n'a de sens que pour un signalement :
    une annonce reste « nouveau » toute sa vie, et personne ne la regarde.
  */
  statut        text NOT NULL DEFAULT 'nouveau'
                  CHECK (statut IN ('nouveau', 'en_cours', 'traite', 'sans_suite')),

  /* La réponse de la direction, affichée sous le message. */
  reponse       text NOT NULL DEFAULT '',
  repondu_le    timestamptz,

  cree_le       timestamptz NOT NULL DEFAULT now(),
  maj_le        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_type_idx   ON messages (type, cree_le DESC);
CREATE INDEX IF NOT EXISTS messages_auteur_idx ON messages (auteur_id, cree_le DESC);
CREATE INDEX IF NOT EXISTS messages_a_traiter_idx
  ON messages (cree_le DESC) WHERE type = 'signalement' AND statut IN ('nouveau', 'en_cours');

DROP TRIGGER IF EXISTS messages_maj_le ON messages;
CREATE TRIGGER messages_maj_le BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

-- ===========================================================================
-- 2. QUI DOIT LIRE QUOI
--
--    Une ligne par destinataire d'annonce. Un signalement n'en a pas : son
--    destinataire est la direction, et la règle de sécurité suffit à le dire.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS messages_destinataires (
  message_id    uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  therapeute_id uuid NOT NULL REFERENCES therapeutes(id) ON DELETE CASCADE,
  lu_le         timestamptz,
  PRIMARY KEY (message_id, therapeute_id)
);

CREATE INDEX IF NOT EXISTS messages_non_lus_idx
  ON messages_destinataires (therapeute_id) WHERE lu_le IS NULL;

-- ===========================================================================
-- 3. QUI VOIT QUOI
-- ===========================================================================

ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_destinataires ENABLE ROW LEVEL SECURITY;

/*
  Une thérapeute voit les annonces qui lui sont adressées et ses propres
  signalements — pas ceux de ses collègues : un signalement peut dire « le
  stock que Marie a compté est faux », et ça se règle avec la direction.
*/
DROP POLICY IF EXISTS messages_lecture ON messages;
CREATE POLICY messages_lecture ON messages FOR SELECT TO authenticated
  USING (
    est_direction()
    OR auteur_id = therapeute_courante()
    OR EXISTS (
      SELECT 1 FROM messages_destinataires d
       WHERE d.message_id = messages.id AND d.therapeute_id = therapeute_courante()
    )
  );

/*
  Chacune écrit en son nom. Une thérapeute ne peut déposer qu'un
  signalement : les annonces sont le fait de la direction, et personne ne
  doit pouvoir écrire au nom de tout le monde.
*/
DROP POLICY IF EXISTS messages_ecriture ON messages;
CREATE POLICY messages_ecriture ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auteur_id = therapeute_courante()
    AND (type = 'signalement' OR est_direction())
  );

/*
  Le statut et la réponse appartiennent à la direction. L'autrice d'un
  signalement ne se répond pas « traité » à elle-même.
*/
DROP POLICY IF EXISTS messages_traitement ON messages;
CREATE POLICY messages_traitement ON messages FOR UPDATE TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

DROP POLICY IF EXISTS messages_suppression ON messages;
CREATE POLICY messages_suppression ON messages FOR DELETE TO authenticated
  USING (est_direction());

DROP POLICY IF EXISTS destinataires_lecture ON messages_destinataires;
CREATE POLICY destinataires_lecture ON messages_destinataires FOR SELECT TO authenticated
  USING (
    est_direction()
    OR therapeute_id = therapeute_courante()
    OR EXISTS (
      SELECT 1 FROM messages m
       WHERE m.id = messages_destinataires.message_id AND m.auteur_id = therapeute_courante()
    )
  );

DROP POLICY IF EXISTS destinataires_ecriture ON messages_destinataires;
CREATE POLICY destinataires_ecriture ON messages_destinataires FOR INSERT TO authenticated
  WITH CHECK (est_direction());

/* Chacune ne marque comme lu que ce qui lui est adressé. */
DROP POLICY IF EXISTS destinataires_lecture_marquee ON messages_destinataires;
CREATE POLICY destinataires_lecture_marquee ON messages_destinataires FOR UPDATE TO authenticated
  USING (therapeute_id = therapeute_courante())
  WITH CHECK (therapeute_id = therapeute_courante());

-- ===========================================================================
-- 4. ENVOYER UNE ANNONCE
--
--    Un seul geste : le message et ses destinataires, ou rien. Sans ça, une
--    coupure au mauvais moment laisserait une annonce que personne ne reçoit.
-- ===========================================================================

CREATE OR REPLACE FUNCTION envoyer_annonce(
  p_sujet         text,
  p_corps         text,
  p_destinataires uuid[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_id     uuid;
  v_auteur uuid := therapeute_courante();
  v_nom    text;
BEGIN
  IF NOT est_direction() THEN
    RAISE EXCEPTION 'Seule la direction envoie des annonces.';
  END IF;
  IF coalesce(array_length(p_destinataires, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Choisissez au moins une thérapeute.';
  END IF;
  IF length(trim(coalesce(p_sujet, ''))) = 0 THEN
    RAISE EXCEPTION 'Une annonce sans objet ne se lit pas : donnez-lui un titre.';
  END IF;

  SELECT prenom INTO v_nom FROM therapeutes WHERE id = v_auteur;

  INSERT INTO messages (type, auteur_id, auteur, sujet, corps)
  VALUES ('annonce', v_auteur, coalesce(v_nom, 'Direction'), trim(p_sujet), coalesce(p_corps, ''))
  RETURNING id INTO v_id;

  INSERT INTO messages_destinataires (message_id, therapeute_id)
  SELECT v_id, t.id
    FROM therapeutes t
   WHERE t.id = ANY (p_destinataires) AND t.actif;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION envoyer_annonce(text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION envoyer_annonce(text, text, uuid[]) TO authenticated;

-- ===========================================================================
-- 5. DÉPOSER UN SIGNALEMENT
-- ===========================================================================

CREATE OR REPLACE FUNCTION deposer_signalement(
  p_sujet text,
  p_corps text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_id     uuid;
  v_auteur uuid := therapeute_courante();
  v_nom    text;
  v_centre text;
BEGIN
  IF v_auteur IS NULL THEN
    RAISE EXCEPTION 'Ce compte n''est rattaché à aucune thérapeute.';
  END IF;
  IF length(trim(coalesce(p_sujet, ''))) = 0 THEN
    RAISE EXCEPTION 'Dites en une ligne ce qui ne va pas : c''est ce qui s''affichera dans la liste.';
  END IF;

  SELECT prenom, centre_id INTO v_nom, v_centre FROM therapeutes WHERE id = v_auteur;

  INSERT INTO messages (type, auteur_id, auteur, centre_id, sujet, corps)
  VALUES ('signalement', v_auteur, coalesce(v_nom, ''), v_centre, trim(p_sujet), coalesce(p_corps, ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION deposer_signalement(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION deposer_signalement(text, text) TO authenticated;

-- ===========================================================================
-- 6. CE QUI ATTEND CHACUNE
--
--    Le compteur de la pastille. Une seule requête plutôt qu'une par type :
--    elle est appelée à chaque changement d'écran.
-- ===========================================================================

CREATE OR REPLACE FUNCTION messages_en_attente()
RETURNS TABLE (annonces_non_lues integer, signalements_a_traiter integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT COUNT(*)::integer
       FROM messages_destinataires d
      WHERE d.therapeute_id = therapeute_courante() AND d.lu_le IS NULL),
    CASE WHEN est_direction() THEN
      (SELECT COUNT(*)::integer
         FROM messages m
        WHERE m.type = 'signalement' AND m.statut IN ('nouveau', 'en_cours'))
    ELSE 0 END;
$$;

REVOKE ALL ON FUNCTION messages_en_attente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION messages_en_attente() TO authenticated;
