/*
  MAbeautyplus V2 — Migration 055 : une thérapeute sans compte à elle

  LE CAS. Flora fait partie de la direction et vient aider le Crès de temps
  en temps. Elle se connecte avec le compte direction : pas de compte
  personnel. Mais elle doit figurer dans les menus du Crès, pour être nommée
  sur une fiche ou une séance — « qui a réalisé cette séance » compte.

  C'ÉTAIT PRÉVU DEPUIS LA 004, sans être assumé : « user_id vide = la
  personne est sélectionnable mais ne se connecte pas ». L'écran Comptes
  rangeait pourtant une fiche sans adresse parmi les pannes, en ambre, au
  milieu des comptes cassés. Une décision affichée comme une panne finit
  par être « réparée » par quelqu'un qui crée un compte de trop.

  CE QUE ÇA CHANGE. `etat_des_comptes` répond désormais `sans_compte` — un
  état, comme `ok` — quand la fiche n'a pas d'adresse. L'écran le montre en
  gris, sans bouton mot de passe. Et Flora revient en service au Crès, sans
  adresse ni compte. Le reste de la fonction est repris mot pour mot de la
  048.
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
      WHEN t.email IS NULL      THEN 'sans_compte'
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

REVOKE ALL ON FUNCTION etat_des_comptes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION etat_des_comptes() TO authenticated;

-- ---------------------------------------------------------------------------
-- Flora revient au Crès, sans compte à elle. Elle avait été retirée du
-- service par la 042. Sans adresse : c'est le compte direction qu'elle
-- utilise, et une adresse laissée là inviterait à créer un compte de trop.
-- ---------------------------------------------------------------------------
UPDATE therapeutes
   SET actif = true, email = NULL, user_id = NULL
 WHERE centre_id = 'le-cres' AND prenom = 'Flora';

-- Contrôle : Flora active au Crès, sans adresse, et la fonction ouverte aux
-- comptes connectés.
SELECT prenom, centre_id, actif, email, user_id
  FROM therapeutes WHERE centre_id = 'le-cres' ORDER BY actif DESC, ordre;

SELECT
  p.proname                                                 AS fonction,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ouverte_aux_connectes,
  NOT has_function_privilege('anon', p.oid, 'EXECUTE')      AS fermee_au_public
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'etat_des_comptes';
