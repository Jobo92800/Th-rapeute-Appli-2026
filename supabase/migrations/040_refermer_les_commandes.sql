/*
  MAbeautyplus V2 — Migration 040 : refermer les commandes restées ouvertes

  LE PROBLÈME, EN CLAIR.

  La synchronisation vers Airtable marche par file d'attente. Chaque
  modification dépose un ticket ; la synchro prend une poignée de tickets,
  les marque « en cours » pour que deux passages ne fassent pas deux fois le
  même travail, puis les envoie dans le CRM.

  Le geste « je prends ces tickets » est une commande en base :
  `reclamer_taches_airtable`. Elle devrait être réservée à la synchro. Or
  PostgreSQL ouvre à tout le monde toute commande nouvellement créée, et
  personne n'a refermé derrière.

  Conséquence : avec la seule clé publique du site — celle qui est dans le
  JavaScript de la page, lisible par n'importe qui — on peut appeler cette
  commande et prendre les tickets. Ils passent en « en cours » et n'en
  sortent plus, puisque celui qui les a pris n'est pas la vraie synchro. Le
  CRM cesse d'être à jour, sans un mot, sans une erreur.

  Ce n'était pas une hypothèse : l'appel a été fait depuis l'extérieur le
  3 septembre 2026 et il a bien rendu un ticket réel. Il a été remis en file
  dans la foulée.

  CE QUE FAIT CETTE MIGRATION.

  Elle retire le droit implicite donné à tout le monde, et le rend
  explicitement à ceux qui en ont besoin — et à eux seuls :

    · la synchro (service_role) pour ce qui touche à la file d'attente ;
    · les comptes connectés (authenticated) pour ce que l'application
      appelle réellement.

  Elle ne change aucun comportement. Une commande refermée fait exactement
  ce qu'elle faisait, pour exactement les mêmes appelants légitimes.

  POURQUOI CE N'EST PAS RISQUÉ POUR LA SYNCHRO. Chaque droit a été accordé
  d'après un relevé de qui appelle quoi : `reclamer_taches_airtable` et
  `reserver_creation_airtable` ne sont appelées que par la fonction Edge,
  qui se présente avec la clé de service. Aucune policy de sécurité n'est
  ouverte à `anon` ou à `public`, donc retirer ce droit ne peut casser
  aucune lecture.

  Pour vérifier après coup que la synchro va bien :

    curl -s -X POST "$URL/functions/v1/synchro-airtable" \
      -H "Authorization: Bearer $ANON"

  Elle doit répondre `{"traitees":…,"echecs":…}` comme avant.
*/

-- ===========================================================================
-- 1. LE SOCLE DES DROITS
--
--    Ces trois commandes disent qui est connecté et à quel centre il a
--    droit. Elles sont appelées de l'intérieur, par les règles de sécurité
--    elles-mêmes et par les valeurs par défaut des colonnes — jamais par
--    l'application directement. Il faut donc les laisser aux comptes
--    connectés, sans quoi plus personne ne lit rien.
-- ===========================================================================

REVOKE ALL ON FUNCTION acces_centre(text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION centre_courant()          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION therapeute_courante()     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION est_direction()           FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION acces_centre(text)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION centre_courant()       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION therapeute_courante()  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION est_direction()        TO authenticated, service_role;

-- ===========================================================================
-- 2. LA FILE DE SYNCHRONISATION
--
--    Le cœur du sujet. « Réclamer des tâches » et « réserver la création
--    d'une fiche » ne sont appelées que par la fonction Edge, qui se
--    présente avec la clé de service. Personne d'autre n'a de raison de les
--    appeler, et surtout pas depuis un navigateur.
-- ===========================================================================

REVOKE ALL ON FUNCTION reclamer_taches_airtable(integer)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reserver_creation_airtable(uuid)   FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION reclamer_taches_airtable(integer) TO service_role;
GRANT EXECUTE ON FUNCTION reserver_creation_airtable(uuid)  TO service_role;

-- Celles-ci débloquent ou relancent des tâches coincées. L'accueil de
-- l'application s'en sert, elles restent donc ouvertes aux comptes connectés.
REVOKE ALL ON FUNCTION debloquer_taches_airtable() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION reprendre_taches_airtable() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION debloquer_taches_airtable() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reprendre_taches_airtable() TO authenticated, service_role;

-- ===========================================================================
-- 3. LE DOSSIER D'UNE CLIENTE
--
--    Elle liste ce qui serait effacé avec une fiche, avant une suppression
--    définitive. Réservée aux comptes connectés : la fenêtre de suppression
--    de l'application l'appelle.
-- ===========================================================================

REVOKE ALL ON FUNCTION contenu_cliente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION contenu_cliente(uuid) TO authenticated, service_role;

-- ===========================================================================
-- 4. ET POUR L'AVENIR
--
--    Le défaut se reproduira à chaque nouvelle commande créée. On coupe donc
--    le droit implicite à la racine : désormais, une commande créée sans
--    GRANT explicite n'est appelable par personne.
--
--    C'est volontairement strict. Une migration future qui oublierait son
--    GRANT échouera bruyamment à l'usage, ce qui vaut mieux qu'un trou
--    silencieux.
-- ===========================================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

/*
  ===========================================================================
  CONTRÔLE — à coller après la migration pour vérifier qu'il ne reste rien
  ===========================================================================

  Cette requête liste les commandes du schéma public encore appelables par
  tout le monde. Elle doit ne rien renvoyer.

    SELECT p.proname AS commande
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef                                   -- SECURITY DEFINER
       AND has_function_privilege('public', p.oid, 'EXECUTE')
     ORDER BY 1;
*/
