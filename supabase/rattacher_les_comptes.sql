/*
  MAbeautyplus V2 — relier les comptes de connexion aux thérapeutes.

  À exécuter après avoir créé des utilisateurs dans Authentication > Users.
  Le lien se fait sur l'adresse email.

  Ce script est rejouable autant de fois que nécessaire : lance-le à chaque
  fois que tu ajoutes un compte, il ne rattachera que les nouveaux.
*/

UPDATE therapeutes t
SET user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(t.email)
  AND t.user_id IS DISTINCT FROM u.id;

-- État de chaque personne : qui peut se connecter, qui ne peut pas encore.
SELECT
  COALESCE(c.nom, '— tous les centres') AS centre,
  t.prenom,
  t.email,
  t.role,
  CASE WHEN t.user_id IS NULL THEN 'compte à créer' ELSE 'peut se connecter' END AS statut
FROM therapeutes t
LEFT JOIN centres c ON c.id = t.centre_id
ORDER BY c.nom NULLS FIRST, t.ordre;
