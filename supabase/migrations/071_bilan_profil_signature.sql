/*
  MAbeautyplus V2 — Migration 071 : le Bilan Profil Signature anti-âge

  Le troisième bilan de la maison, AU CRÈS ET À SÉRIGNAN (spécification de
  Jonathan du 21 septembre 2026) : une cure de radiofréquence visage,
  appareil Mesojet, radiofréquence seule. Le Grau-du-Roi garde son
  Bio-Portrait Anti-Âge et son Advance Lift ; Cabestany et Avignon n’ont
  pas d’anti-âge.

  CE QUI LE DISTINGUE DES DEUX AUTRES BILANS, et qui explique cette
  migration :

    — LA THÉRAPEUTE OBSERVE. Après le questionnaire, elle cote sept zones
      du visage, du cou et du décolleté. Les réponses de la cliente
      pré-cotent ces zones, elle confirme ou corrige devant elle. Cette
      carte se range sur le bilan (`bilans.observation`) : sans elle, un
      bilan ne serait pas relisible — la moitié de chaque axe en vient.

    — IL PRESCRIT UNE CURE : Découverte 4 séances, Équilibre 6, Intégrale
      10, d’après les seules zones où la radiofréquence agit. Les seuils
      vivent dans le barème (`CURES[].jusqua`), pas dans le code.

    — DEUX FORMATS, DEUX PRIX. Visage et cou, 30 minutes, 79 € la séance ;
      visage, cou et décolleté, une heure, 139 €. C’est la thérapeute qui
      choisit, comme une option — le décolleté ne s’impose pas tout seul.

    — LE PREMIER RENDEZ-VOUS VAUT 89 € et comprend le Profil Signature et
      la première séance. S’il débouche sur une cure, il en EST la
      première séance : la cure vaut son prix plein (6 × 79 = 474 €) et
      les 89 € y sont compris. Sans cure, ce sont 89 € et rien d’autre.

  Contenu
    1. Les trois tarifs
    2. La radiofréquence au catalogue des soins
    3. La table `bareme_signature` et son questionnaire
    4. La famille de bilan « signature » et la carte des zones

  Rejouable sans risque.
*/

-- ---------------------------------------------------------------------------
-- 1. LES TARIFS
--    Aucun prix n’est écrit dans le code : une cure copie celui du jour de
--    sa validation, et les cures passées ne changent jamais de montant.
-- ---------------------------------------------------------------------------

INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('radiofrequence',           '2026-09-21',  79.00, 'Séance de radiofréquence — visage et cou (30 min)'),
  ('radiofrequence_decollete', '2026-09-21', 139.00, 'Séance de radiofréquence — visage, cou et décolleté (1 h)'),
  ('bilan_signature',          '2026-09-21',  89.00, 'Profil Signature anti-âge et première séance')
ON CONFLICT (code, effet_le) DO UPDATE SET montant = EXCLUDED.montant, libelle = EXCLUDED.libelle;

-- ---------------------------------------------------------------------------
-- 2. LA RADIOFRÉQUENCE AU CATALOGUE
--    Une seule technologie, deux prix : le format se lit sur le prix
--    unitaire figé sur la ligne de la cure, comme le Dôme à 49 € à côté
--    d’une luxo à 59 €.
-- ---------------------------------------------------------------------------

ALTER TABLE programme_lignes DROP CONSTRAINT IF EXISTS programme_lignes_technologie_check;
ALTER TABLE programme_lignes ADD CONSTRAINT programme_lignes_technologie_check
  CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome', 'relax', 'advance_lift', 'radiofrequence'));

ALTER TABLE seances DROP CONSTRAINT IF EXISTS seances_technologie_check;
ALTER TABLE seances ADD CONSTRAINT seances_technologie_check
  CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome', 'relax', 'advance_lift', 'radiofrequence'));

/*
  La Mission Déclic reste à la luxothérapie perte de poids (070) : une
  séance de radiofréquence se clôture sur son commentaire, sans mission ni
  pesée. Rien à changer ici, la contrainte ne vise plus que la luxo — la
  ligne est répétée pour que rejouer cette migration seule suffise.
*/
ALTER TABLE seances DROP CONSTRAINT IF EXISTS cloture_exige_le_jeu;
ALTER TABLE seances ADD CONSTRAINT cloture_exige_le_jeu
  CHECK (NOT cloturee OR jeu_valide OR technologie <> 'luxo' OR origine = 'import_v1');

