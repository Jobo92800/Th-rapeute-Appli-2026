/*
  MAbeautyplus V2 — Migration 005 : bilan, programme, règlement, séances

  Le cœur métier de la nouvelle méthode.

    bareme_empreinte  le questionnaire et sa pondération, stockés en base
                      pour pouvoir évoluer sans toucher au code
    bilans            un passage de bilan : réponses, InBody, Empreinte
    programmes        la cure vendue, avec les prix figés à la validation
    programme_lignes  le détail par technologie
    echeances         acompte et échéances, avec leur statut de règlement
    seances           chaque venue, avec le jeu imposé et le verrou de clôture
    mensurations      les 11 mesures corporelles
    ventes_complements  les compléments vendus, reliés au stock
*/

-- ===========================================================================
-- 1. BARÈME DU QUESTIONNAIRE
-- ===========================================================================

CREATE TABLE IF NOT EXISTS bareme_empreinte (
  version     integer PRIMARY KEY,
  contenu     jsonb NOT NULL,
  actif       boolean NOT NULL DEFAULT false,
  commentaire text NOT NULL DEFAULT '',
  cree_le     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bareme_empreinte IS
  'Questions, options et pondération par axe. Chaque bilan retient la version qui l''a produit, pour rester recalculable si le questionnaire évolue.';

-- Une seule version active à la fois.
CREATE UNIQUE INDEX IF NOT EXISTS bareme_une_seule_active ON bareme_empreinte (actif) WHERE actif;

INSERT INTO bareme_empreinte (version, contenu, actif, commentaire)
VALUES (1, '{"STEPS": [{"phase": "client", "type": "radio", "t": "En fin de journée, l''envie de quelque chose de sucré ou de gras s''impose, même sans vraie faim.", "o": [["Jamais", {}], ["Parfois", {"P1": 1}], ["Souvent", {"P1": 2}], ["Presque chaque soir", {"P1": 3}]]}, {"phase": "client", "type": "radio", "t": "Quand une émotion monte (stress, contrariété, ennui), manger m''aide à l''apaiser.", "o": [["Pas du tout", {}], ["Un peu", {"P1": 1}], ["Assez", {"P1": 2}], ["Tout à fait", {"P1": 3}]]}, {"phase": "client", "type": "radio", "t": "Ce qui décrit le mieux votre façon de manger :", "o": [["Je mange pour me réconforter", {"P1": 2}], ["Je mange vite, machinalement", {"P4": 2}], ["Je saute des repas puis je me rattrape", {"P5": 2}], ["Je mange équilibré, et pourtant je ne perds pas", {"T4": 2}]]}, {"phase": "client", "type": "radio", "t": "Après un repas, vous ressentez le plus souvent :", "o": [["Un ballonnement, le ventre qui gonfle", {"T5": 2, "T2": 1}], ["Un coup de barre", {"T4": 2}], ["Une faim qui revient vite", {"T1": 2, "P1": 1}], ["Rien de particulier", {}]]}, {"phase": "client", "type": "radio", "t": "Je me sens sous tension ou « à cent à l''heure », même sans raison urgente.", "o": [["Jamais", {}], ["Parfois", {"P2": 1}], ["Souvent", {"P2": 2}], ["En permanence", {"P2": 3}]]}, {"phase": "client", "type": "radio", "t": "Ma charge mentale (penser à tout, tout gérer) est constamment élevée.", "o": [["Pas vraiment", {}], ["Un peu", {"P2": 1}], ["Beaucoup", {"P2": 2}], ["Épuisante", {"P2": 3}]]}, {"phase": "client", "type": "radio", "t": "Votre sommeil ressemble le plus à :", "o": [["Je m''endors difficilement", {"P2": 2}], ["Je me réveille la nuit, vers 3–4 h", {"T1": 2, "P2": 1}], ["Je dors mais je me réveille fatiguée", {"T4": 2, "P4": 1}], ["Je dors bien", {}]]}, {"phase": "client", "type": "radio", "t": "En ce moment, devant le miroir :", "o": [["Je me reconnais", {}], ["Je suis gênée mais ça va", {"P3": 1}], ["Je m''évite", {"P3": 3}]]}, {"phase": "client", "type": "radio", "t": "J''ai le sentiment de m''être « laissée aller » et de ne plus être tout à fait moi-même.", "o": [["Pas du tout", {}], ["Un peu", {"P3": 1}], ["Assez", {"P3": 2}], ["Complètement", {"P3": 3}]]}, {"phase": "client", "type": "radio", "t": "Mon énergie est basse ; bouger me demande un vrai effort.", "o": [["Jamais", {}], ["Parfois", {"P4": 1}], ["Souvent", {"P4": 2}], ["Presque tout le temps", {"P4": 3}]]}, {"phase": "client", "type": "radio", "t": "J''ai perdu le lien avec mon corps ; je ne l''écoute plus vraiment.", "o": [["Pas du tout", {}], ["Un peu", {"P4": 1}], ["Beaucoup", {"P4": 2}]]}, {"phase": "client", "type": "radio", "t": "J''ai déjà suivi plusieurs régimes ou méthodes, avec un effet yo-yo.", "o": [["Non", {}], ["Un ou deux", {"P5": 1}], ["Plusieurs", {"P5": 2}], ["Beaucoup, en boucle", {"P5": 3}]]}, {"phase": "client", "type": "radio", "t": "J''ai l''impression que « mon corps résiste » et que rien ne fonctionne durablement.", "o": [["Pas du tout", {}], ["Un peu", {"P5": 1}], ["Beaucoup", {"P5": 3}]]}, {"phase": "client", "type": "radio", "t": "Votre historique de poids ressemble le plus à :", "o": [["Stable, puis une prise récente", {"P2": 1}], ["Un yo-yo depuis des années", {"P5": 2}], ["Une prise progressive et continue", {"T4": 2}], ["Une prise liée à un événement (grossesse, ménopause, choc)", {"T1": 2}]]}, {"phase": "client", "type": "radio", "t": "Quand vous prenez du poids, votre corps stocke en priorité :", "o": [["Sur le ventre", {"T1": 2, "P2": 1}], ["Sur les hanches, cuisses, culotte de cheval", {"T1": 2}], ["Sur le bas des jambes, avec un gonflement", {"T3": 2}], ["Partout, de façon diffuse", {"T2": 1, "T4": 1}]]}, {"phase": "client", "type": "radio", "t": "En fin de journée, vos jambes sont plutôt :", "o": [["Légères", {}], ["Lourdes et gonflées", {"T3": 2}], ["Douloureuses", {"T3": 1, "T2": 1}]]}, {"phase": "client", "type": "radio", "t": "Si vous appuyez quelques secondes sur le haut de la cheville en fin de journée, la marque met du temps à s''effacer.", "o": [["Non / je ne sais pas", {}], ["Un peu", {"T3": 1}], ["Oui, nettement", {"T3": 2}]]}, {"phase": "client", "type": "radio", "t": "Vos mains et vos pieds sont souvent froids, vous êtes frileuse.", "o": [["Non", {}], ["Un peu", {"T4": 1}], ["Nettement", {"T4": 2}]]}, {"phase": "client", "type": "radio", "t": "Au réveil, votre visage et vos doigts sont plutôt :", "o": [["Nets", {}], ["Un peu bouffis, les bagues serrent", {"T2": 2, "T3": 1}]]}, {"phase": "client", "type": "radio", "t": "Votre transit est :", "o": [["Régulier", {}], ["Plutôt paresseux / constipé", {"T5": 2}], ["Ballonné, le ventre gonfle dans la journée", {"T5": 2}]]}, {"phase": "client", "type": "radio", "t": "Votre peau est réactive : rougeurs, imperfections, sensibilité récurrentes.", "o": [["Non, stable", {}], ["Parfois", {"T2": 1}], ["Souvent", {"T2": 2}]]}, {"phase": "client", "type": "radio", "t": "Votre étape de vie :", "o": [["Aucun changement hormonal", {}], ["Périménopause / ménopause", {"T1": 1}], ["Post-grossesse récente", {"T1": 1}]]}, {"phase": "client", "type": "radio", "major": true, "t": "S''il fallait nommer LA raison n°1 qui vous empêche de perdre :", "o": [["Mes émotions et le grignotage", {"P1": 4}], ["Mon stress et mon rythme de vie", {"P2": 4}], ["Ne plus me sentir bien dans mon corps", {"P3": 4}], ["Mon manque d''énergie et de mouvement", {"P4": 4}], ["Mon corps qui résiste malgré mes efforts", {"P5": 4}]]}, {"phase": "client", "type": "radio", "major": true, "t": "Ce que votre corps fait le plus :", "o": [["Il retient l''eau, il gonfle", {"T2": 4}], ["Il stocke dès que je stresse", {"T1": 4}], ["Tout se joue sur le bas du corps", {"T3": 4}], ["Il brûle lentement, je stocke facilement", {"T4": 4}], ["Je digère mal, je suis souvent ballonnée", {"T5": 4}]]}, {"phase": "client", "type": "slider", "t": "Votre blocage, vous le sentez plutôt :", "left": "Dans la tête, le comportement", "right": "Dans le corps, la physiologie"}, {"phase": "client", "type": "text", "t": "En une phrase, qu''aimeriez-vous transformer en priorité ?"}, {"phase": "client", "type": "contact"}, {"type": "transition"}, {"phase": "analyse", "type": "radio", "t": "Graisse viscérale", "o": [["Basse", {}], ["Moyenne", {"T1": 1}], ["Élevée", {"T1": 2, "T2": 1}]]}, {"phase": "analyse", "type": "radio", "t": "Masse musculaire", "o": [["Élevée", {}], ["Moyenne", {"T4": 1}], ["Basse", {"T4": 2, "P4": 1}]]}, {"phase": "analyse", "type": "radio", "t": "Métabolisme de base", "o": [["Rapide", {}], ["Normal", {"T4": 1}], ["Lent", {"T4": 2}]]}, {"phase": "analyse", "type": "radio", "t": "Masse grasse principalement localisée :", "o": [["Sur le haut du corps", {"T1": 2}], ["Répartie de façon diffuse", {"T2": 2}], ["Sur le bas du corps", {"T3": 2, "T1": 1}]]}, {"phase": "analyse", "type": "radio", "t": "Niveau d''eau corporelle / rétention", "o": [["Normal", {}], ["Rétention marquée", {"T2": 2, "T3": 1}]]}, {"phase": "analyse", "type": "radio", "t": "Âge métabolique par rapport à l''âge réel", "o": [["Inférieur ou égal", {}], ["Supérieur", {"T4": 2}]]}, {"phase": "analyse", "type": "radio", "t": "Niveau de masse grasse", "o": [["Normal", {}], ["Modérément élevé", {"T2": 1}], ["Élevé", {"T2": 1, "T1": 1}]]}], "AX": {"P1": {"name": "Réconfort", "sig": "« l''aliment refuge »", "feel": "Chez vous, l''aliment n''est pas un besoin, c''est une <b>régulation émotionnelle</b>. Face au stress, le cerveau réclame du sucre pour libérer de la dopamine, et le réconfort devient un réflexe automatique.", "imp": ["Grignotage sucré du soir", "Humeur en dents de scie", "Culpabilité après les repas", "Énergie qui chute le soir"], "note": "L''aliment sert d''apaisement émotionnel ; le grignotage s''installe en réflexe."}, "P2": {"name": "Sous Pression", "sig": "« le corps en alerte »", "feel": "Votre corps vit en <b>état d''alerte permanent</b>. Le stress maintient un cortisol élevé, l''hormone qui pousse à stocker sur le ventre, et qui sabote le sommeil.", "imp": ["Cortisol élevé, stockage du ventre", "Sommeil léger", "Fringales de fin de journée", "Récupération lente"], "note": "Le stress chronique entretient le stockage et fatigue le sommeil."}, "P3": {"name": "Rupture", "sig": "« le lien distendu »", "feel": "Le lien avec votre image s''est <b>distendu</b>. À force de vous éviter dans le miroir, la motivation s''érode : on ne prend pas soin d''un corps dont on s''est coupée.", "imp": ["Évitement des miroirs et photos", "Baisse de confiance", "Motivation en pointillés", "Sentiment de ne plus être soi"], "note": "Le rapport à l''image s''est distendu, la motivation s''en ressent."}, "P4": {"name": "En Veille", "sig": "« le corps endormi »", "feel": "Votre corps tourne au ralenti. Moins de mouvement, c''est moins de masse musculaire, donc un <b>métabolisme qui s''endort</b> et une énergie qui manque à l''appel.", "imp": ["Fatigue au réveil", "Masse musculaire en baisse", "Sensations émoussées", "Le mouvement coûte"], "note": "Le corps est en veille : peu de mouvement, énergie basse."}, "P5": {"name": "Résistance", "sig": "« le corps verrouillé »", "feel": "Votre corps s''est <b>verrouillé pour se protéger</b>. À force de régimes, le métabolisme s''est adapté à la baisse : il apprend à résister et à tout stocker dès que possible.", "imp": ["Effet yo-yo installé", "Perte de poids qui stagne", "Découragement", "Métabolisme sur la défensive"], "note": "Les tentatives passées ont installé un métabolisme sur la défensive."}, "T1": {"name": "Hormonal", "sig": "« le stockage hormonal »", "feel": "Vos hormones pilotent le stockage. Un déséquilibre discret (cortisol, œstrogènes, thyroïde, cycle) suffit à <b>bloquer la perte</b> et à orienter le stockage sur le ventre ou les hanches.", "imp": ["Stockage ventre et hanches", "Variations d''humeur", "Fatigue cyclique", "Résistance à la perte"], "note": "Les hormones orientent le stockage et freinent la perte."}, "T2": {"name": "Inflammatoire", "sig": "« le corps qui se défend »", "feel": "Votre organisme entretient une <b>inflammation silencieuse</b>. Vos cellules stockent par réflexe de protection : le corps se défend au lieu de déstocker, et retient l''eau.", "imp": ["Rétention d''eau", "Ventre gonflé le matin", "Articulations sensibles", "Peau réactive"], "note": "Une inflammation de fond pousse le corps à retenir et à se défendre."}, "T3": {"name": "Circulatoire", "sig": "« les fluides qui stagnent »", "feel": "Votre circulation est paresseuse. Les <b>fluides stagnent</b> au lieu de circuler : ils s''accumulent dans le bas du corps et forment une rétention visible en fin de journée.", "imp": ["Jambes lourdes", "Gonflement du bas du corps", "Cellulite aqueuse", "Marque du godet"], "note": "Les fluides circulent mal et stagnent dans le bas du corps."}, "T4": {"name": "Métabolique Lent", "sig": "« le moteur au ralenti »", "feel": "Votre moteur brûle au ralenti. Vous dépensez moins que vous ne stockez, souvent avec une <b>signature thyroïdienne discrète</b> : frilosité, mains froides, digestion lente.", "imp": ["Perte de poids lente", "Frilosité, mains froides", "Coup de barre après les repas", "Masse musculaire à réveiller"], "note": "Le métabolisme brûle lentement, le corps stocke facilement."}, "T5": {"name": "Digestif", "sig": "« l''assimilation ralentie »", "feel": "Votre digestion peine à suivre. <b>Assimilation et élimination sont ralenties</b>, le ventre gonfle, et un système digestif engorgé freine toute la perte.", "imp": ["Ballonnements", "Transit irrégulier", "Lourdeur après manger", "Inconfort abdominal"], "note": "La digestion et l''élimination sont ralenties, le ventre gonfle."}}, "CURE_PRIO": {"T1": "On équilibre le terrain hormonal et on cible le stockage abdominal.", "T2": "On calme l''inflammation et on relance l''élimination.", "T3": "On relance le drainage en priorité.", "T4": "On réveille le métabolisme et on relance la combustion.", "T5": "On soulage la digestion et on désengorge."}, "TERRAIN_COMPL": {"T1": {"n": "Le Draineur", "r": "soutient l''élimination et le déstockage"}, "T2": {"n": "Le Draineur", "r": "évacue l''eau retenue, désengorge le terrain inflammatoire"}, "T3": {"n": "Le Draineur", "r": "relance la circulation et draine le bas du corps"}, "T4": {"n": "Burn / Le Minceur", "r": "relance la combustion des graisses"}, "T5": {"n": "Le Sauveur", "r": "soutient la digestion et l''assimilation"}}}'::jsonb, true,
        'Version d''origine, reprise du formulaire Bilan Empreinte.')
ON CONFLICT (version) DO UPDATE SET contenu = EXCLUDED.contenu;

-- ===========================================================================
-- 2. BILANS
-- ===========================================================================

CREATE TABLE IF NOT EXISTS bilans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            uuid REFERENCES clientes(id) ON DELETE CASCADE,
  centre_id             text NOT NULL REFERENCES centres(id),
  therapeute_id         uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),

  date_bilan            date NOT NULL DEFAULT CURRENT_DATE,
  statut                text NOT NULL DEFAULT 'en_cours'
                          CHECK (statut IN ('en_cours', 'termine', 'abandonne')),

  bareme_version        integer NOT NULL DEFAULT 1 REFERENCES bareme_empreinte(version),
  reponses              jsonb NOT NULL DEFAULT '{}'::jsonb,
  curseur               integer NOT NULL DEFAULT 50 CHECK (curseur BETWEEN 0 AND 100),
  texte_libre           text NOT NULL DEFAULT '',
  inbody                jsonb NOT NULL DEFAULT '{}'::jsonb,

  scores                jsonb NOT NULL DEFAULT '{}'::jsonb,
  profil_dominant       text,
  terrain_dominant      text,
  profils_secondaires   text[] NOT NULL DEFAULT '{}',
  terrains_secondaires  text[] NOT NULL DEFAULT '{}',

  -- 87 € si la cliente ne démarre pas, offert si elle démarre.
  facturation           text NOT NULL DEFAULT 'en_attente'
                          CHECK (facturation IN ('en_attente', 'facture', 'offert')),
  montant_facture       numeric(10,2),

  cree_le               timestamptz NOT NULL DEFAULT now(),
  maj_le                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bilans_cliente_idx ON bilans (cliente_id, date_bilan DESC);
