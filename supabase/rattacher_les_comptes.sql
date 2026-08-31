/*
  MAbeautyplus V2 — relier les comptes de connexion aux thérapeutes.

  À lancer APRÈS avoir créé un ou plusieurs utilisateurs dans
  Authentication > Users. Il traite tout le monde d'un coup et se rejoue
  autant de fois que nécessaire : relance-le simplement à chaque fois que
  tu ajoutes des comptes.
*/

-- ---------------------------------------------------------------------------
-- 1. Rattachement sur l'email exact
-- ---------------------------------------------------------------------------

UPDATE therapeutes t
SET user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(t.email)
  AND t.user_id IS DISTINCT FROM u.id;

/*
  2. Rattrapage sur le début de l'adresse

  « caroll@mabeautyplus.com » et « caroll@mabeautyplus.fr » désignent la même
  personne : seul le domaine diffère. Plutôt que de laisser une coquille
  bloquer une connexion, on rattache sur la partie avant l'arobase et on
  aligne la table sur l'adresse réellement créée.

  Ne s'applique qu'aux thérapeutes sans compte, et qu'aux comptes pas encore
  rattachés : aucun risque de voler le compte de quelqu'un d'autre.
*/

UPDATE therapeutes t
SET user_id = u.id,
    email   = lower(u.email)
FROM auth.users u
WHERE t.user_id IS NULL
  AND split_part(lower(u.email), '@', 1) = split_part(lower(t.email), '@', 1)
  AND NOT EXISTS (SELECT 1 FROM therapeutes x WHERE x.user_id = u.id);

-- ---------------------------------------------------------------------------
-- 3. Qui peut se connecter, qui reste à créer
-- ---------------------------------------------------------------------------

SELECT
  COALESCE(c.nom, '— tous les centres') AS centre,
  t.prenom,
  t.email,
  t.role,
  CASE WHEN t.user_id IS NULL THEN 'COMPTE À CRÉER' ELSE 'peut se connecter' END AS statut
FROM therapeutes t
LEFT JOIN centres c ON c.id = t.centre_id
ORDER BY (t.user_id IS NOT NULL), c.nom NULLS FIRST, t.ordre;
