/*
  MAbeautyplus V2 — Migration 056 : le Bio-Portrait Anti-Âge et l'Advance Lift

  UN SECOND BILAN, AU GRAU-DU-ROI SEULEMENT.

  Le Bio-Portrait Anti-Âge est un questionnaire de quatorze questions qui
  produit un profil anti-âge (Fermeté & Ovale · Rides & Densité ·
  Hydratation & Qualité · Anti-Âge Global) et un terrain cutané
  (Hydratation · Sensible / Réactif · Dense / Épaissi · Fin / Fragilisé).
  Il ne prescrit rien : « le soin et le nombre de séances restent à la
  décision de la praticienne ». Le soin est l'Advance Lift, 85 € la séance,
  sans guide ni tenue. Spécification de Jonathan du 11 septembre 2026.

  CE QUE ÇA CRÉE.

    1. Le tarif `advance_lift`, daté comme les autres.
    2. L'Advance Lift au catalogue des soins (programme_lignes, seances).
       Il avait été retiré avec la V1 ; il revient pour l'anti-âge.
    3. Une séance d'Advance Lift se clôture sans Mission Déclic — la
       Mission Déclic est une règle de la perte de poids, pas de l'anti-âge.
    4. La table `bareme_anti_age`, séparée de `bareme_empreinte` : ce n'est
       pas le même questionnaire, pas les mêmes axes, pas les mêmes règles,
       et « une seule version active » doit valoir pour chacun des deux.
    5. `bilans.famille` : de quel questionnaire un bilan est né. Chaque
       bilan retient sa version de barème ; il faut aussi savoir de quelle
       table la lire.

  Rejouable sans risque.
*/

-- 1. Le tarif.
INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('advance_lift', '2026-01-01', 85.00, 'Séance d''Advance Lift — Bio-Portrait Anti-Âge')
ON CONFLICT (code, effet_le) DO NOTHING;

-- 2. L'Advance Lift au catalogue.
ALTER TABLE programme_lignes DROP CONSTRAINT IF EXISTS programme_lignes_technologie_check;
ALTER TABLE programme_lignes ADD CONSTRAINT programme_lignes_technologie_check
  CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome', 'relax', 'advance_lift'));

ALTER TABLE seances DROP CONSTRAINT IF EXISTS seances_technologie_check;
ALTER TABLE seances ADD CONSTRAINT seances_technologie_check
  CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome', 'relax', 'advance_lift'));

-- 3. Pas de Mission Déclic sur l'Advance Lift.
ALTER TABLE seances DROP CONSTRAINT IF EXISTS cloture_exige_le_jeu;
ALTER TABLE seances ADD CONSTRAINT cloture_exige_le_jeu
  CHECK (NOT cloturee OR jeu_valide OR technologie = 'advance_lift');

