/*
  MAbeautyplus V2 — Migration 013 : accès au parcours audio

  L'application « Mon Parcours » vit sur son propre projet Supabase et son
  propre site. On ne la fusionne pas : on lui crée simplement le compte de
  la cliente au moment de la signature du contrat, avec le parcours choisi
  par la thérapeute.

  La V2 ne retient que deux choses : quel parcours a été attribué, et quand
  l'accès a été créé. Le reste (étapes, écoute, déblocage) reste chez elle.
*/

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS parcours_audio  text CHECK (parcours_audio IS NULL OR parcours_audio IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS acces_audio_le  timestamptz;

COMMENT ON COLUMN clientes.parcours_audio IS
  'Parcours audio attribué dans l''application Mon Parcours. Choisi par la thérapeute.';
COMMENT ON COLUMN clientes.acces_audio_le IS
  'Date de création du compte. Rempli = la cliente a reçu son invitation par email.';

-- Le parcours part dans Airtable comme le reste de la fiche.
DROP TRIGGER IF EXISTS clientes_vers_airtable ON clientes;
CREATE TRIGGER clientes_vers_airtable
  AFTER INSERT OR UPDATE OF prenom, nom, email, telephone, date_naissance, age,
                            adresse, code_postal, ville, source, therapeutes,
                            parcours_audio, acces_audio_le
  ON clientes
  FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('cliente');

