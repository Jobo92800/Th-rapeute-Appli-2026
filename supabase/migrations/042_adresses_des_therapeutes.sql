/*
  MAbeautyplus V2 — Migration 042 : les adresses de connexion des thérapeutes

  Chaque thérapeute a son propre compte : c'est son nom qui reste sur les
  fiches qu'elle remplit, sur les séances qu'elle clôture et sur les ventes
  qu'elle enregistre. Un compte partagé rendrait tout ce suivi faux.

  Cette migration ne crée aucun compte de connexion — ça se fait dans
  Supabase, écran Authentication. Elle prépare le terrain : elle inscrit
  l'adresse attendue en face de chaque prénom, pour que le script
  `rattacher_les_comptes.sql` sache ensuite relier les deux.

  LA CONVENTION : prenom.centre@mabeautyplus.fr, sans accent ni majuscule.

  Le centre dans l'adresse n'est pas une coquetterie. Deux Alexandra
  travaillent déjà dans deux centres différents, et le socle avait dû en
  appeler une « Alexandra 2 » pour s'en sortir. Une adresse qui porte le
  centre ne se heurtera jamais à une homonyme, aujourd'hui ou dans trois ans.

  TROIS PRÉNOMS SONT CORRIGÉS AU PASSAGE. Le socle avait été rempli avec des
  approximations :

    · Le Crès    « Alexandra »   →  « Alex »       (c'est ainsi qu'on l'appelle)
    · Avignon    « Alexandra 2 » →  « Alexandra »  (le « 2 » était un pis-aller)

  Renommer ne perd rien : les fiches, séances et ventes pointent sur
  l'identifiant, pas sur le prénom. Elles suivent.

  CE QUE CETTE MIGRATION NE FAIT PAS. Quatre thérapeutes sont en base sans
  figurer dans la liste des comptes à créer : Paola et Flora au Crès, Audrey
  et Alexandra C à Cabestany. Elles restent **actives et sélectionnables sur
  les fiches** — ne pas donner un compte à quelqu'un ne veut pas dire qu'elle
  est partie. Si elles ne travaillent plus dans les centres, une ligne suffit
  à les retirer des listes sans rien effacer :

    UPDATE therapeutes SET actif = false
     WHERE (centre_id, prenom) IN (
       ('le-cres', 'Paola'), ('le-cres', 'Flora'),
       ('cabestany', 'Audrey'), ('cabestany', 'Alexandra C')
     );
*/

-- ===========================================================================
-- 1. LES DEUX PRÉNOMS À REMETTRE D'APLOMB
-- ===========================================================================

UPDATE therapeutes SET prenom = 'Alex'
 WHERE centre_id = 'le-cres' AND prenom = 'Alexandra';

UPDATE therapeutes SET prenom = 'Alexandra'
 WHERE centre_id = 'avignon' AND prenom = 'Alexandra 2';

-- ===========================================================================
-- 2. LES ADRESSES
--
--    Sans accent et en minuscules : elles se tapent chaque matin, souvent
--    sur un clavier partagé. « stéphanie » se saisit mal, « stephanie » non.
-- ===========================================================================

UPDATE therapeutes t SET email = v.email
FROM (VALUES
  ('grau-du-roi', 'Marie',     'marie.grau@mabeautyplus.fr'),
  ('grau-du-roi', 'Nadia',     'nadia.grau@mabeautyplus.fr'),
  ('grau-du-roi', 'Stéphanie', 'stephanie.grau@mabeautyplus.fr'),
  ('grau-du-roi', 'Fanny',     'fanny.grau@mabeautyplus.fr'),

  ('le-cres',     'Alex',      'alex.cres@mabeautyplus.fr'),
  ('le-cres',     'Malvina',   'malvina.cres@mabeautyplus.fr'),

  ('serignan',    'Caroll',    'caroll.serignan@mabeautyplus.fr'),
  ('serignan',    'Aude',      'aude.serignan@mabeautyplus.fr'),
  ('serignan',    'Marie-san', 'mariesan.serignan@mabeautyplus.fr'),

  ('cabestany',   'Marine',    'marine.cabestany@mabeautyplus.fr'),
  ('cabestany',   'Sara',      'sara.cabestany@mabeautyplus.fr'),

  ('avignon',     'Alexandra', 'alexandra.avignon@mabeautyplus.fr'),
  ('avignon',     'Laura',     'laura.avignon@mabeautyplus.fr')
) AS v(centre_id, prenom, email)
WHERE t.centre_id = v.centre_id
  AND t.prenom = v.prenom
  AND t.email IS DISTINCT FROM v.email;

-- ===========================================================================
-- 3. LE CONTRÔLE
--
--    Treize lignes doivent porter une adresse, plus la Direction. Celles qui
--    restent sans adresse sont les quatre thérapeutes sans compte : c'est
--    normal tant qu'on ne leur en donne pas.
-- ===========================================================================

SELECT
  COALESCE(c.nom, '— tous les centres') AS centre,
  t.prenom,
  COALESCE(t.email, '(pas de compte prévu)') AS adresse,
  CASE WHEN t.user_id IS NULL THEN 'compte à créer' ELSE 'peut se connecter' END AS etat
FROM therapeutes t
LEFT JOIN centres c ON c.id = t.centre_id
WHERE t.actif
ORDER BY c.nom NULLS FIRST, t.ordre;
