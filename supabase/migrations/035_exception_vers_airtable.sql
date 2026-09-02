/*
  MAbeautyplus V2 — Migration 035 : l'exception de cure part dans le CRM

  Les champs « Civilité », « Exception cure » et « Frais de financement »
  existent maintenant dans Airtable. La fonction de synchronisation les
  remplit, encore faut-il qu'une modification les y envoie.

  L'exception compte particulièrement : c'est elle qui doit empêcher une
  automatisation d'inviter à une séance d'électrostimulation quelqu'un qui
  porte un pacemaker.
*/

DROP TRIGGER IF EXISTS clientes_vers_airtable ON clientes;
CREATE TRIGGER clientes_vers_airtable
  AFTER INSERT OR UPDATE OF prenom, nom, email, telephone, date_naissance, age,
                            adresse, code_postal, ville, source, therapeutes,
                            parcours_audio, acces_audio_le, parrain_id, parrain_libre,
                            civilite, exception_cure
  ON clientes
  FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('cliente');
