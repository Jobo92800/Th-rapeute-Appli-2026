/*
  MAbeautyplus V2 — Migration 048 : l'état des comptes, dans l'application

  POURQUOI.

  Quand un compte « ne marche plus », la réponse tenait jusqu'ici dans un
  fichier SQL à coller dans Supabase (`diagnostics/qui_peut_se_connecter`).
  C'est un détour que la direction n'a aucune raison de faire : la question
  se pose au téléphone, avec une thérapeute qui attend.

  CE QUE ÇA DIT.

  Se connecter et se servir de l'application sont deux choses distinctes,
  et elles se séparent. Supabase vérifie l'adresse et le mot de passe ;
  l'application cherche ensuite la fiche rattachée à ce compte
  (`therapeutes.user_id = auth.uid()`) et la veut active. Cette fonction
  regarde les deux côtés à la fois et nomme ce qui cloche.

  CE QUE ÇA NE DIT PAS.

  Aucun mot de passe, ni en clair ni chiffré : ils ne sortent pas de
  Supabase Auth, et cette fonction n'y touche pas. Un mot de passe faux
  reste indiscernable d'un mot de passe oublié — c'est la nature de la
  chose, pas une lacune du diagnostic.

  DIRECTION SEULE. La fonction lit `auth.users`, ce qu'aucune thérapeute ne
  doit pouvoir faire. Elle est en SECURITY DEFINER — donc elle passe outre
  les règles de sécurité — et vérifie elle-même le rôle de l'appelant avant
  de répondre. Sans ce garde-fou, on ouvrirait la liste des comptes à tout
  le monde.
*/

CREATE OR REPLACE FUNCTION etat_des_comptes()
RETURNS TABLE (
  therapeute_id      uuid,
  prenom             text,
  nom                text,
  email              text,
  centre_id          text,
  centre_nom         text,
  role               text,
  actif              boolean,
  a_un_compte        boolean,
  email_confirme     boolean,
  derniere_connexion timestamptz,
  diagnostic         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT est_direction() THEN
    RAISE EXCEPTION 'Réservé à la direction.';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.prenom,
    t.nom,
    t.email,
    t.centre_id,
    c.nom,
    t.role,
    t.actif,
    (u.id IS NOT NULL)              AS a_un_compte,
    (u.email_confirmed_at IS NOT NULL) AS email_confirme,
    u.last_sign_in_at,
    CASE
      WHEN t.email IS NULL      THEN 'Aucune adresse sur la fiche : rien à relier.'
      WHEN u.id IS NULL         THEN 'Aucun compte Supabase pour cette adresse — à créer (Authentication → Add user, Auto Confirm coché), puis relancer le rattachement.'
      WHEN t.user_id IS NULL    THEN 'Le compte existe mais la fiche ne lui est pas reliée — relancer le rattachement.'
      WHEN t.user_id <> u.id    THEN 'La fiche pointe sur un compte qui n''existe plus (compte supprimé puis recréé) — relancer le rattachement.'
      WHEN NOT t.actif          THEN 'Fiche inactive : la connexion réussit, mais l''application ne trouve personne derrière.'
      WHEN u.email_confirmed_at IS NULL
                                THEN 'Email jamais confirmé : la connexion est refusée. Cocher Auto Confirm, ou confirmer le compte dans Supabase.'
      ELSE 'ok'
    END
  FROM therapeutes t
  LEFT JOIN centres c   ON c.id = t.centre_id
  LEFT JOIN auth.users u ON lower(u.email) = lower(t.email)
  ORDER BY t.role DESC, c.nom NULLS FIRST, t.prenom;
END $$;

COMMENT ON FUNCTION etat_des_comptes() IS
  'Qui peut se connecter, et ce qui bloque quand ça ne marche pas. Direction seule.';

-- La règle depuis la 040 : chaque fonction porte son propre droit.
REVOKE ALL ON FUNCTION etat_des_comptes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION etat_des_comptes() TO authenticated;

-- Contrôle : doit renvoyer une ligne par thérapeute si vous êtes direction,
-- « Réservé à la direction. » sinon.
SELECT prenom, email, diagnostic FROM etat_des_comptes();
