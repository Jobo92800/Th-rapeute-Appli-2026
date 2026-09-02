/*
  MAbeautyplus V2 — Migration 026 : les cures reprises ne repartent pas
  dans Airtable

  Après la 023, l'accueil annonçait 824 fiches en attente d'envoi — soit
  exactement le nombre de cures reprises. Le chemin était indirect, et c'est
  pour ça qu'il avait échappé à la protection de la 022 :

    023 crée une échéance par cure reprise
      → le déclencheur de la 009 remet le programme dans la file
        → 824 tâches, prêtes à réécrire dans Airtable des données qui en
          viennent.

  Rien n'aurait été créé en double — chaque fiche importée porte déjà son
  identifiant Airtable — mais 824 fiches du CRM auraient été réécrites avec
  des valeurs recalculées, dont un « Mode de règlement : inconnu » que le
  champ Airtable n'accepte pas.

  On vide donc ces tâches, et on ferme le chemin.
*/

-- ---------------------------------------------------------------------------
-- 1. Retirer de la file ce qui n'a rien à y faire
-- ---------------------------------------------------------------------------

DELETE FROM airtable_sync s
WHERE s.entite = 'programme'
  AND EXISTS (
    SELECT 1 FROM programmes p
    WHERE p.id = s.entite_id AND p.origine = 'import_v1'
  );

-- ---------------------------------------------------------------------------
-- 2. Une échéance de cure reprise ne réveille plus son programme
--
--    Les cures de la V2 continuent de remonter normalement : c'est ce qui
--    tient « Reste à encaisser » à jour dans le CRM.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enfiler_programme_depuis_echeance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_programme uuid := COALESCE(NEW.programme_id, OLD.programme_id);
BEGIN
  IF EXISTS (
    SELECT 1 FROM programmes p
    WHERE p.id = v_programme AND p.origine = 'import_v1'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO airtable_sync (entite, entite_id)
  VALUES ('programme', v_programme)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;

  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Le programme repris ne repart jamais ; la fiche cliente, elle, repart
--    dès qu'on la modifie
--
--    La nuance compte. Une cure reprise ne porte qu'un montant venu du CRM :
--    elle n'a rien à lui réapprendre, jamais. Une fiche cliente, si : quand
--    une thérapeute corrige un téléphone dans la V2, Airtable doit le voir.
--    Seule sa création reste muette — elle vient de là.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enfiler_airtable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF COALESCE(to_jsonb(NEW) ->> 'origine', 'v2') = 'import_v1'
     AND (TG_OP = 'INSERT' OR TG_ARGV[0] = 'programme') THEN
    RETURN NEW;
  END IF;

  INSERT INTO airtable_sync (entite, entite_id)
  VALUES (TG_ARGV[0], NEW.id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;

  RETURN NEW;
END $$;