CREATE INDEX IF NOT EXISTS bilans_centre_idx  ON bilans (centre_id, date_bilan DESC);

DROP TRIGGER IF EXISTS bilans_maj_le ON bilans;
CREATE TRIGGER bilans_maj_le BEFORE UPDATE ON bilans
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

-- ===========================================================================
-- 3. PROGRAMMES
-- ===========================================================================

CREATE TABLE IF NOT EXISTS programmes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  bilan_id              uuid REFERENCES bilans(id) ON DELETE SET NULL,
  centre_id             text NOT NULL REFERENCES centres(id),
  therapeute_id         uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),

  numero                integer NOT NULL DEFAULT 1,
  statut                text NOT NULL DEFAULT 'propose'
                          CHECK (statut IN ('propose', 'valide', 'en_cours', 'termine', 'abandonne')),

  electro               boolean NOT NULL DEFAULT false,
  guide                 boolean NOT NULL DEFAULT true,

  -- Prix figés à la validation : les cures passées ne bougent jamais.
  prix_guide            numeric(10,2) NOT NULL DEFAULT 0,
  prix_tenue            numeric(10,2) NOT NULL DEFAULT 0,
  montant_total         numeric(10,2) NOT NULL DEFAULT 0,

  mode_reglement        text NOT NULL DEFAULT '4x_maison'
                          CHECK (mode_reglement IN ('comptant', '4x_maison', '10x_alma')),
  frais_financement     numeric(10,2) NOT NULL DEFAULT 0,

  complement_recommande text,
  date_validation       date,

  cree_le               timestamptz NOT NULL DEFAULT now(),
  maj_le                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, numero)
);

