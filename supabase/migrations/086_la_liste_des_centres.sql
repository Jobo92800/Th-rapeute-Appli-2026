/*
  MAbeautyplus V2 — Migration 086 : le catalogue prend la liste réelle des
  centres, celle écrite à la main par la direction.

  UN RAYON « SOINS ». Trois des produits de la liste — crème radiofréquence
  visage, crème visage, gel presso — ne sont ni de l'hygiène, ni de
  l'entretien, ni de l'accueil, ni du bureau. Ce sont les consommables des
  appareils. Les mettre dans « Autre » aurait transformé le fourre-tout, qui
  doit rester rare, en troisième rayon du catalogue.

  CE QUI EXISTAIT N'EST PAS DUPLIQUÉ. Huit des seize produits de la liste
  étaient déjà au socle de la migration 084. On ne les recrée pas ; deux
  sont renommés avec les mots de la maison, parce que c'est ce que la
  thérapeute lira.

  LES PRODUITS NE SONT PAS TOUS PARTOUT. Les gants ne concernent que
  Sérignan, les deux crèmes visage Sérignan et Le Crès. Le reste est commun.

  AUCUNE ADRESSE D'ACHAT ICI : elles seront collées depuis l'application.
*/

-- ===========================================================================
-- 1. LE RAYON « SOINS »
-- ===========================================================================

ALTER TABLE fournitures DROP CONSTRAINT IF EXISTS fournitures_categorie_check;

ALTER TABLE fournitures ADD CONSTRAINT fournitures_categorie_check
  CHECK (categorie IN ('hygiene', 'entretien', 'soin', 'accueil', 'bureau', 'autre'));

-- ===========================================================================
-- 2. LES MOTS DE LA MAISON
--    « Papier imprimante » et « Thé » deviennent ce que la direction écrit.
-- ===========================================================================

UPDATE fournitures SET nom = 'Feuilles A4'
 WHERE nom = 'Papier imprimante'
   AND NOT EXISTS (SELECT 1 FROM fournitures f WHERE f.nom = 'Feuilles A4');

UPDATE fournitures SET nom = 'Thé / tisanes'
 WHERE nom = 'Thé'
   AND NOT EXISTS (SELECT 1 FROM fournitures f WHERE f.nom = 'Thé / tisanes');

-- ===========================================================================
-- 3. CE QUI MANQUAIT
--    Le garde-fou porte sur le nom : la migration peut être rejouée sans
--    créer un second exemplaire de quoi que ce soit.
-- ===========================================================================

INSERT INTO fournitures (nom, categorie, unite, ordre, centres)
SELECT v.nom, v.categorie, v.unite, v.ordre, v.centres
  FROM (VALUES
  /* Hygiène */
  ('Gants taille M, sans latex, noirs', 'hygiene',   'boîte de 100', 15, ARRAY['serignan']),

  /* Entretien */
  ('Lessive',                           'entretien', 'bidon',        26, NULL::text[]),
  ('Sanytol',                           'entretien', 'spray',        27, NULL::text[]),
  ('Gel WC',                            'entretien', 'flacon',       28, NULL::text[]),

  /* Soins — les consommables des appareils */
  ('Crème radiofréquence visage',       'soin',      'pot',          50, ARRAY['serignan', 'le-cres']),
  ('Crème visage',                      'soin',      'pot',          51, ARRAY['serignan', 'le-cres']),
  ('Gel presso',                        'soin',      'flacon',       52, NULL::text[]),

  /* Bureau */
  ('Agrafes',                           'bureau',    'boîte',        43, NULL::text[]),
  ('Encre InBody',                      'bureau',    'cartouche',    44, NULL::text[])
) AS v(nom, categorie, unite, ordre, centres)
 WHERE NOT EXISTS (
   SELECT 1 FROM fournitures f WHERE lower(btrim(f.nom)) = lower(btrim(v.nom))
 );