-- ---------------------------------------------------------------------------
-- 3. LE QUESTIONNAIRE
--    Sa propre table, comme les deux autres : pas les mêmes questions, pas
--    les mêmes règles, et « une seule version active » doit valoir pour
--    chacun des trois.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bareme_signature (
  version     integer PRIMARY KEY,
  contenu     jsonb NOT NULL,
  actif       boolean NOT NULL DEFAULT false,
  commentaire text NOT NULL DEFAULT '',
  cree_le     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bareme_signature IS
  'Le Bilan Profil Signature anti-âge : zones observées, questions, points par axe et par terrain, textes des profils, cures et seuils. Chaque bilan retient sa version.';

CREATE UNIQUE INDEX IF NOT EXISTS bareme_signature_une_seule_active
  ON bareme_signature (actif) WHERE actif;

ALTER TABLE bareme_signature ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bareme_signature_lecture ON bareme_signature;
CREATE POLICY bareme_signature_lecture ON bareme_signature
  FOR SELECT TO authenticated USING (true);

INSERT INTO bareme_signature (version, contenu, actif, commentaire) VALUES
  (1, '{"ZONES":[{"code":"ovale","nom":"Ovale et bajoues","detail":"Relâchement du bas du visage","portee":"rf"},{"code":"cou","nom":"Cou","detail":"Fermeté et ridules","portee":"rf"},{"code":"grain","nom":"Grain de peau","detail":"Texture, pores, éclat","portee":"rf"},{"code":"yeux","nom":"Contour des yeux","detail":"Ridules : amélioration plus limitée","portee":"pa"},{"code":"front","nom":"Front","detail":"Rides d’expression : effet limité","portee":"pa"},{"code":"sillons","nom":"Sillons nasogéniens","detail":"Liés au volume : avis médical","portee":"ot"},{"code":"decollete","nom":"Décolleté","detail":"Ridules et fermeté","portee":"rf"}],"GROUPES":[{"id":"secu","titre":"Sécurité","detail":"À remplir par la thérapeute avant toute séance. Liste à compléter avec la notice du fabricant."},{"id":"ressenti","titre":"Ce que vous ressentez au quotidien","detail":"Répondez selon ce que vous vivez vraiment, sans chercher le bon mot."},{"id":"miroir","titre":"Ce que vous voyez dans le miroir"},{"id":"besoins","titre":"Ce qui vous gêne et ce que vous attendez"},{"id":"hist","titre":"Historique"}],"SECURITE":["Stimulateur cardiaque ou autre dispositif électronique implanté","Implant métallique dans la zone à traiter","Grossesse","Lésion, infection ou plaie sur la zone","Perte de sensibilité à la chaleur","Cancer en cours de traitement"],"QUESTIONS":[{"code":"s1","groupe":"ressenti","t":"Votre peau tire ou tiraille, par exemple après la douche ou le nettoyage","o":[["Jamais"],["Parfois",{"hydratation":1},{"hydratation":1}],["Souvent",{"hydratation":2},{"hydratation":2}],["Tous les jours",{"hydratation":3},{"hydratation":3}]]},{"code":"s2","groupe":"ressenti","t":"Vous ressentez des picotements, des démangeaisons ou des échauffements (produits, froid, soleil)","o":[["Jamais"],["Parfois",{},{"sensible":1}],["Souvent",{},{"sensible":2}],["Tous les jours",{},{"sensible":3}]]},{"code":"s3","groupe":"ressenti","t":"Votre visage rougit facilement (chaleur, émotion, changement de température)","o":[["Jamais"],["Parfois",{},{"sensible":1}],["Souvent",{},{"sensible":2}],["Tous les jours",{},{"sensible":3}]]},{"code":"s4","groupe":"ressenti","t":"Votre peau devient rugueuse ou pèle par endroits","o":[["Jamais"],["Parfois",{"hydratation":1},{"hydratation":1}],["Souvent",{"hydratation":1},{"hydratation":1}],["Tous les jours",{"hydratation":2},{"hydratation":2}]]},{"code":"s5","groupe":"ressenti","t":"Votre visage brille ou devient gras dans la journée","o":[["Jamais"],["Parfois",{},{"dense":1}],["Souvent",{},{"dense":2}],["Tous les jours",{},{"dense":3}]]},{"code":"s6","groupe":"ressenti","t":"Votre maquillage ou votre crème marque les ridules en fin de journée","o":[["Jamais"],["Parfois",{"rides":1}],["Souvent",{"rides":1,"hydratation":1}],["Tous les jours",{"rides":2,"hydratation":1}]]},{"code":"s7","groupe":"ressenti","t":"Votre teint paraît terne ou fatigué en fin de journée","o":[["Jamais"],["Parfois",{"hydratation":1}],["Souvent",{"hydratation":2}],["Tous les jours",{"hydratation":2}]]},{"code":"s8","groupe":"ressenti","t":"Au réveil, les marques de l’oreiller mettent du temps à disparaître","o":[["Jamais"],["Parfois",{"densite":1},{"fin":1}],["Souvent",{"fermete":1,"densite":2},{"fin":1}],["Tous les jours",{"fermete":1,"densite":3},{"fin":2}]]},{"code":"v1","groupe":"miroir","t":"De profil, la ligne de votre mâchoire est :","zone":"ovale","intensites":[0,2,3],"o":[["Nette et bien dessinée",{}],["Moins nette, avec de petites bajoues",{"fermete":2,"densite":1}],["Nettement relâchée",{"fermete":3,"densite":1}]]},{"code":"v2","groupe":"miroir","t":"Au coin des yeux, après un sourire :","zone":"yeux","intensites":[0,1,2,3],"o":[["Les plis disparaissent aussitôt",{}],["Ils restent quelques secondes",{"rides":1}],["Ils restent visibles au repos",{"rides":2,"densite":1}],["Des rides marquées, même au repos",{"rides":3,"densite":1}]]},{"code":"v3","groupe":"miroir","t":"Sur votre front :","zone":"front","intensites":[0,1,2,3],"o":[["La peau est lisse",{}],["Des lignes quand je fronce ou lève les sourcils",{"rides":1}],["Des lignes visibles au repos",{"rides":2,"densite":1}],["Des rides marquées",{"rides":3,"densite":1}]]},{"code":"v4","groupe":"miroir","t":"Entre le nez et le coin de la bouche :","zone":"sillons","intensites":[0,1,2,3],"o":[["Rien de particulier",{}],["Un pli quand je souris",{}],["Un pli visible au repos",{"fermete":1,"densite":1}],["Un pli marqué",{"fermete":1,"densite":1}]]},{"code":"v5","groupe":"miroir","t":"Sur votre cou :","zone":"cou","intensites":[0,1,2,3],"o":[["La peau est lisse et ferme",{}],["Quelques ridules",{"rides":1}],["Des lignes horizontales marquées",{"fermete":1,"rides":2}],["Une peau qui se relâche",{"fermete":3,"rides":1}]]},{"code":"v6","groupe":"miroir","t":"Sur votre décolleté :","zone":"decollete","intensites":[0,1,2],"o":[["La peau est lisse",{}],["Des plis le matin qui s’effacent",{"rides":1}],["Des ridules visibles en permanence",{"rides":2}]]},{"code":"v7","groupe":"miroir","t":"Votre grain de peau :","zone":"grain","intensites":[0,1,2],"o":[["Lisse et régulier",{},{}],["Quelques pores visibles",{"hydratation":1},{"dense":1}],["Pores dilatés, grain irrégulier",{"rides":1,"hydratation":2},{"dense":2}]]},{"code":"v8","groupe":"miroir","t":"Votre peau vous paraît plus fine qu’avant (petits vaisseaux visibles, peau qui marque vite) :","o":[["Non",{},{}],["Un peu",{"densite":1},{"fin":1}],["Oui",{"densite":2},{"fin":2}],["Très nettement",{"densite":3},{"fin":3}]]},{"code":"b1","groupe":"besoins","t":"Ce qui vous gêne le plus aujourd’hui :","zonesVisees":[["ovale","cou"],["ovale","cou"],["ovale"],["yeux","front"],["grain"],["grain"],["ovale","grain"],["grain"]],"o":[["Mon visage se relâche",{"fermete":3,"densite":1}],["Ma peau manque de fermeté",{"fermete":3,"densite":1}],["Mon ovale est moins net",{"fermete":3,"densite":1}],["Mes rides et ridules",{"rides":3,"hydratation":1,"densite":1}],["Ma peau tiraille, elle manque de confort",{"hydratation":3}],["Mon teint manque d’éclat",{"hydratation":2,"densite":1}],["Ma peau paraît moins dense, plus fine",{"fermete":1,"rides":1,"densite":3}],["Mon grain de peau, mes pores",{"rides":1,"hydratation":2,"densite":1}]]},{"code":"b2","groupe":"besoins","t":"Les zones que vous souhaitez améliorer (plusieurs choix possibles) :","multi":true,"zonesVisees":[["ovale"],["cou"],["decollete"],["yeux"],["front"],["sillons"],["ovale","cou","grain","decollete"]],"o":[["Ovale et bajoues"],["Cou"],["Décolleté"],["Contour des yeux"],["Front"],["Sillons nasogéniens"],["Visage + cou + décolleté"]]},{"code":"b3","groupe":"besoins","t":"Votre objectif est plutôt :","o":[["Entretenir ma peau",{"hydratation":1}],["Prévenir les signes de l’âge",{"hydratation":1,"densite":1}],["Améliorer visiblement ma qualité de peau",{"hydratation":2}],["Raffermir et lisser ma peau",{"fermete":2,"rides":1}],["Agir sur les signes de l’âge de manière globale",{"fermete":1,"rides":1,"hydratation":1,"densite":1}]]},{"code":"q10","groupe":"hist","t":"Avez-vous déjà réalisé des soins esthétiques du visage ?","o":[["Oui"],["Non"]]},{"code":"q10b","groupe":"hist","t":"Lesquels ?","multi":true,"si":{"code":"q10","option":0},"o":[["Soins visage classiques"],["Technologies esthétiques"],["Peelings"],["Laser"],["Injections"],["Autre"]]},{"code":"q10c","groupe":"hist","t":"Date du dernier peeling, laser ou injection :","si":{"code":"q10","option":0},"o":[["Moins d’un mois"],["1 à 6 mois"],["Plus de 6 mois"],["Jamais"]]}],"PROFILS":{"fermete_ovale":{"nom":"Fermeté & Ovale","texte":"Votre peau présente principalement un besoin de fermeté et de tonicité. L’ovale du visage peut être moins défini et la peau manquer de maintien. L’objectif est d’améliorer la fermeté et la qualité globale des tissus.","besoins":["Raffermir","Tonifier","Redessiner l’ovale","Préserver la densité"],"radiofrequence":"Ce que la radiofréquence peut apporter : une fermeté et une tenue de l’ovale qui s’améliorent progressivement."},"rides_densite":{"nom":"Rides & Densité","texte":"Votre peau présente principalement des signes liés aux rides et à la perte de densité. L’objectif est de renforcer la structure de la peau, d’améliorer sa qualité et de préserver son aspect tonique.","besoins":["Lisser","Densifier","Raffermir","Améliorer la structure cutanée"],"radiofrequence":"Ce que la radiofréquence peut apporter : des ridules et une texture améliorées ; les rides d’expression marquées répondent moins."},"hydratation_qualite":{"nom":"Hydratation & Qualité","texte":"Votre peau présente principalement un besoin d’hydratation et d’amélioration de sa qualité globale. L’objectif est de retrouver davantage de confort, de souplesse et d’éclat.","besoins":["Hydrater","Revitaliser","Illuminer","Améliorer la qualité de peau"],"radiofrequence":"Ce que la radiofréquence peut apporter : un grain et une texture de peau améliorés. L’hydratation relève surtout des soins et de la routine à la maison."},"global":{"nom":"Anti-Âge Global","texte":"Votre peau présente plusieurs besoins anti-âge complémentaires. Une approche globale et personnalisée permet d’agir sur les différents signes observés.","besoins":["Raffermir","Lisser","Densifier","Hydrater","Améliorer la qualité de peau"],"radiofrequence":"Ce que la radiofréquence peut apporter : fermeté et texture sur les zones observées, de façon progressive."}},"TERRAINS":{"hydratation":{"nom":"Hydratation","texte":"Votre peau semble avoir principalement besoin d’hydratation et de confort afin de retrouver davantage de souplesse et d’éclat."},"sensible":{"nom":"Sensible / Réactif","texte":"Votre peau semble présenter une sensibilité particulière. Une approche douce et adaptée est recommandée afin de préserver son équilibre.","consigne":"Votre thérapeute adaptera la chaleur à la sensibilité de votre peau."},"dense":{"nom":"Dense / Épaissi","texte":"Votre peau semble présenter une texture plus dense ou irrégulière. L’objectif est d’améliorer progressivement sa qualité et sa souplesse."},"fin":{"nom":"Fin / Fragilisé","texte":"Votre peau semble plus fine ou fragilisée et nécessite une approche personnalisée visant à préserver sa densité et sa tonicité."}},"CURES":[{"code":"decouverte","nom":"Découverte","seances":4,"mois":1,"rythme":"Une séance par semaine pendant un mois","semaines":[1,2,3,4],"note":"Photos de contrôle à 3 mois.","jusqua":1},{"code":"equilibre","nom":"Équilibre","seances":6,"mois":2,"rythme":"4 séances hebdomadaires, puis une toutes les deux semaines","semaines":[1,2,3,4,6,8],"note":"Photos de contrôle à 3 mois.","jusqua":3},{"code":"integrale","nom":"Intégrale","seances":10,"mois":3,"rythme":"8 séances hebdomadaires, puis une toutes les deux semaines","semaines":[1,2,3,4,5,6,7,8,10,12],"note":"Nouveau bilan et photos à 3 mois pour mesurer l’amélioration."}],"MENTION":"Le Profil Signature est un outil d’aide à l’analyse et à la personnalisation. Il ne constitue pas un diagnostic médical. La radiofréquence agit sur la fermeté et la texture de la peau ; elle n’améliore pas l’hydratation, qui relève des soins et de la routine à la maison."}'::jsonb, true, 'Bilan Profil Signature anti-âge, spécification du 21 septembre 2026')
ON CONFLICT (version) DO UPDATE SET contenu = EXCLUDED.contenu, actif = EXCLUDED.actif;

-- ---------------------------------------------------------------------------
-- 4. LA FAMILLE DE BILAN, ET LA CARTE DES ZONES
-- ---------------------------------------------------------------------------

ALTER TABLE bilans DROP CONSTRAINT IF EXISTS bilans_famille_check;
ALTER TABLE bilans ADD CONSTRAINT bilans_famille_check
  CHECK (famille IN ('perte_de_poids', 'anti_age', 'signature'));

/*
  Ce que la thérapeute a vu, zone par zone : {"ovale": 3, "cou": 2, …}.
  Ce n’est pas une réponse de la cliente, et ça ne se déduit d’aucune
  réponse — c’est une observation, et la moitié de chaque axe en dépend.
  Vide pour les deux autres bilans, qui n’observent rien.
*/
ALTER TABLE bilans
  ADD COLUMN IF NOT EXISTS observation jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN bilans.observation IS
  'Profil Signature : la cotation des sept zones par la thérapeute, 0 à 3. Vide sur les autres bilans.';

CREATE OR REPLACE FUNCTION verifier_bareme_du_bilan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.famille = 'anti_age' THEN
    IF NOT EXISTS (SELECT 1 FROM bareme_anti_age WHERE version = NEW.bareme_version) THEN
      RAISE EXCEPTION 'Le barème anti-âge version % n''existe pas.', NEW.bareme_version;
    END IF;
  ELSIF NEW.famille = 'signature' THEN
    IF NOT EXISTS (SELECT 1 FROM bareme_signature WHERE version = NEW.bareme_version) THEN
      RAISE EXCEPTION 'Le barème Profil Signature version % n''existe pas.', NEW.bareme_version;
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM bareme_empreinte WHERE version = NEW.bareme_version) THEN
      RAISE EXCEPTION 'Le barème BioPortrait version % n''existe pas.', NEW.bareme_version;
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION verifier_bareme_du_bilan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION verifier_bareme_du_bilan() TO authenticated;