CREATE INDEX IF NOT EXISTS programmes_cliente_idx ON programmes (cliente_id, numero);
CREATE INDEX IF NOT EXISTS programmes_centre_idx  ON programmes (centre_id, statut);

DROP TRIGGER IF EXISTS programmes_maj_le ON programmes;
CREATE TRIGGER programmes_maj_le BEFORE UPDATE ON programmes
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

CREATE TABLE IF NOT EXISTS programme_lignes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id    uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  technologie     text NOT NULL CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome')),
  seances_prevues integer NOT NULL DEFAULT 0 CHECK (seances_prevues >= 0),
  prix_unitaire   numeric(10,2) NOT NULL DEFAULT 0,
  UNIQUE (programme_id, technologie)
);

-- ===========================================================================
-- 4. ÉCHÉANCES
-- ===========================================================================

CREATE TABLE IF NOT EXISTS echeances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id    uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  type            text NOT NULL DEFAULT 'echeance' CHECK (type IN ('acompte', 'echeance')),
  rang            integer NOT NULL,
  montant         numeric(10,2) NOT NULL DEFAULT 0,
  date_prevue     date,
  moyen           text CHECK (moyen IS NULL OR moyen IN ('cheque', 'especes', 'cb', 'virement', 'alma')),
  statut          text NOT NULL DEFAULT 'a_venir'
                    CHECK (statut IN ('a_venir', 'paye', 'donne', 'impaye')),
  date_reglement  date,
  note            text,
  UNIQUE (programme_id, type, rang)
);

