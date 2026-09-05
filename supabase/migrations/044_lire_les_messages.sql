/*
  MAbeautyplus V2 — Migration 044 : les messages se laissent enfin lire

  CE QUI N'ALLAIT PAS.

  La 043 posait deux règles de lecture qui se renvoyaient l'une à l'autre :

    pour lire un MESSAGE, on regardait dans messages_destinataires si le
    message nous était adressé ;

    pour lire un DESTINATAIRE, on regardait dans messages si on était
    l'auteur du message.

  Chacune est juste prise seule. Ensemble, elles tournent en rond, et
  PostgreSQL refuse la requête entière avec « infinite recursion detected in
  policy ». Résultat : personne ne lisait rien — ni les thérapeutes, ni la
  direction, alors même que les annonces étaient bien écrites en base. La
  pastille du menu, elle, continuait de compter : elle passe par une
  fonction SECURITY DEFINER, qui ne s'arrête pas à ces règles. Un compteur
  juste au-dessus de deux listes vides : le symptôme exact.

  CE QU'ON FAIT.

  On sort les deux questions des règles et on les pose à deux fonctions.
  Une fonction SECURITY DEFINER répond pour son propriétaire, donc sans
  repasser par les règles de lecture : la boucle est coupée. Les deux ne
  parlent que de la personne connectée — « suis-je destinataire de ce
  message », « ai-je écrit ce message » —, elles ne peuvent donc rien
  révéler que la règle n'accordait déjà.

  Les autres règles de la 043 ne sont pas touchées : elles ne traversaient
  aucune autre table.
*/

-- ===========================================================================
-- 1. LES DEUX QUESTIONS, POSÉES HORS DES RÈGLES
-- ===========================================================================

CREATE OR REPLACE FUNCTION est_destinataire(p_message uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM messages_destinataires d
     WHERE d.message_id = p_message
       AND d.therapeute_id = therapeute_courante()
  );
$$;

REVOKE ALL ON FUNCTION est_destinataire(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION est_destinataire(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION a_ecrit_le_message(p_message uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM messages m
     WHERE m.id = p_message
       AND m.auteur_id = therapeute_courante()
  );
$$;

REVOKE ALL ON FUNCTION a_ecrit_le_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION a_ecrit_le_message(uuid) TO authenticated;

-- ===========================================================================
-- 2. LES MÊMES RÈGLES, SANS LA BOUCLE
--
--    Qui voit quoi n'a pas changé d'un pouce. Seule la façon de le demander
--    change.
-- ===========================================================================

DROP POLICY IF EXISTS messages_lecture ON messages;
CREATE POLICY messages_lecture ON messages FOR SELECT TO authenticated
  USING (
    est_direction()
    OR auteur_id = therapeute_courante()
    OR est_destinataire(id)
  );

DROP POLICY IF EXISTS destinataires_lecture ON messages_destinataires;
CREATE POLICY destinataires_lecture ON messages_destinataires FOR SELECT TO authenticated
  USING (
    est_direction()
    OR therapeute_id = therapeute_courante()
    OR a_ecrit_le_message(message_id)
  );
