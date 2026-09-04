/*
  MAbeautyplus V2 — Migration 042 : l'équipe telle qu'elle est au lancement

  Les adresses courtes — prenom@mabeautyplus.fr — étaient déjà posées par la
  migration 004. Trois seulement portaient la forme longue, parce que trois
  Alexandra travaillaient alors dans trois centres et qu'il fallait bien les
  distinguer.

  Il n'en reste qu'une. Le problème disparaît, et les adresses longues avec.

  CE QUI CHANGE.

    Le Crès    « Alexandra » devient « Alex », et son adresse passe de
               alexandra.lecres@ à alex@ — c'est ainsi qu'on l'appelle.

    Avignon    « Alexandra 2 » redevient « Alexandra », et son adresse
               alexandra.avignon@ devient alexandra@. Le « 2 » était un
               pis-aller du socle.

    Trois départs — Paola au Crès, Audrey et Alexandra C à Cabestany. Elles
    sont retirées des listes, **pas effacées** : les fiches qu'elles ont
    remplies, les séances qu'elles ont clôturées et les ventes qu'elles ont
    enregistrées gardent leur nom. C'est toute la différence entre archiver
    et supprimer, et c'est la règle de la maison.

    Flora quitte la liste des thérapeutes du Crès : elle fait partie de la
    direction. Elle en sort donc du menu déroulant des fiches. Je ne lui ai
    **pas** donné pour autant un compte de direction : ce rôle ouvre le
    tableau de bord des cinq centres et la suppression définitive d'un
    dossier. Ça se décide, ça ne se déduit pas. Une ligne suffira le jour où
    vous le voudrez :

      UPDATE therapeutes
         SET role = 'direction', centre_id = NULL, actif = true
       WHERE email = 'flora@mabeautyplus.fr';

  L'ÉQUIPE APRÈS CETTE MIGRATION — treize thérapeutes, une direction :

    Le Grau-du-Roi   Marie · Nadia · Stéphanie · Fanny
    Le Crès          Alex · Malvina
    Sérignan         Caroll · Aude · Marie-san
    Cabestany        Marine · Sara
    Avignon          Alexandra · Laura
*/

-- ===========================================================================
-- 1. LES DEUX PRÉNOMS À REMETTRE D'APLOMB
--
--    Renommer ne perd rien : fiches, séances et ventes pointent sur
--    l'identifiant, jamais sur le prénom. Elles suivent toutes seules.
-- ===========================================================================

UPDATE therapeutes SET prenom = 'Alex'
 WHERE centre_id = 'le-cres' AND prenom = 'Alexandra';

UPDATE therapeutes SET prenom = 'Alexandra'
 WHERE centre_id = 'avignon' AND prenom = 'Alexandra 2';

-- ===========================================================================
-- 2. LEURS ADRESSES, RACCOURCIES
--
--    Elles se tapent chaque matin, souvent sur un clavier partagé : le plus
--    court est le meilleur. Aucune collision possible — alex et alexandra,
--    marie, marie-san et marine sont bien cinq adresses différentes.
-- ===========================================================================

UPDATE therapeutes SET email = 'alex@mabeautyplus.fr'
 WHERE centre_id = 'le-cres' AND prenom = 'Alex';

UPDATE therapeutes SET email = 'alexandra@mabeautyplus.fr'
 WHERE centre_id = 'avignon' AND prenom = 'Alexandra';

-- ===========================================================================
-- 3. LES DÉPARTS, ET FLORA
--
--    `actif = false` les retire des menus déroulants sans toucher à une
--    seule ligne de leur travail passé.
-- ===========================================================================

UPDATE therapeutes SET actif = false
 WHERE (centre_id, prenom) IN (
   ('le-cres',   'Paola'),
   ('cabestany', 'Audrey'),
   ('cabestany', 'Alexandra C'),
   ('le-cres',   'Flora')       -- direction, pas thérapeute au Crès
 );

-- ===========================================================================
-- 4. L'ORDRE D'AFFICHAGE
--
--    Les départs laissaient des trous dans la numérotation. On resserre,
--    pour que les menus déroulants se lisent dans un ordre net.
-- ===========================================================================

WITH rang AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY centre_id ORDER BY ordre, prenom) AS n
    FROM therapeutes
   WHERE actif AND centre_id IS NOT NULL
)
UPDATE therapeutes t SET ordre = rang.n
  FROM rang WHERE rang.id = t.id AND t.ordre IS DISTINCT FROM rang.n;

-- ===========================================================================
-- 5. LE CONTRÔLE
--
--    Treize thérapeutes et la Direction, chacune avec son adresse. C'est
--    cette liste qui sert à créer les comptes dans Supabase.
-- ===========================================================================

SELECT
  COALESCE(c.nom, '— tous les centres') AS centre,
  t.prenom,
  t.email                               AS adresse_de_connexion,
  CASE WHEN t.user_id IS NULL THEN 'compte à créer' ELSE 'peut se connecter' END AS etat
FROM therapeutes t
LEFT JOIN centres c ON c.id = t.centre_id
WHERE t.actif
ORDER BY c.nom NULLS FIRST, t.ordre;