CREATE INDEX IF NOT EXISTS echeances_programme_idx ON echeances (programme_id, rang);
CREATE INDEX IF NOT EXISTS echeances_a_encaisser_idx ON echeances (date_prevue)
  WHERE statut IN ('a_venir', 'impaye');

-- ===========================================================================
-- 5. SÉANCES
--    Le nombre de séances restantes se déduit d'ici : jamais un compteur saisi.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS seances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id    uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  cliente_id      uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  centre_id       text NOT NULL REFERENCES centres(id),
  therapeute_id   uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),

  date_seance     date NOT NULL DEFAULT CURRENT_DATE,
  technologie     text NOT NULL CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome')),

  poids           numeric(5,2),
  commentaire     text NOT NULL DEFAULT '',
  photo_prise     boolean NOT NULL DEFAULT false,

  -- Le jeu du jour, imposé par le moteur.
  jeu_code        text REFERENCES jeux(code),
  jeu_valide      boolean NOT NULL DEFAULT false,
  jeu_reponse     jsonb NOT NULL DEFAULT '{}'::jsonb,

  cloturee        boolean NOT NULL DEFAULT false,
  cree_le         timestamptz NOT NULL DEFAULT now(),

  -- La règle de la méthode : pas de clôture sans jeu validé.
  CONSTRAINT cloture_exige_le_jeu CHECK (NOT cloturee OR jeu_valide)
);

