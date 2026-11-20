/*
  MAbeautyplus V2 — Migration 091 : le CRM dit Pollestres.

  CE QUI SE PASSAIT. Le centre a déménagé de Cabestany à Pollestres. Son
  identifiant technique est resté `cabestany` — et c'est normal, on ne
  renomme pas une clé étrangère portée par 215 fiches. Son nom affiché est
  bien passé à « Pollestres ». Mais `nom_airtable`, la colonne qui décide
  de ce que la synchro écrit dans le champ « Centre » du CRM, était restée
  à « Cabestany ». Chaque nouveau client partait donc sous l'ancien nom.

  POURQUOI L'HISTORIQUE A SUIVI. Changer cette seule ligne aurait coupé le
  centre en deux dans le CRM : 435 fiches « Cabestany » d'un côté, les
  nouvelles « Pollestres » de l'autre, et des tableaux de CA affichant deux
  centres incomplets. Les 435 fiches ont donc été renommées dans Airtable
  le 20 novembre 2026, avant cette migration.

  CE QUI A ÉTÉ VÉRIFIÉ AVANT. Aucune des neuf automatisations du CRM ne
  filtre sur « Cabestany » — celles qui filtrent par centre visent
  Sérignan, Avignon et Le Grau-du-Roi. Le renommage a été fait sur une
  seule fiche d'abord, puis les quatre automatisations qui envoient des
  e-mails ont été relues : aucune ne s'était déclenchée.

  CE QUI RESTE À FAIRE AILLEURS. MA HQ (dépôt dashboard-mbd) écrit
  'Cabestany' en dur dans sa liste de centres. Il affichera une colonne
  vide tant que ces deux lignes ne seront pas changées. CRM2MB, lui, sait
  déjà traduire les deux libellés.
*/

UPDATE centres SET nom_airtable = 'Pollestres' WHERE id = 'cabestany';

COMMENT ON COLUMN centres.nom_airtable IS
  'Le nom écrit dans le champ « Centre » du CRM. Distinct de `nom` quand le CRM garde un ancien libellé ; les deux coïncident depuis le 20 novembre 2026.';
