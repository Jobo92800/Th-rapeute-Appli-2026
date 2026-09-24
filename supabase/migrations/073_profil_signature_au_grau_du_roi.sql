/*
  MAbeautyplus V2 — Migration 073 : le bilan du Grau-du-Roi s'appelle
  lui aussi « Profil Signature »

  Jonathan, 24 septembre 2026. Le Bio-Portrait Anti-Âge du Grau-du-Roi et
  le Bilan Profil Signature du Crès et de Sérignan sont le même diagnostic
  de la peau : un profil, un terrain, des priorités. Seul le soin qui en
  découle diffère — l'Advance Lift ici, la radiofréquence là. Devant la
  thérapeute et devant la cliente, ils portent donc le même nom.

  CE QUI NE CHANGE PAS, et c'est délibéré, comme pour BioPortrait et
  Mission Déclic : les noms techniques. La famille de bilan reste
  `anti_age`, la table reste `bareme_anti_age`, la route reste
  `/bilan-anti-age`. Les renommer imposerait de reprendre les bilans déjà
  enregistrés pour un mot que personne ne lit dans le code.

  Cette migration ne touche qu'une phrase : la mention imprimée en bas du
  document, qui nommait le bilan.

  Rejouable sans risque.
*/

UPDATE bareme_anti_age
   SET contenu = jsonb_set(
         contenu,
         '{MENTION}',
         to_jsonb(
           'Le Profil Signature est un outil d''aide à l''analyse et à la personnalisation. Il ne constitue pas un diagnostic médical et ne détermine pas automatiquement le soin ni le nombre de séances.'::text
         )
       )
 WHERE contenu->>'MENTION' LIKE 'Le Bio-Portrait%';

-- Contrôle : la mention porte le nouveau nom.
SELECT version, actif, contenu->>'MENTION' AS mention
  FROM bareme_anti_age
 ORDER BY version;