CREATE INDEX IF NOT EXISTS seances_programme_idx ON seances (programme_id, date_seance DESC);
CREATE INDEX IF NOT EXISTS seances_cliente_idx   ON seances (cliente_id, date_seance DESC);
CREATE INDEX IF NOT EXISTS seances_jeux_faits_idx ON seances (programme_id, jeu_code) WHERE cloturee;

-- ===========================================================================
-- 6. MENSURATIONS
-- ===========================================================================

CREATE TABLE IF NOT EXISTS mensurations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  programme_id  uuid REFERENCES programmes(id) ON DELETE SET NULL,
  centre_id     text NOT NULL REFERENCES centres(id),
  date_mesure   date NOT NULL DEFAULT CURRENT_DATE,
  poitrine      numeric(5,1),
  sous_poitrine numeric(5,1),
  taille        numeric(5,1),
  ventre        numeric(5,1),
  hanches       numeric(5,1),
  bras_droit    numeric(5,1),
  bras_gauche   numeric(5,1),
  cuisse_droite numeric(5,1),
  cuisse_gauche numeric(5,1),
  mollet_droit  numeric(5,1),
  mollet_gauche numeric(5,1),
  cree_le       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mensurations_cliente_idx ON mensurations (cliente_id, date_mesure DESC);

