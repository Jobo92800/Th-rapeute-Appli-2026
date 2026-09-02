/*
  MAbeautyplus V2 — Migration 029 : Madame ou Monsieur

  Les centres reçoivent régulièrement des hommes, et toute l'application les
  appelait « clientes ». Sur un contrat, ça se voit.

  On enregistre donc la civilité. Par défaut « Mme » : c'est le cas de la
  très grande majorité des fiches, et les 680 fiches reprises du CRM n'en
  portent aucune — Airtable ne la connaissait pas non plus.

  Les consentements, eux, n'ont rien à changer : ils sont déjà écrits au
  neutre (« Je soussigné(e) », « J'autorise », « Je certifie »). Seul le
  consentement ménopause reste au féminin, ce qui va de soi.
*/

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS civilite text NOT NULL DEFAULT 'Mme'
    CHECK (civilite IN ('Mme', 'M.'));

COMMENT ON COLUMN clientes.civilite IS
  'Madame ou Monsieur. Sert aux documents et aux accords de l''interface.';

-- La civilité part dans Airtable avec le reste de la fiche.
DROP TRIGGER IF EXISTS clientes_vers_airtable ON clientes;
CREATE TRIGGER clientes_vers_airtable
  AFTER INSERT OR UPDATE OF prenom, nom, email, telephone, date_naissance, age,
                            adresse, code_postal, ville, source, therapeutes,
                            parcours_audio, acces_audio_le, parrain_id, parrain_libre,
                            civilite
  ON clientes
  FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('cliente');
