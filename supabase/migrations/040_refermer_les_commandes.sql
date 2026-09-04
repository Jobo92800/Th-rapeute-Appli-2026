/*
  MAbeautyplus V2 — Migration 040 : refermer les commandes restées ouvertes

  ⚠ CETTE VERSION REMPLACE UNE PREMIÈRE QUI N'A RIEN FAIT. La précédente
  nommait chaque commande à la main ; une de ses lignes a échoué, et
  PostgreSQL annule tout un script d'un bloc — si bien que rien n'était
  appliqué, sans que ce soit visible. Le contrôle depuis l'extérieur l'a
  montré : les commandes répondaient encore.

  Celle-ci ne nomme plus aucune signature. Elle demande à la base la liste
  de ses propres commandes et les referme une par une. Aucune faute de
  frappe n'est possible, et elle est rejouable autant de fois qu'on veut.

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

  Ce n'est pas une hypothèse : l'appel a été fait depuis l'extérieur le
  3 septembre 2026 et il a bien rendu un ticket réel, remis en file aussitôt.

  CE QUE FAIT CETTE MIGRATION. Elle retire le droit implicite donné à tout
  le monde, et le rend à ceux qui en ont besoin — et à eux seuls :

    · la synchro seule (service_role) pour ce qui touche à la file ;
    · les comptes connectés (authenticated) pour tout le reste, c'est-à-dire
      ce que l'application appelle réellement.

  Aucun comportement ne change. Une commande refermée fait exactement ce
  qu'elle faisait, pour exactement les mêmes appelants légitimes.
*/

-- ===========================================================================
-- 1. REFERMER
-- ===========================================================================

DO $refermer$
DECLARE
  cmd record;
  /*
    Ces deux-là ne sont appelées que par la fonction Edge de synchro, qui se
    présente avec la clé de service. Aucun navigateur n'a de raison de les
    appeler — c'est le cœur du trou qu'on referme.
  */
  reservees_au_service text[] := ARRAY[
    'reclamer_taches_airtable',
    'reserver_creation_airtable'
  ];
  nb integer := 0;
BEGIN
  FOR cmd IN
    SELECT p.oid::regprocedure AS signature, p.proname AS nom
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef                                    -- SECURITY DEFINER
       -- Les fonctions de déclencheur ne s'appellent pas de l'extérieur :
       -- PostgreSQL refuse de les exécuter autrement que par un trigger.
       AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', cmd.signature);

    IF cmd.nom = ANY (reservees_au_service) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', cmd.signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', cmd.signature);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', cmd.signature);
    END IF;

    nb := nb + 1;
  END LOOP;

  RAISE NOTICE 'Commandes refermées : %', nb;
END
$refermer$;

-- ===========================================================================
-- 2. LE CONTRÔLE
--
--    Le script se vérifie lui-même. La liste ci-dessous doit être VIDE :
--    elle montre les commandes encore appelables par n'importe qui.
--
--    Si une ligne apparaît, ne cherchez pas plus loin — envoyez-la-moi.
-- ===========================================================================

SELECT
  p.proname                                        AS commande_encore_ouverte,
  pg_get_function_identity_arguments(p.oid)        AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND p.prorettype <> 'trigger'::regtype
  AND has_function_privilege('public', p.oid, 'EXECUTE')
ORDER BY 1;