-- ===========================================================================
-- 7. VENTES DE COMPLÉMENTS
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ventes_complements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  programme_id  uuid REFERENCES programmes(id) ON DELETE SET NULL,
  centre_id     text NOT NULL REFERENCES centres(id),
  therapeute_id uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),
  date_vente    date NOT NULL DEFAULT CURRENT_DATE,
  produit       text NOT NULL CHECK (produit IN ('BURN', 'SOS', 'DETOX', 'SKIN')),
  quantite      integer NOT NULL DEFAULT 1 CHECK (quantite > 0),
  prix_unitaire numeric(10,2) NOT NULL DEFAULT 37,
  cree_le       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ventes_complements_cliente_idx
  ON ventes_complements (cliente_id, date_vente DESC);

-- ===========================================================================
-- 8. VUE DE SUIVI : séances vendues, faites, restantes
-- ===========================================================================

-- security_invoker : la vue applique les droits de l'appelant, donc le
-- cloisonnement par centre des tables sous-jacentes s'applique aussi ici.
CREATE OR REPLACE VIEW suivi_seances WITH (security_invoker = true) AS
SELECT
  p.id                                              AS programme_id,
  p.cliente_id,
  p.centre_id,
  l.technologie,
  l.seances_prevues,
  COUNT(s.id) FILTER (WHERE s.cloturee)             AS seances_faites,
  l.seances_prevues - COUNT(s.id) FILTER (WHERE s.cloturee) AS seances_restantes
