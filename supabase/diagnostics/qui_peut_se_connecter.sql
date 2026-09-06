/*
  MAbeautyplus V2 — pourquoi un compte « ne marche plus »

  NE MODIFIE RIEN. À coller dans l'éditeur SQL de Supabase, projet
  MAbeautyplus V2, et à relancer autant de fois qu'on veut.

  CE QU'IL FAUT COMPRENDRE D'ABORD. Se connecter et se servir de
  l'application sont deux choses différentes, et elles peuvent se séparer.

    Supabase vérifie l'adresse et le mot de passe. C'est la connexion.

    L'application, elle, cherche ensuite la fiche thérapeute rattachée à ce
    compte — `therapeutes.user_id = auth.uid()` — et elle exige que cette
    fiche soit ACTIVE. Sans elle, la personne est bien connectée mais
    l'application ne sait pas qui elle est : plus de centre, plus de
    clientes, plus rien.

  Deux causes possibles à ce décrochage, et ce diagnostic les sépare.

    LE LIEN EST MORT. Le compte Supabase a été supprimé puis recréé — c'est
    ce qui arrive quand on « refait » un compte pour changer un mot de passe.
    Le nouveau compte porte un identifiant neuf, et la fiche pointe encore
    sur l'ancien, qui n'existe plus.

    LA FICHE EST INACTIVE. Elle a été désactivée par une migration ou à la
    main. Le compte marche, la fiche ne répond plus.
*/

-- ===========================================================================
-- 1. CHAQUE COMPTE DE CONNEXION, ET CE QU'IL TROUVE
-- ===========================================================================

SELECT
  u.email                                        AS compte,
  u.last_sign_in_at                              AS derniere_connexion,
  t.prenom,
  t.email                                        AS email_de_la_fiche,
  t.actif,
  t.role,
  CASE
    WHEN t.id IS NULL AND EXISTS (
           SELECT 1 FROM therapeutes x
            WHERE lower(x.email) = lower(u.email))
      THEN 'LIEN ROMPU — une fiche porte cette adresse mais ne pointe pas sur ce compte'
    WHEN t.id IS NULL
      THEN 'AUCUNE FICHE — la connexion réussit, l''application reste vide'
    WHEN NOT t.actif
      THEN 'FICHE INACTIVE — remettre actif = true'
    ELSE 'ok'
  END                                            AS diagnostic
FROM auth.users u
LEFT JOIN therapeutes t ON t.user_id = u.id AND t.actif
ORDER BY (t.id IS NOT NULL), u.email;

-- ===========================================================================
-- 2. LES FICHES QUI POINTENT SUR UN COMPTE DISPARU
--
--    C'est la cause la plus fréquente d'un compte « qui marchait avant » :
--    il a été supprimé puis recréé, et l'identifiant a changé.
-- ===========================================================================

SELECT t.prenom, t.email, t.user_id AS compte_introuvable
FROM therapeutes t
WHERE t.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id);

-- ===========================================================================
-- 3. DEUX FICHES SUR LE MÊME COMPTE
--
--    Ne devrait jamais arriver. Si ça arrive, `therapeute_courante()` rend
--    l'une des deux au hasard, et la personne change de centre d'une
--    connexion à l'autre.
-- ===========================================================================

SELECT user_id, count(*) AS fiches, string_agg(prenom || ' (' || email || ')', ', ') AS lesquelles
FROM therapeutes
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING count(*) > 1;
