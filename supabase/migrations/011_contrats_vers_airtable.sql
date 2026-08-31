/*
  MAbeautyplus V2 — Migration 011 : les contrats partent dans Airtable

  À exécuter APRÈS la migration 008, qui crée les tables contrats et
  consentements.

  Les PDF sont envoyés dans les champs pièces jointes « Contrat » et
  « Consentements » de la table Clients. La thérapeute peut alors les
  transmettre directement depuis Airtable.

  L'envoi se fait par l'API de contenu d'Airtable, qui accepte le fichier
  encodé en base64. Aucun lien public n'est créé : contrairement à
  l'ancienne application, un contrat nominatif ne se retrouve pas
  accessible à qui devine une URL.
*/

-- Marque le moment où les pièces jointes sont arrivées dans Airtable.
-- Sert de garde-fou : une tâche rejouée ne réenverra pas les mêmes PDF.
ALTER TABLE contrats
  ADD COLUMN IF NOT EXISTS airtable_le timestamptz;

COMMENT ON COLUMN contrats.airtable_le IS
  'Horodatage de l''envoi des pièces jointes vers Airtable. Empêche un double envoi si la tâche est rejouée.';

DROP TRIGGER IF EXISTS contrats_vers_airtable ON contrats;
CREATE TRIGGER contrats_vers_airtable
  AFTER INSERT ON contrats
  FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('contrat');
