/*
  MAbeautyplus V2 — Migration 080 : le Psio, à Sérignan

  UN SOIN DE PLUS, ET RIEN D'AUTRE (Jonathan, 16 octobre 2026).

  Le Psio se tient **à Sérignan seulement**. Il n'a **pas de bilan** : aucune
  question ne lui donne de points, le BioPortrait ne le prescrit jamais, et
  la thérapeute l'ajoute à la main — au devis du bilan sous « Modifier », et
  sur le formulaire de cure d'une cliente qui revient. C'est le chemin du
  Dôme au Grau-du-Roi, et pour la même raison : un soin qu'aucun
  questionnaire n'évalue n'a rien à faire dans une prescription.

  Il n'a **pas de consentement** non plus.

  DEUX FORMULES, UN SEUL TARIF.

      6 séances → 351 €
      8 séances → 468 €

  Les deux tombent sur **58,50 € la séance** : 58,50 × 6 = 351, 58,50 × 8 =
  468. On range donc un prix de séance, comme pour tous les autres soins,
  et les deux formules en découlent — le montant d'une cure est partout la
  somme de ses séances, et un prix forfaitaire aurait demandé une seconde
  arithmétique à côté de la première. **Les séances, elles, ne se choisissent
  pas une par une** : la liste des paliers du Psio ne contient que 6 et 8, et
  le « + » s'arrête à 8. Sept séances de Psio n'existent pas, et afficher
  409,50 € serait annoncer un prix que personne n'a fixé.

  Ce tarif est **daté comme les autres** : une cure déjà validée garde le
  prix qu'elle a copié ce jour-là.

  CE QUI N'EN FAIT PAS UN SOIN PRINCIPAL.

  Une séance de Psio **s'ajoute à une venue existante**, elle n'en demande
  pas une à elle seule : la cliente l'enchaîne après un autre soin. Elle se
  comporte donc comme la Luxothérapie Relaxation et **n'allonge pas la
  cure** — seuls les soins qui font revenir comptent dans la règle du
  « troisième soin, un mois de plus », qui plafonne le nombre de chèques. La
  règle vit côté application (`dureeCureEnMois` et ses deux appelants), pas
  ici.

  CE QUE CETTE MIGRATION POSE.

    — le tarif `psio`, 58,50 € ;
    — `psio` admis dans les lignes d'une cure et dans les séances.

  Le verrou de clôture n'a pas à bouger : depuis la 070 il ne réclame une
  Mission Déclic que sur la luxothérapie, en la nommant. Une technologie de
  plus ne le casse pas — c'est exactement pourquoi il nomme ce qu'il veut au
  lieu d'exclure ce qu'il connaît.

  Sans danger, rejouable autant de fois que nécessaire.
*/

BEGIN;

-- 1. LE TARIF ---------------------------------------------------------------

INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('psio', '2026-10-16', 58.50,
   'Séance de Psio — 6 séances 351 €, 8 séances 468 €, à Sérignan')
ON CONFLICT (code, effet_le) DO UPDATE
  SET montant = EXCLUDED.montant, libelle = EXCLUDED.libelle;

-- 2. LA TECHNOLOGIE ---------------------------------------------------------

ALTER TABLE programme_lignes DROP CONSTRAINT IF EXISTS programme_lignes_technologie_check;
ALTER TABLE programme_lignes ADD CONSTRAINT programme_lignes_technologie_check
  CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome', 'relax',
                         'advance_lift', 'radiofrequence', 'psio'));

ALTER TABLE seances DROP CONSTRAINT IF EXISTS seances_technologie_check;
ALTER TABLE seances ADD CONSTRAINT seances_technologie_check
  CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome', 'relax',
                         'advance_lift', 'radiofrequence', 'psio'));

COMMIT;

-- Contrôle : le tarif est là, et les deux contraintes acceptent le Psio.
SELECT 'tarif' AS objet,
       CASE WHEN EXISTS (SELECT 1 FROM tarifs WHERE code = 'psio' AND montant = 58.50)
            THEN 'ok' ELSE '>>> absent' END AS etat
UNION ALL
SELECT c.conrelid::regclass::text,
       CASE WHEN pg_get_constraintdef(c.oid) LIKE '%psio%' THEN 'ok' ELSE '>>> sans psio' END
  FROM pg_constraint c
 WHERE c.conname IN ('programme_lignes_technologie_check', 'seances_technologie_check');