DROP TRIGGER IF EXISTS bilans_bareme_existe ON bilans;
CREATE TRIGGER bilans_bareme_existe
  BEFORE INSERT OR UPDATE OF famille, bareme_version ON bilans
  FOR EACH ROW EXECUTE FUNCTION verifier_bareme_du_bilan();

COMMENT ON COLUMN bilans.famille IS
  'perte_de_poids : BioPortrait (bareme_empreinte). anti_age : Bio-Portrait Anti-Âge (bareme_anti_age). signature : Profil Signature (bareme_signature). bareme_version se lit dans la table de sa famille.';

-- ---------------------------------------------------------------------------
-- Contrôle : les tarifs, le barème actif et ce qu’il contient, la colonne.
-- ---------------------------------------------------------------------------

SELECT
  (SELECT montant FROM tarifs WHERE code = 'radiofrequence'           ORDER BY effet_le DESC LIMIT 1) AS visage_et_cou,
  (SELECT montant FROM tarifs WHERE code = 'radiofrequence_decollete' ORDER BY effet_le DESC LIMIT 1) AS avec_decollete,
  (SELECT montant FROM tarifs WHERE code = 'bilan_signature'          ORDER BY effet_le DESC LIMIT 1) AS premier_rendez_vous,
  (SELECT version FROM bareme_signature WHERE actif)                                                  AS bareme_actif,
  (SELECT jsonb_array_length(contenu->'QUESTIONS') FROM bareme_signature WHERE actif)                 AS questions,
  (SELECT jsonb_array_length(contenu->'ZONES')     FROM bareme_signature WHERE actif)                 AS zones,
  (SELECT jsonb_array_length(contenu->'CURES')     FROM bareme_signature WHERE actif)                 AS cures,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name = 'bilans' AND column_name = 'observation')                               AS colonne_observation;
