/*
  MAbeautyplus V2 — Migration 081 : l'hydroporation, et le bilan anti-âge
  vendu sur une cure suivante

  Deux ajouts de Jonathan, le 16 octobre 2026.

  1. L'HYDROPORATION, À SÉRIGNAN, 179 € LA SÉANCE.

  Un second soin anti-âge dans ce centre, à côté de la radiofréquence
  Mesojet. **Aucun bilan ne le préconise** : le Profil Signature cote des
  zones et en déduit une cure de radiofréquence, il ne dit rien de
  l'hydroporation. La thérapeute l'ajoute donc à la main, sur le formulaire
  de cure, comme le Psio et le Dôme. **Pas de consentement** non plus — et
  ce n'est pas un oubli : le consentement de la radiofréquence précise noir
  sur blanc qu'il couvre « la radiofréquence seule, sans ultrasons ni
  hydroporation », donc aucun document existant ne la couvrait, et Jonathan
  a tranché qu'il n'en faut pas.

  CE QUE ÇA CHANGE À UNE RÈGLE ÉCRITE AILLEURS. Jusqu'ici un centre tenait
  **un** soin anti-âge et un seul — l'Advance Lift au Grau-du-Roi, la
  radiofréquence au Crès et à Sérignan. Sérignan en tient désormais deux.
  Ce qui reste vrai, et que le banc d'essai tient toujours : **aucun centre
  ne fait l'Advance Lift ET la radiofréquence**, ce sont deux façons
  concurrentes de traiter la même chose.

  2. LE BILAN ANTI-ÂGE, 89 €, SUR UNE CURE COMPOSÉE SANS BILAN.

  Une cliente déjà suivie qui repart sur de l'anti-âge refait son bilan, et
  il se facture 89 € — le même tarif que le premier rendez-vous du Profil
  Signature, `bilan_signature`, qui existe depuis la 071. Sur le devis du
  Profil Signature ces 89 € sont déjà dans le total depuis le 25 septembre ;
  **le formulaire de « Nouvelle cure », lui, ne les comptait nulle part**, et
  une cure d'anti-âge vendue par là partait sans son bilan.

  Une case les ajoute, comme le guide et la tenue : ils entrent dans le
  montant de la cure et tombent sur la première échéance. Elle ne s'affiche
  **que là où le bilan anti-âge vaut 89 €** — le Crès et Sérignan. Au
  Grau-du-Roi, le Bio-Portrait Anti-Âge n'a pas de bilan facturé à part :
  c'est la première séance d'Advance Lift qui se règle, 85 €.

  D'OÙ UNE COLONNE DE PLUS, `prix_bilan`.

  Le guide et la tenue ont la leur (`prix_guide`, `prix_tenue`) pour une
  raison : sans elles, le montant d'une cure ne se reconstituerait pas —
  séances × prix + options devrait retomber sur `montant_total`, et un
  écart de 89 € que rien n'explique est exactement le genre de chose qu'on
  découvre six mois plus tard sans pouvoir la trancher. La colonne naît à
  zéro : toutes les cures déjà enregistrées restent justes.

  Sans danger, rejouable autant de fois que nécessaire.
*/

BEGIN;

-- 1. LE TARIF DE L'HYDROPORATION --------------------------------------------

INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('hydroporation', '2026-10-16', 179.00,
   'Séance d''hydroporation — soin anti-âge, à Sérignan')
ON CONFLICT (code, effet_le) DO UPDATE
  SET montant = EXCLUDED.montant, libelle = EXCLUDED.libelle;

-- 2. LA TECHNOLOGIE ----------------------------------------------------------

ALTER TABLE programme_lignes DROP CONSTRAINT IF EXISTS programme_lignes_technologie_check;
ALTER TABLE programme_lignes ADD CONSTRAINT programme_lignes_technologie_check
  CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome', 'relax',
                         'advance_lift', 'radiofrequence', 'psio', 'hydroporation'));

ALTER TABLE seances DROP CONSTRAINT IF EXISTS seances_technologie_check;
ALTER TABLE seances ADD CONSTRAINT seances_technologie_check
  CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome', 'relax',
                         'advance_lift', 'radiofrequence', 'psio', 'hydroporation'));

-- 3. LE BILAN ANTI-ÂGE VENDU AVEC LA CURE ------------------------------------

ALTER TABLE programmes ADD COLUMN IF NOT EXISTS prix_bilan numeric(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN programmes.prix_bilan IS
  'Le bilan facturé avec cette cure, zéro le plus souvent. Sert à reconstituer '
  'le montant : séances + guide + tenue + compléments + bilan = montant_total. '
  'Posé par la case « Bilan anti-âge » du formulaire de cure (081).';

COMMIT;

-- Contrôle : le tarif, les deux contraintes, et la colonne.
SELECT 'tarif hydroporation' AS objet,
       CASE WHEN EXISTS (SELECT 1 FROM tarifs WHERE code = 'hydroporation' AND montant = 179)
            THEN 'ok' ELSE '>>> absent' END AS etat
UNION ALL
SELECT 'colonne prix_bilan',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'programmes' AND column_name = 'prix_bilan')
            THEN 'ok' ELSE '>>> absente' END
UNION ALL
SELECT c.conrelid::regclass::text,
       CASE WHEN pg_get_constraintdef(c.oid) LIKE '%hydroporation%' THEN 'ok'
            ELSE '>>> sans hydroporation' END
  FROM pg_constraint c
 WHERE c.conname IN ('programme_lignes_technologie_check', 'seances_technologie_check');