-- 4. Le questionnaire anti-âge, versionné.
CREATE TABLE IF NOT EXISTS bareme_anti_age (
  version     integer PRIMARY KEY,
  contenu     jsonb NOT NULL,
  actif       boolean NOT NULL DEFAULT false,
  commentaire text NOT NULL DEFAULT '',
  cree_le     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bareme_anti_age IS
  'Le Bio-Portrait Anti-Âge : questions, points par axe et par terrain, textes des profils et des terrains. Chaque bilan anti-âge retient sa version.';

CREATE UNIQUE INDEX IF NOT EXISTS bareme_anti_age_une_seule_active
  ON bareme_anti_age (actif) WHERE actif;

ALTER TABLE bareme_anti_age ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bareme_anti_age_lecture ON bareme_anti_age;
CREATE POLICY bareme_anti_age_lecture ON bareme_anti_age
  FOR SELECT TO authenticated USING (true);

INSERT INTO bareme_anti_age (version, contenu, actif, commentaire) VALUES
  (1, '{"AXES":{"fermete":"Fermeté","rides":"Rides","hydratation":"Hydratation / Qualité","densite":"Densité"},"PROFILS":{"fermete_ovale":{"nom":"Fermeté & Ovale","signes":"Relâchement cutané, perte de fermeté, ovale moins défini, manque de tonicité.","besoins":["Raffermir","Tonifier","Redessiner l’ovale","Préserver la densité"],"texte":"Votre peau présente principalement un besoin de fermeté et de tonicité. L’ovale du visage peut être moins défini et la peau manquer de maintien. L’objectif est d’améliorer la fermeté et la qualité globale des tissus."},"rides_densite":{"nom":"Rides & Densité","signes":"Rides, ridules, perte de densité, peau plus fine, aspect froissé.","besoins":["Lisser","Densifier","Raffermir","Améliorer la structure cutanée"],"texte":"Votre peau présente principalement des signes liés aux rides et à la perte de densité. L’objectif est de renforcer la structure de la peau, d’améliorer sa qualité et de préserver son aspect tonique."},"hydratation_qualite":{"nom":"Hydratation & Qualité","signes":"Déshydratation, manque d’éclat, teint terne, texture irrégulière, manque de confort.","besoins":["Hydrater","Revitaliser","Illuminer","Améliorer la qualité de peau"],"texte":"Votre peau présente principalement un besoin d’hydratation et d’amélioration de sa qualité globale. L’objectif est de retrouver davantage de confort, de souplesse et d’éclat."},"global":{"nom":"Anti-Âge Global","signes":"Relâchement, rides, déshydratation, perte de densité et plusieurs besoins associés.","besoins":["Raffermir","Lisser","Densifier","Hydrater","Améliorer la qualité de peau"],"texte":"Votre peau présente plusieurs besoins anti-âge complémentaires. Une approche globale et personnalisée permet d’agir sur les différents signes observés."}},"TERRAINS":{"hydratation":{"nom":"Hydratation","caracteristiques":"Tiraillements, manque de confort, manque de souplesse, déshydratation.","besoins":["Hydrater","Assouplir","Redonner du confort"],"texte":"Votre peau semble avoir principalement besoin d’hydratation et de confort afin de retrouver davantage de souplesse et d’éclat."},"sensible":{"nom":"Sensible / Réactif","caracteristiques":"Rougeurs, réactions rapides, sensibilité, inconfort.","besoins":["Apaiser","Respecter","Protéger"],"texte":"Votre peau semble présenter une sensibilité particulière. Une approche douce et adaptée est recommandée afin de préserver son équilibre."},"dense":{"nom":"Dense / Épaissi","caracteristiques":"Peau plus épaisse, texture irrégulière, manque de souplesse.","besoins":["Lisser","Améliorer la texture","Assouplir"],"texte":"Votre peau semble présenter une texture plus dense ou irrégulière. L’objectif est d’améliorer progressivement sa qualité et sa souplesse."},"fin":{"nom":"Fin / Fragilisé","caracteristiques":"Peau fine, fragilité, perte de densité, manque de tonicité.","besoins":["Renforcer","Densifier","Raffermir"],"texte":"Votre peau semble plus fine ou fragilisée et nécessite une approche personnalisée visant à préserver sa densité et sa tonicité."}},"QUESTIONS":[{"code":"Q1","type":"radio","t":"Votre besoin principal est :","o":[["Le relâchement cutané",{"fermete":3,"densite":1}],["Le manque de fermeté",{"fermete":3,"densite":1}],["Les rides / ridules",{"rides":3,"hydratation":1,"densite":1}],["Le manque d’hydratation",{"hydratation":3}],["Le manque d’éclat",{"hydratation":2,"densite":1}],["La perte de densité",{"fermete":1,"rides":1,"densite":3}],["La qualité / texture de peau",{"rides":1,"hydratation":2,"densite":1}],["L’ovale du visage",{"fermete":3,"densite":1}]]},{"code":"Q2","type":"radio","info":"zone","t":"La zone que vous souhaitez principalement améliorer :","o":[["Visage"],["Ovale du visage"],["Cou"],["Décolleté"],["Contour des yeux"],["Visage + cou + décolleté"]]},{"code":"Q3","type":"radio","t":"Votre peau vous paraît actuellement :","o":[["Ferme et tonique",{}],["Légèrement relâchée",{"fermete":1}],["Relâchée",{"fermete":2,"densite":1}],["Très relâchée",{"fermete":3,"densite":1}]]},{"code":"Q4","type":"radio","t":"Votre peau vous paraît :","o":[["Bien hydratée",{}],["Légèrement déshydratée",{"hydratation":1,"densite":1}],["Déshydratée",{"hydratation":2,"densite":1}],["Très déshydratée",{"hydratation":3,"densite":1}]]},{"code":"Q5","type":"radio","t":"Vos rides et ridules sont :","o":[["Peu visibles",{}],["Principalement visibles à l’expression",{"rides":1}],["Visibles au repos",{"rides":2,"densite":1}],["Marquées",{"rides":3,"densite":1}]]},{"code":"Q6","type":"radio","t":"Votre ovale du visage vous paraît :","o":[["Bien défini",{}],["Légèrement moins défini",{"fermete":1}],["Moins défini",{"fermete":2,"densite":1}],["Nettement relâché",{"fermete":3,"densite":1}]]},{"code":"Q7","type":"radio","t":"La qualité de votre peau vous paraît :","o":[["Lisse et régulière",{}],["Légèrement irrégulière",{"rides":1,"hydratation":1,"densite":1}],["Terne / fatiguée",{"hydratation":2,"densite":1}],["Fine / froissée / irrégulière",{"rides":1,"hydratation":2,"densite":2}]]},{"code":"Q8","type":"radio","t":"Votre objectif est plutôt :","o":[["Entretenir ma peau",{"hydratation":1}],["Prévenir les signes de l’âge",{"hydratation":1,"densite":1}],["Améliorer visiblement ma qualité de peau",{"hydratation":2}],["Raffermir et lisser ma peau",{"fermete":2,"rides":1}],["Agir sur les signes de l’âge de manière globale",{"fermete":1,"rides":1,"hydratation":1,"densite":1}]]},{"code":"Q9","type":"radio","info":"parcours","t":"Vous recherchez :","o":[["Un soin ponctuel"],["Une amélioration progressive"],["Une cure de soins"],["Un programme personnalisé"]]},{"code":"Q10","type":"radio","info":"historique","t":"Avez-vous déjà réalisé des soins esthétiques du visage ?","o":[["Oui"],["Non"]]},{"code":"Q10b","type":"multi","info":"historique","si":{"code":"Q10","option":0},"t":"Lesquels ?","o":[["Soins visage classiques"],["Technologies esthétiques"],["Peelings"],["Laser"],["Injections"],["Autre"]]},{"code":"Q11","type":"radio","t":"Votre peau réagit-elle facilement ?","o":[["Non",{},{}],["Occasionnellement",{},{"sensible":1}],["Régulièrement",{},{"sensible":2}],["Très facilement",{},{"sensible":3}]]},{"code":"Q12","type":"radio","t":"Votre peau tiraille-t-elle ?","o":[["Jamais",{},{}],["Parfois",{},{"hydratation":1}],["Régulièrement",{},{"hydratation":2}],["Très souvent",{},{"hydratation":3}]]},{"code":"Q13","type":"radio","t":"Votre peau vous paraît-elle fine ou fragile ?","o":[["Non",{},{}],["Légèrement",{},{"fin":1}],["Oui",{},{"fin":2}],["Très fine / fragile",{},{"fin":3}]]},{"code":"Q14","type":"radio","t":"Votre peau vous paraît-elle épaisse ou irrégulière ?","o":[["Non",{},{}],["Légèrement",{},{"dense":1}],["Oui",{},{"dense":2}],["Très nettement",{},{"dense":3}]]}],"MENTION":"Le Bio-Portrait est un outil d’aide à l’analyse et à la personnalisation. Il ne constitue pas un diagnostic médical et ne détermine pas automatiquement le soin ni le nombre de séances."}'::jsonb, true, 'Bio-Portrait Anti-Âge, spécification du 11 septembre 2026')
ON CONFLICT (version) DO UPDATE SET contenu = EXCLUDED.contenu, actif = EXCLUDED.actif;

-- 5. De quel questionnaire un bilan est né.
ALTER TABLE bilans
  ADD COLUMN IF NOT EXISTS famille text NOT NULL DEFAULT 'perte_de_poids'
    CHECK (famille IN ('perte_de_poids', 'anti_age'));

/*
  `bareme_version` pointait sur `bareme_empreinte` par une clé étrangère.
  Un bilan anti-âge porte une version de `bareme_anti_age` : la clé le
  refuserait dès que les deux numérotations divergent. Elle tombe, et c'est
  la famille qui dit dans quelle table lire. Un déclencheur vérifie que la
  version existe bien dans la table de sa famille — la base ne laisse pas
  entrer un bilan qui ne pourrait pas être relu.
*/
ALTER TABLE bilans DROP CONSTRAINT IF EXISTS bilans_bareme_version_fkey;

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
  ELSE
    IF NOT EXISTS (SELECT 1 FROM bareme_empreinte WHERE version = NEW.bareme_version) THEN
      RAISE EXCEPTION 'Le barème BioPortrait version % n''existe pas.', NEW.bareme_version;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- La règle depuis la 040 : chaque fonction porte son propre droit. Un
-- déclencheur s'exécute avec les droits de qui écrit, donc `authenticated`.
REVOKE ALL ON FUNCTION verifier_bareme_du_bilan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION verifier_bareme_du_bilan() TO authenticated;

DROP TRIGGER IF EXISTS bilans_bareme_existe ON bilans;
CREATE TRIGGER bilans_bareme_existe
  BEFORE INSERT OR UPDATE OF famille, bareme_version ON bilans
  FOR EACH ROW EXECUTE FUNCTION verifier_bareme_du_bilan();

COMMENT ON COLUMN bilans.famille IS
  'perte_de_poids : BioPortrait (bareme_empreinte). anti_age : Bio-Portrait Anti-Âge (bareme_anti_age). bareme_version se lit dans la table de sa famille.';

-- Contrôle : le tarif, le barème actif, et la colonne.
SELECT
  (SELECT montant FROM tarifs WHERE code = 'advance_lift' ORDER BY effet_le DESC LIMIT 1) AS tarif_advance_lift,
  (SELECT version FROM bareme_anti_age WHERE actif)                                       AS bareme_anti_age_actif,
  (SELECT jsonb_array_length(contenu->'QUESTIONS') FROM bareme_anti_age WHERE actif)     AS questions,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name = 'bilans' AND column_name = 'famille')                       AS bilans_famille;
