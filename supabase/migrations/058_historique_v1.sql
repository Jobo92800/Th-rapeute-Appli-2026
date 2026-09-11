/*
  MAbeautyplus V2 — Migration 058 : la reprise de l'historique de l'ancienne
  application

  D'OÙ ÇA VIENT. L'ancienne application (Bolt) gardait ses séances dans un
  Firebase, projet `mabeauty-plus-crm` : 20 251 pesées — une par séance de
  luxothérapie, avec sa date, son poids et son commentaire —, 2 580 relevés
  de mensurations, 311 fiches de notes et 31 exceptions cure. Airtable n'en
  a jamais rien su : la reprise du CRM (022) a créé les cures, pas les
  séances. Une cliente reprise avait une fiche sans courbe et sans passé.

  CE QU'ON REPREND, décidé avec Jonathan le 11 septembre 2026 : les pesées
  seulement — pas les séances d'I-Shape, de presso ni des soins abandonnés —,
  et seulement pour les clientes qui ont une cure dans la V2 ; les
  mensurations, les notes et les exceptions cure avec.

  CE QUE LA BASE DOIT ADMETTRE POUR ÇA :

    · une séance importée se clôture sans Mission Déclic — l'ancienne
      application n'en avait pas ;
    · chaque ligne reprise garde l'identifiant qu'elle avait là-bas, unique,
      pour que la reprise se rejoue sans jamais rien doubler.

  Rejouable sans risque.
*/

-- Les séances : d'où elles viennent, et leur identifiant d'origine.
ALTER TABLE seances
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'v2'
    CHECK (origine IN ('v2', 'import_v1')),
  ADD COLUMN IF NOT EXISTS v1_id text;

/*
  Unique, sans clause WHERE : c'est sur cet index que l'écriture fait son
  « ne double pas » (ON CONFLICT), et PostgreSQL n'accepte pas un index
  partiel pour ça. Les lignes nées ici ont v1_id vide, et deux vides ne se
  gênent pas.
*/
CREATE UNIQUE INDEX IF NOT EXISTS seances_v1_id_unique ON seances (v1_id);

COMMENT ON COLUMN seances.origine IS
  'v2 : faite dans cette application. import_v1 : reprise de l''ancienne application (Firebase), sans Mission Déclic.';

-- Pas de Mission Déclic sur une séance reprise : elle n'existait pas là-bas.
ALTER TABLE seances DROP CONSTRAINT IF EXISTS cloture_exige_le_jeu;
ALTER TABLE seances ADD CONSTRAINT cloture_exige_le_jeu
  CHECK (NOT cloturee OR jeu_valide OR technologie = 'advance_lift' OR origine = 'import_v1');

-- Les mensurations et les notes, rejouables de même.
ALTER TABLE mensurations ADD COLUMN IF NOT EXISTS v1_id text;
CREATE UNIQUE INDEX IF NOT EXISTS mensurations_v1_id_unique ON mensurations (v1_id);

ALTER TABLE notes_cliente ADD COLUMN IF NOT EXISTS v1_id text;
CREATE UNIQUE INDEX IF NOT EXISTS notes_cliente_v1_id_unique ON notes_cliente (v1_id);

-- Contrôle : les trois colonnes existent, et la contrainte admet l'import.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seances' AND column_name = 'v1_id')      AS seances_v1_id,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mensurations' AND column_name = 'v1_id') AS mensurations_v1_id,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes_cliente' AND column_name = 'v1_id') AS notes_v1_id,
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'cloture_exige_le_jeu') LIKE '%import_v1%' AS cloture_admet_l_import;