FROM programmes p
JOIN programme_lignes l ON l.programme_id = p.id
LEFT JOIN seances s ON s.programme_id = p.id AND s.technologie = l.technologie
GROUP BY p.id, p.cliente_id, p.centre_id, l.technologie, l.seances_prevues;

-- ===========================================================================
-- 9. SYNCHRONISATION AIRTABLE
-- ===========================================================================

DROP TRIGGER IF EXISTS bilans_vers_airtable ON bilans;
CREATE TRIGGER bilans_vers_airtable
  AFTER INSERT OR UPDATE OF statut, profil_dominant, terrain_dominant, facturation
  ON bilans FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('bilan');

DROP TRIGGER IF EXISTS programmes_vers_airtable ON programmes;
CREATE TRIGGER programmes_vers_airtable
  AFTER INSERT OR UPDATE OF statut, montant_total, mode_reglement, electro
  ON programmes FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('programme');

-- ===========================================================================
-- 10. RLS — tout est cloisonné par centre
-- ===========================================================================

ALTER TABLE bareme_empreinte   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bilans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_lignes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE echeances          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seances            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensurations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes_complements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bareme_lecture ON bareme_empreinte;
CREATE POLICY bareme_lecture ON bareme_empreinte FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS bareme_ecriture ON bareme_empreinte;
CREATE POLICY bareme_ecriture ON bareme_empreinte FOR ALL TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bilans', 'programmes', 'seances', 'mensurations', 'ventes_complements']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_acces', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (acces_centre(centre_id)) WITH CHECK (acces_centre(centre_id))',
      t || '_acces', t);
  END LOOP;
END $$;

-- Les lignes et échéances suivent l'accès de leur programme.
DROP POLICY IF EXISTS programme_lignes_acces ON programme_lignes;
CREATE POLICY programme_lignes_acces ON programme_lignes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_id AND acces_centre(p.centre_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_id AND acces_centre(p.centre_id)));

DROP POLICY IF EXISTS echeances_acces ON echeances;
CREATE POLICY echeances_acces ON echeances FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_id AND acces_centre(p.centre_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_id AND acces_centre(p.centre_id)));
