-- ==============================================================
-- MAbeautyplus V2 — installation complète du schéma
-- Les trois migrations enchaînées. À coller en une fois dans
-- l'éditeur SQL de Supabase, puis Run.
-- ==============================================================

/*
  MAbeautyplus V2 — Migration 001 : référentiel et contrôle d'accès

  À exécuter dans l'éditeur SQL du projet Supabase DÉDIÉ À LA V2.

  La base de l'application actuelle est gérée par Bolt et les fiches clientes
  vivent sur Firebase : rien n'est partagé, rien n'est modifié. La V2 démarre
  sur une base neuve, et l'ancienne application continue de tourner
  exactement comme avant.

  Contenu
    1. Table centres            — les 5 centres, reprise de la config V1
    2. Table comptes_centre     — relie un compte Supabase Auth à un centre
    3. Fonctions d'accès        — centre du compte connecté, rôle direction
    4. Table therapeutes        — les prénoms proposés à la sélection
    5. Table tarifs             — les prix, datés, jamais en dur dans le code
    6. Table jeux               — la bibliothèque des 60 jeux
*/

-- ---------------------------------------------------------------------------
-- 1. CENTRES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS centres (
  id                    text PRIMARY KEY,
  nom                   text NOT NULL,
  societe               text NOT NULL,
  siren                 text NOT NULL,
  adresse               text NOT NULL,
  code_postal           text NOT NULL,
  ville                 text NOT NULL,
  telephone             text NOT NULL,
  email                 text NOT NULL,
  siege_adresse         text NOT NULL,
  siege_code_postal     text NOT NULL,
  siege_ville           text NOT NULL,
  nom_airtable          text NOT NULL,
  actif                 boolean NOT NULL DEFAULT true,
  cree_le               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN centres.nom_airtable IS
  'Valeur exacte du champ Centre dans la table Airtable Clients.';

INSERT INTO centres (id, nom, societe, siren, adresse, code_postal, ville, telephone, email,
                     siege_adresse, siege_code_postal, siege_ville, nom_airtable) VALUES
  ('grau-du-roi', 'Le Grau-du-Roi', 'MB1PRO', '853 874 428 00016', '577 Rue des Tamaris',    '30240', 'Le Grau-du-Roi', '04 66 73 02 00', 'contact@mabeautyplus.fr', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Le Grau-du-Roi'),
  ('le-cres',     'Le Crès',        'MB2PRO', '982 876 047 00019', '1 Avenue des Chasseurs',  '34920', 'Le Crès',        '04 66 73 02 00', 'contact@mabeautyplus.fr', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Le Crès'),
  ('serignan',    'Sérignan',       'MB3PRO', '928 646 322 00018', '120 Avenue de la Plage',  '34410', 'Sérignan',       '04 66 73 02 00', 'contact@mabeautyplus.fr', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Sérignan'),
  ('cabestany',   'Cabestany',      'MB4PRO', '938 742 541 00015', '4 Rue Ambroise Croizat',  '66330', 'Cabestany',      '04 66 73 02 00', 'contact@mabeautyplus.fr', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Cabestany'),
  ('avignon',     'Avignon',        'MB5PRO', '102 009 677 00018', '8 Bd de la Fraternité',   '84140', 'Avignon',        '04 66 73 02 00', 'contact@mabeautyplus.fr', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Avignon')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. COMPTES DE CENTRE
--    Un compte Supabase Auth par centre. Le rôle "direction" voit tous les centres.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS comptes_centre (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  centre_id   text REFERENCES centres(id),
  role        text NOT NULL DEFAULT 'centre' CHECK (role IN ('centre', 'direction')),
  cree_le     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT centre_requis_sauf_direction
    CHECK (role = 'direction' OR centre_id IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- 3. FONCTIONS D'ACCÈS
--    STABLE + SECURITY DEFINER : lisibles depuis les policies sans récursion.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION centre_courant()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT centre_id FROM comptes_centre WHERE user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION est_direction()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT COALESCE((SELECT role = 'direction' FROM comptes_centre WHERE user_id = auth.uid()), false) $$;

-- Vrai si le compte connecté a le droit d'agir sur ce centre.
CREATE OR REPLACE FUNCTION acces_centre(cible text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT est_direction() OR cible = centre_courant() $$;

-- ---------------------------------------------------------------------------
-- 4. THÉRAPEUTES
--    Simple référentiel de prénoms : la connexion se fait par centre, la
--    thérapeute est sélectionnée à la main sur la fiche (choix retenu en V2).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS therapeutes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id   text NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  prenom      text NOT NULL,
  actif       boolean NOT NULL DEFAULT true,
  ordre       integer NOT NULL DEFAULT 0,
  cree_le     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centre_id, prenom)
);

CREATE INDEX IF NOT EXISTS therapeutes_centre_idx ON therapeutes (centre_id) WHERE actif;

INSERT INTO therapeutes (centre_id, prenom, ordre) VALUES
  ('grau-du-roi', 'Marie', 1), ('grau-du-roi', 'Fanny', 2), ('grau-du-roi', 'Nadia', 3), ('grau-du-roi', 'Stéphanie', 4),
  ('le-cres', 'Alexandra', 1), ('le-cres', 'Paola', 2), ('le-cres', 'Malvina', 3), ('le-cres', 'Flora', 4),
  ('serignan', 'Caroll', 1), ('serignan', 'Aude', 2), ('serignan', 'Marie-san', 3),
  ('cabestany', 'Audrey', 1), ('cabestany', 'Sara', 2), ('cabestany', 'Alexandra C', 3), ('cabestany', 'Marine', 4),
  ('avignon', 'Alexandra 2', 1), ('avignon', 'Laura', 2)
ON CONFLICT (centre_id, prenom) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. TARIFS
--    Chaque prix a une date d'effet. Un programme copie le prix en vigueur
--    au moment de sa validation : les cures passées ne bougent jamais.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tarifs (
  code            text NOT NULL,
  effet_le        date NOT NULL DEFAULT CURRENT_DATE,
  montant         numeric(10,2) NOT NULL CHECK (montant >= 0),
  libelle         text NOT NULL,
  PRIMARY KEY (code, effet_le)
);

INSERT INTO tarifs (code, effet_le, montant, libelle) VALUES
  ('seance',  '2026-01-01',  59.00, 'Séance de 30 minutes intégrée à l''accompagnement'),
  ('guide',   '2026-01-01',  29.00, 'Guide de rééquilibrage alimentaire — systématique'),
  ('tenue',   '2026-01-01',  60.00, 'Tenue I-Shape — si électrostimulation'),
  ('bilan',   '2026-01-01',  87.00, 'Bilan Empreinte seul — offert si démarrage'),
  ('dome',    '2026-01-01',  39.00, 'Séance de Dôme (à confirmer : 39 € ou 59 €)')
ON CONFLICT (code, effet_le) DO NOTHING;

-- Prix en vigueur pour un code donné, à une date donnée.
CREATE OR REPLACE FUNCTION tarif_en_vigueur(p_code text, p_date date DEFAULT CURRENT_DATE)
RETURNS numeric
LANGUAGE sql STABLE
AS $$
  SELECT montant FROM tarifs
  WHERE code = p_code AND effet_le <= p_date
  ORDER BY effet_le DESC LIMIT 1
$$;

-- ---------------------------------------------------------------------------
-- 6. JEUX
--    Bibliothèque des 60 jeux. Le contenu est chargé par la migration 003.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS jeux (
  code              text PRIMARY KEY,
  phase             text NOT NULL CHECK (phase IN ('A', 'B', 'C')),
  etape             integer NOT NULL,
  theme             text NOT NULL,
  titre             text NOT NULL,
  materiel          text NOT NULL,
  objectif          text NOT NULL,
  regles            jsonb NOT NULL DEFAULT '[]'::jsonb,
  phrase_lancement  text NOT NULL DEFAULT '',
  mission           text NOT NULL DEFAULT '',
  duree             text NOT NULL DEFAULT '',
  options           jsonb NOT NULL DEFAULT '[]'::jsonb,
  a_enregistrer     text NOT NULL DEFAULT '',
  action_cliente    text NOT NULL DEFAULT '',
  prise_conscience  text NOT NULL DEFAULT '',
  resultat          text NOT NULL DEFAULT '',
  petit_pas         text NOT NULL DEFAULT '',
  nature            text NOT NULL DEFAULT 'action' CHECK (nature IN ('pedagogique', 'action')),
  prioritaire       boolean NOT NULL DEFAULT false,
  ordre             integer NOT NULL DEFAULT 0
);

COMMENT ON COLUMN jeux.nature IS
  'Sert à alterner pédagogique / action quand la cliente vient deux fois dans la semaine.';
COMMENT ON COLUMN jeux.prioritaire IS
  'Jeux conservés en priorité sur les programmes courts.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE centres        ENABLE ROW LEVEL SECURITY;
ALTER TABLE comptes_centre ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapeutes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jeux           ENABLE ROW LEVEL SECURITY;

-- Référentiels : lecture pour tout compte connecté, écriture réservée à la direction.
DROP POLICY IF EXISTS centres_lecture ON centres;
CREATE POLICY centres_lecture ON centres FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS therapeutes_lecture ON therapeutes;
CREATE POLICY therapeutes_lecture ON therapeutes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS therapeutes_ecriture ON therapeutes;
CREATE POLICY therapeutes_ecriture ON therapeutes FOR ALL TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

DROP POLICY IF EXISTS tarifs_lecture ON tarifs;
CREATE POLICY tarifs_lecture ON tarifs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tarifs_ecriture ON tarifs;
CREATE POLICY tarifs_ecriture ON tarifs FOR ALL TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

DROP POLICY IF EXISTS jeux_lecture ON jeux;
CREATE POLICY jeux_lecture ON jeux FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS jeux_ecriture ON jeux;
CREATE POLICY jeux_ecriture ON jeux FOR ALL TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

-- Un compte ne lit que sa propre ligne de rattachement.
DROP POLICY IF EXISTS comptes_centre_soi ON comptes_centre;
CREATE POLICY comptes_centre_soi ON comptes_centre FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR est_direction());


/*
  MAbeautyplus V2 — Migration 002 : fiches clientes et miroir Airtable

  À exécuter après la migration 001, dans le même projet.

  Contenu
    1. Table clientes           — la fiche, avec l'id Airtable stocké
    2. Table airtable_sync      — la file d'attente de synchronisation
    3. Déclencheur d'envoi      — toute création / modification alimente la file
    4. RLS                      — un compte ne voit que les clientes de son centre
*/

-- ---------------------------------------------------------------------------
-- 1. CLIENTES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clientes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id           text NOT NULL REFERENCES centres(id),

  prenom              text NOT NULL,
  nom                 text NOT NULL,
  email               text,
  telephone           text,
  date_naissance      date,
  age                 integer CHECK (age IS NULL OR (age > 0 AND age < 120)),
  adresse             text,
  code_postal         text,
  ville               text,
  source              text,                     -- « comment nous avez-vous connu ? »

  therapeutes         text[] NOT NULL DEFAULT '{}',

  -- Miroir Airtable : renseigné à la première synchro, ne change plus jamais.
  airtable_record_id  text UNIQUE,

  -- Traçabilité de la transition V1 → V2.
  origine             text NOT NULL DEFAULT 'v2' CHECK (origine IN ('v2', 'import_v1')),
  origine_ref         text,                     -- identifiant Firestore si repris de la V1

  archivee_le         timestamptz,
  cree_le             timestamptz NOT NULL DEFAULT now(),
  maj_le              timestamptz NOT NULL DEFAULT now(),
  cree_par            uuid DEFAULT auth.uid()
);

COMMENT ON COLUMN clientes.airtable_record_id IS
  'Identifiant de l''enregistrement Airtable. Remplace la recherche par nom + prénom + centre de la V1.';
COMMENT ON COLUMN clientes.therapeutes IS
  'Prénoms sélectionnés à la main. La connexion se faisant par centre, la thérapeute est choisie sur la fiche.';

CREATE INDEX IF NOT EXISTS clientes_centre_idx  ON clientes (centre_id) WHERE archivee_le IS NULL;
CREATE INDEX IF NOT EXISTS clientes_nom_idx     ON clientes (centre_id, lower(nom), lower(prenom));
CREATE INDEX IF NOT EXISTS clientes_creation_idx ON clientes (centre_id, cree_le DESC);

-- Recherche plein texte simple sur nom / prénom / email / téléphone.
CREATE INDEX IF NOT EXISTS clientes_recherche_idx ON clientes
  USING gin (to_tsvector('simple',
    coalesce(prenom,'') || ' ' || coalesce(nom,'') || ' ' ||
    coalesce(email,'')  || ' ' || coalesce(telephone,'')));

CREATE OR REPLACE FUNCTION touch_maj_le()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.maj_le := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clientes_maj_le ON clientes;
CREATE TRIGGER clientes_maj_le BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

-- ---------------------------------------------------------------------------
-- 2. FILE D'ATTENTE AIRTABLE
--    L'écriture en base n'est jamais bloquée par Airtable. Une fonction Edge
--    dépile cette table, avec réessai et journal des erreurs.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS airtable_sync (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entite            text NOT NULL,
  entite_id         uuid NOT NULL,
  statut            text NOT NULL DEFAULT 'en_attente'
                      CHECK (statut IN ('en_attente', 'en_cours', 'ok', 'erreur')),
  tentatives        integer NOT NULL DEFAULT 0,
  derniere_erreur   text,
  cree_le           timestamptz NOT NULL DEFAULT now(),
  traite_le         timestamptz
);

-- Une seule tâche en attente par entité : les modifications successives
-- fusionnent au lieu de créer une tâche par frappe clavier (défaut de la V1).
CREATE UNIQUE INDEX IF NOT EXISTS airtable_sync_en_attente_unique
  ON airtable_sync (entite, entite_id) WHERE statut IN ('en_attente', 'erreur');

CREATE INDEX IF NOT EXISTS airtable_sync_a_traiter_idx
  ON airtable_sync (cree_le) WHERE statut IN ('en_attente', 'erreur');

-- ---------------------------------------------------------------------------
-- 3. DÉCLENCHEUR
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enfiler_airtable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO airtable_sync (entite, entite_id)
  VALUES (TG_ARGV[0], NEW.id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clientes_vers_airtable ON clientes;
CREATE TRIGGER clientes_vers_airtable
  AFTER INSERT OR UPDATE OF prenom, nom, email, telephone, date_naissance, age,
                            adresse, code_postal, ville, source, therapeutes
  ON clientes
  FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('cliente');

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE airtable_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clientes_lecture ON clientes;
CREATE POLICY clientes_lecture ON clientes FOR SELECT TO authenticated
  USING (acces_centre(centre_id));

DROP POLICY IF EXISTS clientes_creation ON clientes;
CREATE POLICY clientes_creation ON clientes FOR INSERT TO authenticated
  WITH CHECK (acces_centre(centre_id));

DROP POLICY IF EXISTS clientes_modification ON clientes;
CREATE POLICY clientes_modification ON clientes FOR UPDATE TO authenticated
  USING (acces_centre(centre_id)) WITH CHECK (acces_centre(centre_id));

-- Suppression réservée à la direction : on archive, on ne supprime pas.
DROP POLICY IF EXISTS clientes_suppression ON clientes;
CREATE POLICY clientes_suppression ON clientes FOR DELETE TO authenticated
  USING (est_direction());

-- La file de synchro est lisible (écran de contrôle) mais écrite par le serveur.
DROP POLICY IF EXISTS airtable_sync_lecture ON airtable_sync;
CREATE POLICY airtable_sync_lecture ON airtable_sync FOR SELECT TO authenticated
  USING (true);


/*
  MAbeautyplus V2 — Migration 003 : la bibliothèque des 60 jeux

  Contenu extrait de la présentation réseau V50.
  Phase A : 20 jeux · Phase B : 25 jeux · Phase C : 15 jeux.

  Deux colonnes restent à renseigner par la direction, elles n'empêchent pas
  le moteur de fonctionner :
    - nature      : « pedagogique » ou « action », pour alterner quand la
                    cliente vient deux fois dans la même semaine.
                    Toutes les lignes sont créées en « action » par défaut.
    - prioritaire : les jeux à conserver sur un programme court.
                    Voir la question des 10 / 12 / 8 jeux annoncés.
*/

INSERT INTO jeux (
  code, phase, etape, theme, titre, materiel, objectif, regles,
  phrase_lancement, mission, duree, options, a_enregistrer, action_cliente,
  prise_conscience, resultat, petit_pas, ordre
) VALUES
  ('A01', 'A', 3, 'Priorité de départ', 'Ma priorité de la semaine', '6 cartes à poser : REPAS · GRIGNOTAGES / ENVIES · HYDRATATION · SOMMEIL · STRESS · MOUVEMENT', 'Choisir le sujet qui servira de fil rouge jusqu’au prochain rendez-vous.', '["Poser les 6 cartes devant la cliente.", "Lui demander d’en choisir UNE.", "Demander : « Qu’est-ce qui est le plus difficile pour vous dans ce sujet ? »"]'::jsonb, 'Parmi ces 6 sujets, lequel voulez-vous améliorer en premier cette semaine ?', 'Repérer 3 moments où cette difficulté apparaît cette semaine, sans chercher à la corriger.', '3 min', '["🍽️ REPAS", "🍪 GRIGNOTAGES / ENVIES", "💧 HYDRATATION", "🌙 SOMMEIL", "⚡ STRESS", "🚶 MOUVEMENT"]'::jsonb, 'Enregistrer la priorité choisie. Ex. : Grignotages / envies.', 'Choisit 1 carte parmi 6 : le sujet qu’elle veut améliorer en premier.', 'Elle identifie clairement sa priorité du moment.', 'Cette priorité devient le fil rouge jusqu’au prochain rendez-vous.', 'Observer simplement 3 moments où cette difficulté apparaît.', 1),
  ('A02', 'A', 3, 'Organisation', 'Reset : ma semaine 1', 'Plateau semaine + 6 jetons', 'Repérer les moments de la semaine à simplifier en priorité.', '["Poser les jetons sur les moments compliqués.", "Choisir les 2 plus difficiles.", "Trouver une simplification pour chacun."]'::jsonb, 'Montrez-moi les moments où votre semaine devient la plus compliquée.', 'Préparer 2 repas simples à l’avance.', '3–5 min', '[]'::jsonb, '', 'Place 3 jetons sur les moments de la semaine où ses repas deviennent compliqués.', 'Elle voit quand son organisation lui fait perdre ses repères.', 'On choisit 1 moment précis à simplifier cette semaine.', 'Préparer 2 repas simples à l’avance.', 2),
  ('A03', 'A', 3, 'Hydratation', 'Combien je bois vraiment ?', 'Jauge + pince', 'Comparer l’impression de boire avec la quantité réellement consommée.', '["Estimer sa quantité d’eau.", "Placer la pince sur la jauge.", "Comparer avec ce qui est réellement bu."]'::jsonb, 'À votre avis, combien buvez-vous vraiment dans une journée ?', 'Mesurer réellement pendant 24 h.', '3–5 min', '[]'::jsonb, '', 'Place une pince sur la quantité d’eau qu’elle pense boire dans une journée.', 'Elle visualise concrètement son niveau d’hydratation.', 'Elle repart avec un repère simple à vérifier pendant 24 h.', 'Mesurer réellement pendant 24 h.', 3),
  ('A04', 'A', 3, 'Alimentation', 'Mon assiette repère', 'Assiette A5 + cartes aliments', 'Construire un repère visuel simple pour les repas.', '["Composer un repas habituel.", "Repérer ce qui manque.", "Construire son assiette repère."]'::jsonb, 'Composez-moi un repas comme vous le feriez chez vous.', 'Reproduire l’assiette repère sur 3 repas.', '3–5 min', '[]'::jsonb, '', 'Compose un repas habituel avec les cartes aliments.', 'Elle voit immédiatement ce qui manque ou prend trop de place.', 'On construit ensemble une assiette repère simple à reproduire.', 'Reproduire l’assiette repère sur 3 repas.', 4),
  ('A05', 'A', 3, 'Comportements', 'Faim ou envie ?', '2 cartes FAIM / ENVIE', 'Apprendre à distinguer une faim physique d’une envie de manger.', '["Penser à un grignotage récent.", "Choisir FAIM ou ENVIE.", "Expliquer le choix en une phrase."]'::jsonb, 'Pensez à votre dernier grignotage : c’était plutôt de la faim ou une envie ?', 'Se poser la question avant 1 grignotage.', '3–5 min', '[]'::jsonb, '', 'Choisit FAIM ou ENVIE pour un grignotage récent.', 'Elle apprend à distinguer besoin physique et envie de manger.', 'Elle sait quelle question se poser avant un prochain grignotage.', 'Se poser la question avant 1 grignotage.', 5),
  ('A06', 'A', 3, 'Alimentation', 'Le puzzle protéines', 'Cartes aliments + 3 cartes repas', 'Repérer où ajouter une source de protéines dans la journée.', '["Repérer les aliments protéinés.", "Les placer aux repas possibles.", "Choisir le repas le plus faible."]'::jsonb, 'Parmi ces aliments, lesquels pourraient renforcer vos repas ?', 'Ajouter une source adaptée au repas le plus faible.', '3–5 min', '[]'::jsonb, '', 'Place les cartes protéines sur ses repas habituels.', 'Elle repère le repas où une source de protéines manque le plus.', 'On choisit 1 ajout simple pour ce repas.', 'Ajouter une source adaptée au repas le plus faible.', 6),
  ('A07', 'A', 3, 'Alimentation', 'L’arc-en-ciel des végétaux', '6 cartes couleurs', 'Visualiser la variété végétale de la semaine.', '["Garder les couleurs consommées souvent.", "Repérer les couleurs absentes.", "Choisir une couleur à ajouter."]'::jsonb, 'Quelles couleurs retrouvez-vous le plus souvent dans vos repas ?', 'Ajouter 2 couleurs végétales dans la semaine.', '3–5 min', '[]'::jsonb, '', 'Choisit les couleurs végétales présentes dans ses repas habituels.', 'Elle visualise rapidement la variété de ses végétaux.', 'Elle choisit 1 couleur à ajouter cette semaine.', 'Ajouter 2 couleurs végétales dans la semaine.', 7),
  ('A08', 'A', 3, 'Alimentation', 'Mon petit-déjeuner', '3 cartes profil', 'Observer si le petit-déjeuner actuel correspond réellement à la faim de la cliente.', '["Choisir : pas faim / faim / faim rapide ensuite.", "Décrire un matin type.", "Choisir ce qu’on va observer."]'::jsonb, 'Au réveil, vous vous reconnaissez dans laquelle de ces trois situations ?', 'Observer faim au réveil et vers 11 h pendant 3 jours.', '3–5 min', '[]'::jsonb, '', 'Choisit la carte qui décrit le mieux son matin.', 'Elle observe le lien entre son petit-déjeuner et sa faim de fin de matinée.', 'On choisit un seul élément à observer pendant 3 matins.', 'Observer faim au réveil et vers 11 h pendant 3 jours.', 8),
  ('A09', 'A', 3, 'Comportements', 'Mon moment de grignotage', 'Frise journée + jetons', 'Repérer le moment où le grignotage revient le plus souvent.', '["Replacer 3 grignotages récents.", "Repérer la zone qui revient.", "Entourer le moment à surveiller."]'::jsonb, 'À quels moments vos grignotages arrivent-ils le plus souvent ?', 'Noter 3 situations cette semaine.', '3–5 min', '[]'::jsonb, '', 'Place 3 jetons aux heures de ses derniers grignotages.', 'Elle voit le créneau qui revient le plus souvent.', 'Ce créneau devient le moment à observer cette semaine.', 'Noter 3 situations cette semaine.', 9),
  ('A10', 'A', 3, 'Alimentation', 'Vrai ou faux : les sucres', '5 cartes question + VRAI/FAUX', 'Corriger quelques idées reçues simples sur les sucres.', '["Lire une carte.", "Choisir VRAI ou FAUX.", "Retourner la carte pour voir l’explication."]'::jsonb, 'On va tester quelques idées reçues en cinq cartes.', 'Choisir 1 source de sucre facile à réduire.', '3–5 min', '[]'::jsonb, '', 'Répond VRAI ou FAUX à 3 cartes.', 'Elle corrige une idée reçue simple sur les sucres.', 'Elle garde 1 seul repère utile à appliquer.', 'Choisir 1 source de sucre facile à réduire.', 10),
  ('A11', 'A', 3, 'Organisation', 'Mon panier express', '15 cartes aliments', 'Créer une base de courses simple pour plusieurs repas.', '["Choisir 8 aliments.", "Construire 3 repas avec.", "Vérifier que les 3 repas sont réalistes."]'::jsonb, 'Avec seulement huit aliments, créons trois repas faciles.', 'Faire sa prochaine liste de courses.', '3–5 min', '[]'::jsonb, '', 'Choisit 8 aliments et tente de former 3 repas simples.', 'Elle voit qu’une base de courses simple peut suffire.', 'Elle repart avec une mini-liste de courses réaliste.', 'Faire sa prochaine liste de courses.', 11),
  ('A12', 'A', 3, 'Environnement', 'Ce que je vois, je mange', 'Plan frigo/placard + cartes', 'Rendre l’environnement alimentaire plus favorable.', '["Placer les aliments très visibles chez soi.", "Repérer ce qui déclenche.", "Déplacer un élément."]'::jsonb, 'Qu’est-ce que vous voyez en premier quand vous ouvrez votre cuisine ?', 'Modifier réellement son environnement.', '3–5 min', '[]'::jsonb, '', 'Place les aliments selon ce qu’elle voit en premier chez elle.', 'Elle comprend l’effet de la visibilité sur ses choix.', 'Elle choisit 1 chose à déplacer dans sa cuisine.', 'Modifier réellement son environnement.', 12),
  ('A13', 'A', 3, 'Comportements', 'Mes déclencheurs', '6 cartes déclencheurs', 'Identifier le déclencheur principal des envies de manger.', '["Choisir les 3 plus fréquents.", "Les classer du plus fort au plus faible.", "Garder le n°1."]'::jsonb, 'Parmi ces déclencheurs, lesquels vous concernent le plus ?', 'Observer le déclencheur n°1 pendant 7 jours.', '3–5 min', '[]'::jsonb, '', 'Choisit 1 carte déclencheur parmi 6.', 'Elle identifie ce qui déclenche le plus souvent ses envies de manger.', 'Ce déclencheur devient son point d’observation.', 'Observer le déclencheur n°1 pendant 7 jours.', 13),
  ('A14', 'A', 3, 'Comportements', 'La pause de 10 minutes', '3 cartes actions', 'Créer une petite pause entre l’envie et l’action automatique.', '["Choisir eau / bouger / changer d’activité.", "Imaginer un moment à risque.", "Décider laquelle tester."]'::jsonb, 'Si l’envie arrive ce soir, quelle pause serait la plus facile à tester ?', 'Tester la pause 1 fois.', '3–5 min', '[]'::jsonb, '', 'Choisit 1 carte pause parmi 3.', 'Elle comprend qu’elle peut créer un délai avant un automatisme.', 'Elle choisit la pause qu’elle testera une fois.', 'Tester la pause 1 fois.', 14),
  ('A15', 'A', 3, 'Alimentation', 'Ma faim et ma satiété', 'Règle 0–10 + 2 pinces', 'Apprendre à situer la faim avant et la satiété après le repas.', '["Choisir un repas récent.", "Placer la faim avant.", "Placer la satiété après."]'::jsonb, 'Sur cette échelle, où étiez-vous avant et après votre dernier repas ?', 'Refaire l’exercice 1 fois par jour.', '3–5 min', '[]'::jsonb, '', 'Place 2 pinces : faim avant le repas, satiété après.', 'Elle visualise ses sensations autour du repas.', 'Elle repart avec l’échelle comme repère simple.', 'Refaire l’exercice 1 fois par jour.', 15),
  ('A16', 'A', 3, 'Alimentation', 'Au restaurant, je compose', 'Cartes menu', 'Garder des repères simples tout en conservant le plaisir.', '["Composer un repas qui fait envie.", "Vérifier faim et plaisir.", "Choisir 1 repère à conserver."]'::jsonb, 'Composez le restaurant qui vous ferait vraiment plaisir.', 'Utiliser ce repère au prochain restaurant.', '3–5 min', '[]'::jsonb, '', 'Compose un menu plaisir avec les cartes.', 'Elle voit qu’un restaurant peut rester compatible avec ses repères.', 'Elle choisit 1 repère à garder au prochain restaurant.', 'Utiliser ce repère au prochain restaurant.', 16),
  ('A17', 'A', 3, 'Organisation', 'Mon week-end réaliste', 'Cartes habitudes + samedi/dimanche', 'Éviter le tout-ou-rien du week-end.', '["Choisir 3 repères utiles.", "Les placer sur le week-end.", "Garder seulement ce qui est réaliste."]'::jsonb, 'Quelles habitudes pourriez-vous vraiment garder le week-end ?', 'En maintenir au moins 2.', '3–5 min', '[]'::jsonb, '', 'Choisit 2 habitudes qu’elle peut réellement garder le week-end.', 'Elle comprend qu’elle n’a pas besoin d’être parfaite.', 'Ces 2 habitudes deviennent ses repères du week-end.', 'En maintenir au moins 2.', 17),
  ('A18', 'A', 3, 'Hydratation', 'Mes rendez-vous avec l’eau', 'Cartes moments de journée', 'Associer l’hydratation à des moments faciles à retenir.', '["Choisir 3 moments faciles.", "Les mettre dans l’ordre.", "Associer un verre d’eau à chacun."]'::jsonb, 'À quels moments de votre journée pourriez-vous penser à boire sans effort ?', 'Tester pendant 3 jours.', '3–5 min', '[]'::jsonb, '', 'Place 3 cartes eau à des moments fixes de sa journée.', 'Elle associe l’hydratation à des habitudes déjà existantes.', 'Elle repart avec 3 rendez-vous hydratation simples.', 'Tester pendant 3 jours.', 18),
  ('A19', 'A', 3, 'Mouvement', 'Les occasions invisibles de bouger', 'Maison / trajet / travail', 'Trouver du mouvement sans devoir prévoir une séance de sport.', '["Trouver une petite occasion dans chaque univers.", "Choisir la plus facile.", "Fixer quand la faire."]'::jsonb, 'Où pourriez-vous bouger un peu plus sans bouleverser votre journée ?', 'Ajouter 10 min de mouvement sur 3 journées.', '3–5 min', '[]'::jsonb, '', 'Choisit 1 occasion de bouger dans la maison, le trajet ou le travail.', 'Elle voit que bouger ne signifie pas forcément faire du sport.', 'Elle planifie 1 occasion réaliste de mouvement.', 'Ajouter 10 min de mouvement sur 3 journées.', 19),
  ('A20', 'A', 3, 'Progression', 'Mon premier mois', '8 cartes progrès', 'Faire le point sur les premiers changements et la suite.', '["Choisir 3 choses qui ont progressé.", "Choisir 1 chose encore difficile.", "En faire la priorité suivante."]'::jsonb, 'Qu’est-ce qui a déjà commencé à changer depuis le début ?', 'Renforcer ce levier au mois suivant.', '3–5 min', '[]'::jsonb, '', 'Choisit 3 cartes progrès puis 1 priorité.', 'Elle voit ce qui a déjà changé depuis le début.', 'On choisit ensemble le prochain axe à renforcer.', 'Renforcer ce levier au mois suivant.', 20),
  ('B01', 'B', 4, 'Stress', 'Thermomètre du stress', 'Échelle 0–10 + pince', 'Identifier une action capable de faire baisser le stress d’un petit cran.', '["Placer son stress actuel.", "Demander : qu’est-ce qui ferait -1 ?", "Choisir une action."]'::jsonb, 'Où placez-vous votre stress aujourd’hui ?', 'Tester cette action.', '3–5 min', '[]'::jsonb, '', 'Place la pince sur son niveau de stress du jour.', 'Elle visualise son état au lieu de rester dans une impression vague.', 'Elle choisit 1 action qui pourrait faire baisser ce niveau d’un point.', 'Tester cette action.', 1),
  ('B02', 'B', 4, 'Sommeil', 'Mon sommeil en 5 cartes', '5 cartes sommeil', 'Choisir le levier de sommeil le plus facile à améliorer.', '["Trier en « ça va » / « à améliorer ».", "Choisir le plus accessible.", "Fixer un petit changement."]'::jsonb, 'Parmi ces cinq éléments, lequel serait le plus facile à améliorer ?', 'Changer 1 habitude du soir.', '3–5 min', '[]'::jsonb, '', 'Trie 5 cartes sommeil en « ça va » ou « à améliorer ».', 'Elle repère le levier le plus facile à améliorer.', 'Elle choisit 1 changement simple pour le soir.', 'Changer 1 habitude du soir.', 2),
  ('B03', 'B', 4, 'Énergie', 'Mon budget énergie', '10 jetons', 'Voir où part l’énergie et récupérer une petite place pour soi.', '["Répartir les jetons entre ses obligations.", "Observer où tout part.", "Récupérer 1 jeton pour soi."]'::jsonb, 'Si vous aviez dix jetons d’énergie, où partiraient-ils aujourd’hui ?', 'Créer un petit temps de récupération.', '3–5 min', '[]'::jsonb, '', 'Répartit 10 jetons entre ce qui lui prend de l’énergie.', 'Elle voit où part son énergie dans la journée.', 'Elle récupère 1 jeton pour une activité qui la recharge.', 'Créer un petit temps de récupération.', 3),
  ('B04', 'B', 4, 'Environnement', 'Ce qui m’aide / me freine', 'Cartes situations + 2 zones', 'Distinguer ce qui soutient les changements de ce qui les freine.', '["Trier AIDE / FREINE.", "Garder le frein principal.", "Chercher ce qui peut être modifié."]'::jsonb, 'Qu’est-ce qui vous aide vraiment, et qu’est-ce qui vous freine ?', 'Modifier 1 élément.', '3–5 min', '[]'::jsonb, '', 'Classe des cartes en AIDE ou FREINE.', 'Elle repère ce qui facilite ou sabote ses habitudes.', 'Elle choisit 1 frein concret à modifier.', 'Modifier 1 élément.', 4),
  ('B05', 'B', 4, 'Mouvement', 'Mes minutes invisibles', 'Frise journée + jetons 5 min', 'Trouver de petits moments réalistes pour réduire la sédentarité.', '["Chercher 3 moments disponibles.", "Poser les jetons.", "Garder les plus réalistes."]'::jsonb, 'Où se cachent trois petites fenêtres de cinq minutes dans votre journée ?', 'Faire 3 pauses actives.', '3–5 min', '[]'::jsonb, '', 'Place 3 jetons de 5 minutes dans sa journée.', 'Elle découvre de petits créneaux qu’elle ne voyait pas.', 'Elle choisit 1 créneau pour bouger ou récupérer.', 'Faire 3 pauses actives.', 5),
  ('B06', 'B', 4, 'Organisation', 'Ma semaine réaliste', 'Plateau semaine + 3 cartes objectif', 'Planifier une semaine faisable plutôt qu’une semaine parfaite.', '["Choisir alimentation / mouvement / bien-être.", "Placer une action de chaque.", "Vérifier que c’est faisable."]'::jsonb, 'Construisons une semaine que vous pourriez réellement tenir.', 'Réussir 2 objectifs sur 3.', '3–5 min', '[]'::jsonb, '', 'Place 3 actions réalistes sur sa semaine.', 'Elle voit qu’une bonne semaine n’a pas besoin d’être parfaite.', 'Elle ne garde que les actions qu’elle peut vraiment tenir.', 'Réussir 2 objectifs sur 3.', 6),
  ('B07', 'B', 4, 'Motivation', 'Mes 3 petits pas', 'Escalier 3 marches', 'Découper un objectif trop grand en trois petites étapes.', '["Choisir un objectif.", "Le découper en 3 étapes.", "Regarder uniquement la première."]'::jsonb, 'Quel objectif vous paraît trop gros aujourd’hui ?', 'Faire la marche n°1.', '3–5 min', '[]'::jsonb, '', 'Découpe 1 objectif en 3 petites marches.', 'Elle comprend qu’un grand changement se construit étape par étape.', 'Elle ne garde que la première marche à faire.', 'Faire la marche n°1.', 7),
  ('B08', 'B', 4, 'Comportements', 'Le scénario de mon automatisme', '4 cartes Situation / Ressenti / Action / Après', 'Comprendre la séquence qui mène à un automatisme alimentaire.', '["Reprendre un épisode réel.", "Remettre les 4 cartes dans l’ordre.", "Voir où intervenir."]'::jsonb, 'Reprenons un moment récent où vous avez mangé sans l’avoir vraiment décidé.', 'Modifier 1 étape du scénario.', '3–5 min', '[]'::jsonb, '', 'Remet 4 cartes dans l’ordre : situation → ressenti → action → après.', 'Elle voit comment son automatisme se construit.', 'On choisit l’étape la plus facile à modifier.', 'Modifier 1 étape du scénario.', 8),
  ('B09', 'B', 4, 'Alimentation', 'Mon plaisir au repas social', 'Apéro / plat / dessert / alcool', 'Choisir consciemment où mettre le plaisir lors d’un repas social.', '["Choisir ce qui compte vraiment.", "Garder 1 ou 2 plaisirs prioritaires.", "Décider consciemment."]'::jsonb, 'Dans un repas social, qu’est-ce qui vous fait vraiment plaisir ?', 'Faire ce choix au prochain repas social.', '3–5 min', '[]'::jsonb, '', 'Choisit ce qui lui fait vraiment plaisir dans un repas social.', 'Elle distingue plaisir choisi et accumulation automatique.', 'Elle garde 1 ou 2 plaisirs prioritaires.', 'Faire ce choix au prochain repas social.', 9),
  ('B10', 'B', 4, 'Progression', 'Mes preuves de progression', '8 cartes indicateurs', 'Voir les progrès qui ne se résument pas au poids.', '["Mettre le poids de côté un instant.", "Choisir 3 progrès visibles ailleurs.", "Garder celui qui compte le plus."]'::jsonb, 'Si on oublie la balance une minute, qu’est-ce qui s’est amélioré ?', 'Observer cet indicateur.', '3–5 min', '[]'::jsonb, '', 'Choisit 3 cartes progrès qui ne parlent pas du poids.', 'Elle voit que les résultats ne se résument pas à la balance.', 'Elle garde 1 indicateur à suivre.', 'Observer cet indicateur.', 10),
  ('B11', 'B', 4, 'Habitudes', 'Ce que je fais déjà différemment', 'Cartes habitudes', 'Prendre conscience des habitudes déjà modifiées.', '["Choisir 3 habitudes modifiées.", "Donner un exemple réel.", "En choisir une à consolider."]'::jsonb, 'Qu’est-ce que vous faites aujourd’hui que vous ne faisiez pas au départ ?', 'Répéter volontairement l’habitude choisie.', '3–5 min', '[]'::jsonb, '', 'Choisit 3 habitudes qu’elle fait déjà différemment.', 'Elle réalise qu’elle a déjà modifié son quotidien.', 'Elle choisit 1 habitude à consolider.', 'Répéter volontairement l’habitude choisie.', 11),
  ('B12', 'B', 4, 'Corps', 'Je comprends mon bilan', '9 cartes indicateurs', 'Aider la cliente à comprendre quelques indicateurs utiles de son suivi.', '["Retrouver les 3 indicateurs expliqués.", "Dire ce qu’ils signifient simplement.", "En choisir 1 à suivre."]'::jsonb, 'Parmi ces indicateurs, lesquels vous parlent maintenant le plus ?', 'Le comparer au prochain point.', '3–5 min', '[]'::jsonb, '', 'Associe 3 indicateurs du bilan à leur explication simple.', 'Elle comprend mieux ce que l’équipe suit avec elle.', 'Elle choisit 1 indicateur à revoir au prochain point.', 'Le comparer au prochain point.', 12),
  ('B13', 'B', 4, 'Après 50 ans', 'Ce qui a changé avec les années', 'Roue 6 axes', 'Identifier les changements ressentis et choisir une adaptation réaliste.', '["Choisir 2 axes.", "Dire ce qui a changé.", "Trouver une adaptation réaliste."]'::jsonb, 'Sur quels sujets sentez-vous le plus de différence par rapport à il y a quelques années ?', 'Tester cette adaptation.', '3–5 min', '[]'::jsonb, '', 'Choisit 2 domaines qui ont changé avec les années.', 'Elle met des mots sur ce qui a évolué dans son quotidien.', 'On choisit 1 adaptation réaliste, sans poser de diagnostic.', 'Tester cette adaptation.', 13),
  ('B14', 'B', 4, 'Après 50 ans', 'Je protège ma masse musculaire', 'Cartes AIDE / AIDE PEU', 'Relier mouvement et repères alimentaires au maintien musculaire.', '["Trier les habitudes.", "Choisir 1 action mouvement.", "Choisir 1 repère alimentaire."]'::jsonb, 'Parmi ces habitudes, lesquelles vous semblent les plus protectrices ?', 'Tester les deux repères.', '3–5 min', '[]'::jsonb, '', 'Trie les habitudes qui soutiennent le maintien de la masse musculaire.', 'Elle repère les comportements qu’elle peut renforcer au quotidien.', 'Elle choisit 1 habitude à renforcer cette semaine.', 'Tester les deux repères.', 14),
  ('B15', 'B', 4, 'Mouvement', 'Mon mouvement préféré', '6 cartes activités', 'Choisir une activité à la fois agréable et faisable.', '["Classer par envie.", "Classer par facilité.", "Garder celle qui arrive en tête des deux."]'::jsonb, 'Qu’est-ce qui vous donne envie et reste facile à mettre dans votre semaine ?', 'La faire 2 fois.', '3–5 min', '[]'::jsonb, '', 'Classe 6 activités selon son envie de les faire.', 'Elle identifie le mouvement qu’elle a le plus de chance de refaire.', 'Elle choisit 1 activité réaliste.', 'La faire 2 fois.', 15),
  ('B16', 'B', 4, 'Hydratation', 'Le défi bouteille', 'Jauge bouteille', 'Rendre l’objectif d’hydratation visible au fil de la journée.', '["Placer 3 repères sur la bouteille.", "Associer chacun à un moment.", "Garder la jauge visible."]'::jsonb, 'Plaçons trois repères faciles à suivre sur votre journée.', 'Tester 3 jours.', '3–5 min', '[]'::jsonb, '', 'Place 3 repères sur une bouteille.', 'Elle visualise sa journée d’hydratation d’un coup d’œil.', 'La bouteille devient son repère pendant 3 jours.', 'Tester 3 jours.', 16),
  ('B17', 'B', 4, 'Alimentation', 'Les 5 sens à table', '5 cartes sens', 'Ralentir le repas en portant attention aux sensations.', '["Tirer 2 cartes sens.", "Les utiliser sur les premières bouchées.", "Décrire ce qu’on remarque."]'::jsonb, 'Choisissez deux sens à observer au prochain repas.', 'Refaire sur 1 repas.', '3–5 min', '[]'::jsonb, '', 'Tire 2 cartes sens et observe les premières bouchées avec ces sens.', 'Elle ralentit et remarque davantage son repas.', 'Elle choisit 1 sens à réutiliser sur un prochain repas.', 'Refaire sur 1 repas.', 17),
  ('B18', 'B', 4, 'Alimentation', 'Ma vitesse de repas', 'Rapide / moyen / lent', 'Identifier sa vitesse de repas et tester un ralentissement simple.', '["Choisir sa vitesse habituelle.", "Identifier quand elle accélère.", "Choisir une façon de ralentir."]'::jsonb, 'Vous mangez plutôt rapidement, normalement ou lentement ?', 'Faire une pause à mi-repas.', '3–5 min', '[]'::jsonb, '', 'Choisit RAPIDE, MOYEN ou LENT pour un repas habituel.', 'Elle prend conscience de sa vitesse de repas.', 'Elle choisit 1 geste simple pour ralentir.', 'Faire une pause à mi-repas.', 18),
  ('B19', 'B', 4, 'Alimentation', 'Portions sans balance', 'Main / paume / poing / pouce', 'Utiliser des repères visuels simples plutôt qu’une pesée permanente.', '["Associer les cartes aux familles d’aliments.", "Vérifier ensemble.", "Choisir le repère le plus utile."]'::jsonb, 'Associons ces repères de la main aux différents aliments.', 'Tester sur 2 repas.', '3–5 min', '[]'::jsonb, '', 'Associe paume, poing et pouce aux familles d’aliments.', 'Elle apprend des repères visuels simples sans balance.', 'Elle garde 1 repère utile pour ses repas.', 'Tester sur 2 repas.', 19),
  ('B20', 'B', 4, 'Alimentation', 'Les bons duos', 'Cartes à associer', 'Créer des associations simples qui rendent les repas plus complets.', '["Former les paires qui vont bien ensemble.", "Vérifier les associations.", "Choisir 2 duos adaptés."]'::jsonb, 'Quelles paires pourriez-vous facilement reproduire chez vous ?', 'Reproduire les 2 duos.', '3–5 min', '[]'::jsonb, '', 'Associe les cartes qui forment des duos simples.', 'Elle comprend comment compléter facilement un repas.', 'Elle garde 2 duos faciles à reproduire.', 'Reproduire les 2 duos.', 20),
  ('B21', 'B', 4, 'Micronutrition', 'Vrai ou faux micronutrition', 'Cartes V/F validées', 'Consolider quelques repères éducatifs validés en formation interne.', '["Tirer 3 cartes.", "Répondre VRAI ou FAUX.", "Lire l’explication courte."]'::jsonb, 'Trois cartes seulement : voyons quels repères vous avez retenus.', 'Retenir 1 seul repère.', '3–5 min', '[]'::jsonb, '', 'Répond VRAI ou FAUX à 3 cartes.', 'Elle vérifie un repère de micronutrition validé.', 'Elle ne garde qu’1 message utile à retenir.', 'Retenir 1 seul repère.', 21),
  ('B22', 'B', 4, 'Confiance', 'Je sors du « tout est foutu »', 'Phrase automatique / nouvelle phrase', 'Remplacer une pensée décourageante par une formulation plus utile.', '["Choisir une phrase qu’elle se dit souvent.", "Trouver une formulation plus utile.", "Lire la nouvelle à voix haute."]'::jsonb, 'Quelle phrase vous dites-vous quand vous avez l’impression d’avoir raté ?', 'Réutiliser la nouvelle phrase 3 fois.', '3–5 min', '[]'::jsonb, '', 'Choisit une phrase décourageante et la remplace par une phrase plus utile.', 'Elle voit l’effet du tout-ou-rien sur sa motivation.', 'Elle repart avec sa nouvelle phrase.', 'Réutiliser la nouvelle phrase 3 fois.', 22),
  ('B23', 'B', 4, 'Énergie', 'Ma batterie', 'Batterie 0–100 + cartes', 'Voir ce qui recharge et ce qui vide l’énergie.', '["Indiquer son niveau.", "Choisir ce qui recharge et ce qui vide.", "Ajouter une petite recharge."]'::jsonb, 'À combien est votre batterie aujourd’hui ?', 'Faire 10 min de recharge.', '3–5 min', '[]'::jsonb, '', 'Place sa batterie sur 0–100 puis choisit 1 recharge.', 'Elle prend conscience de son niveau d’énergie.', 'Elle planifie 10 minutes de récupération.', 'Faire 10 min de recharge.', 23),
  ('B24', 'B', 4, 'Récupération', 'Ma journée de récupération', 'Matin / midi / soir + cartes pause', 'Insérer de petites récupérations dans une journée chargée.', '["Choisir 2 moments difficiles.", "Placer une micro-pause.", "Décider exactement quand."]'::jsonb, 'Où auriez-vous le plus besoin d’une petite coupure dans votre journée ?', 'Tester les 2 pauses.', '3–5 min', '[]'::jsonb, '', 'Place 1 carte pause dans le moment le plus difficile de sa journée.', 'Elle voit où une courte récupération pourrait l’aider.', 'Elle planifie cette pause à un moment précis.', 'Tester les 2 pauses.', 24),
  ('B25', 'B', 4, 'Progression', 'Checkpoint milieu de cure', 'Puzzle 6 pièces', 'Faire le point à mi-parcours et choisir les priorités de la suite.', '["Poser les 6 domaines.", "Choisir les 2 plus solides.", "Choisir les 2 à renforcer."]'::jsonb, 'Qu’est-ce qui est devenu solide, et qu’est-ce qui mérite encore du travail ?', 'Les 2 priorités deviennent le fil conducteur suivant.', '3–5 min', '[]'::jsonb, '', 'Classe 6 domaines en SOLIDE ou À RENFORCER.', 'Elle voit clairement où elle en est à mi-parcours.', 'On garde 2 priorités pour la suite.', 'Les 2 priorités deviennent le fil conducteur suivant.', 25),
  ('C01', 'C', 5, 'Progression', 'Mes 5 victoires', '5 cartes trophée', 'Terminer le parcours en visualisant cinq changements importants.', '["Choisir 5 changements dont elle est fière.", "Donner un exemple pour chacun.", "Les garder visibles."]'::jsonb, 'Quelles sont les cinq choses dont vous êtes la plus fière aujourd’hui ?', 'Les noter ou les photographier.', '3–5 min', '[]'::jsonb, '', 'Choisit 5 cartes qui représentent ses plus grandes victoires.', 'Elle mesure le chemin parcouru depuis le départ.', 'Elle garde une trace concrète de ses 5 victoires.', 'Les noter ou les photographier.', 1),
  ('C02', 'C', 5, 'Stabilisation', 'Si… alors…', 'Cartes obstacles + réponses', 'Préparer une réponse simple à trois situations à risque.', '["Choisir 3 situations à risque.", "Associer une réponse à chacune.", "Lire les 3 plans."]'::jsonb, 'Si cette situation arrive, qu’aimeriez-vous faire à la place ?', 'Tester 1 plan.', '3–5 min', '[]'::jsonb, '', 'Choisit 1 situation à risque et lui associe 1 réponse.', 'Elle voit qu’elle peut préparer sa réaction avant que la situation arrive.', 'Elle repart avec un plan simple « SI… ALORS… ».', 'Tester 1 plan.', 2),
  ('C03', 'C', 5, 'Alimentation', 'Après le restaurant', '1 situation + 3 cartes réactions', 'Revenir à ses repères après un repas plus riche sans compensation excessive.', '["Imaginer un repas plus riche.", "Choisir quoi faire ensuite.", "Retenir : retour normal, sans punition."]'::jsonb, 'Après un restaurant plus riche, quelle serait la meilleure suite ?', 'Appliquer au prochain repas concerné.', '3–5 min', '[]'::jsonb, '', 'Choisit parmi 3 réactions celle qui convient après un restaurant.', 'Elle comprend qu’un repas plus riche ne demande pas de compensation extrême.', 'Son repère devient : reprendre normalement au repas suivant.', 'Appliquer au prochain repas concerné.', 3),
  ('C04', 'C', 5, 'Stabilisation', 'Ma valise vacances & fêtes', 'Valise + 6 cartes repères', 'Choisir quelques repères simples à conserver dans les périodes festives.', '["Choisir seulement 3 repères.", "Les mettre dans la valise.", "Expliquer pourquoi eux."]'::jsonb, 'Si vous ne pouviez emporter que trois repères, lesquels choisiriez-vous ?', 'Les conserver pendant une sortie.', '3–5 min', '[]'::jsonb, '', 'Met 3 cartes repères dans une valise.', 'Elle identifie l’essentiel à garder pendant vacances ou fêtes.', 'Elle repart avec seulement 3 repères.', 'Les conserver pendant une sortie.', 4),
  ('C05', 'C', 5, 'Stabilisation', 'Mon mode minimum', '4 cartes essentielles', 'Préparer une version minimale du parcours pour les semaines difficiles.', '["Choisir le minimum pour alimentation, eau, mouvement, récupération.", "Ne rien ajouter.", "Garder ce plan pour les semaines difficiles."]'::jsonb, 'Quand tout se complique, quel est votre minimum réaliste ?', 'Tester sur une journée chargée.', '3–5 min', '[]'::jsonb, '', 'Choisit son minimum réaliste pour une semaine difficile.', 'Elle comprend que maintenir un peu vaut mieux que tout abandonner.', 'Elle définit son « mode minimum » personnel.', 'Tester sur une journée chargée.', 5),
  ('C06', 'C', 5, 'Stabilisation', 'Mes 3 non-négociables', 'Cartes habitudes + 3 cadenas', 'Identifier trois habitudes protectrices à conserver dans la durée.', '["Choisir les 3 habitudes les plus protectrices.", "Poser un cadenas sur chacune.", "Vérifier qu’elles sont réalistes."]'::jsonb, 'Quelles trois habitudes voulez-vous absolument protéger ?', 'Les tenir 7 jours.', '3–5 min', '[]'::jsonb, '', 'Pose 3 cadenas sur ses habitudes les plus importantes.', 'Elle sait ce qu’elle veut protéger dans la durée.', 'Ces 3 habitudes deviennent ses non-négociables.', 'Les tenir 7 jours.', 6),
  ('C07', 'C', 5, 'Stabilisation', 'Je reprends simplement', 'Cartes Prochain repas / Demain / Cette semaine', 'Savoir reprendre après une période moins structurée sans repartir dans le tout-ou-rien.', '["Remettre les 3 cartes dans l’ordre.", "Mettre une action simple sur chaque étape.", "Écarter les compensations extrêmes."]'::jsonb, 'Après quelques jours moins structurés, par quoi commence-t-on simplement ?', 'Utiliser le plan quand nécessaire.', '3–5 min', '[]'::jsonb, '', 'Remet 3 cartes dans l’ordre : prochain repas → demain → cette semaine.', 'Elle comprend qu’elle peut reprendre sans tout recommencer.', 'Elle garde un plan de reprise très simple.', 'Utiliser le plan quand nécessaire.', 7),
  ('C08', 'C', 5, 'Organisation', 'Mon frigo du futur', 'Frigo + cartes aliments', 'Organiser son environnement pour faciliter les choix utiles.', '["Choisir 5 indispensables simples.", "Les placer aux endroits accessibles.", "Faire sa liste."]'::jsonb, 'Quels cinq aliments vous facilitent vraiment la semaine ?', 'En avoir au moins 3 disponibles.', '3–5 min', '[]'::jsonb, '', 'Choisit 5 aliments indispensables à garder disponibles chez elle.', 'Elle voit comment l’environnement peut faciliter ses choix.', 'Elle repart avec une liste de 5 indispensables.', 'En avoir au moins 3 disponibles.', 8),
  ('C09', 'C', 5, 'Entourage', 'Mon cercle de soutien', 'Cible 3 cercles', 'Identifier les personnes et ressources qui peuvent aider après la cure.', '["Placer les personnes ou ressources.", "Choisir celle qui peut vraiment aider.", "Définir ce qu’on peut lui demander."]'::jsonb, 'Qui pourrait réellement vous aider si vous en aviez besoin ?', 'Faire 1 demande concrète.', '3–5 min', '[]'::jsonb, '', 'Place les personnes qui peuvent l’aider sur une cible.', 'Elle identifie sur qui elle peut réellement compter.', 'Elle choisit 1 personne et 1 demande possible.', 'Faire 1 demande concrète.', 9),
  ('C10', 'C', 5, 'Autonomie', 'Je sais quoi faire si…', 'Cartes situations', 'Vérifier que la cliente sait répondre seule aux situations courantes.', '["Tirer une situation.", "La cliente explique ce qu’elle ferait.", "La thérapeute complète si besoin."]'::jsonb, 'Je vous donne une situation : dites-moi ce que vous feriez aujourd’hui.', 'Repérer la situation encore difficile.', '3–5 min', '[]'::jsonb, '', 'Tire 1 situation et explique simplement ce qu’elle ferait.', 'Elle teste son autonomie face à une situation du quotidien.', 'On repère s’il reste 1 situation à retravailler.', 'Repérer la situation encore difficile.', 10),
  ('C11', 'C', 5, 'Confiance', 'Mon chemin parcouru', 'Frise Point A → Point B', 'Comparer clairement le début du parcours avec la situation actuelle.', '["Reprendre 5 domaines.", "Placer où elle était et où elle est.", "Regarder le chemin."]'::jsonb, 'Regardons concrètement la différence entre votre départ et aujourd’hui.', 'Écrire ce qu’elle ne veut plus oublier.', '3–5 min', '[]'::jsonb, '', 'Place des repères AVANT et AUJOURD’HUI sur une frise.', 'Elle visualise le chemin parcouru.', 'Elle choisit ce qu’elle veut absolument conserver.', 'Écrire ce qu’elle ne veut plus oublier.', 11),
  ('C12', 'C', 5, 'Organisation', 'Ma semaine stable', 'Plateau semaine + repères', 'Construire une semaine durable qui garde place au plaisir et à la récupération.', '["Placer quelques repas repères.", "Ajouter mouvement, récupération et plaisir.", "Vérifier que la semaine reste réaliste."]'::jsonb, 'Construisons une semaine stable, pas une semaine parfaite.', 'La tester réellement.', '3–5 min', '[]'::jsonb, '', 'Compose une semaine type avec quelques repères simples.', 'Elle voit à quoi ressemble une semaine stable, pas parfaite.', 'Elle repart avec sa semaine de référence.', 'La tester réellement.', 12),
  ('C13', 'C', 5, 'Stabilisation', 'Mes signaux d’alerte', 'Vert / orange / rouge', 'Repérer tôt les signes personnels de déséquilibre.', '["Trier ses propres signaux.", "Repérer le premier signal orange.", "Décider quoi faire dès qu’il apparaît."]'::jsonb, 'Quels signes vous montrent que vous commencez à perdre vos repères ?', 'Réagir au premier orange.', '3–5 min', '[]'::jsonb, '', 'Place ses signaux personnels en VERT, ORANGE ou ROUGE.', 'Elle repère les signes qui apparaissent avant une perte de repères.', 'Elle choisit quoi faire dès le premier signal orange.', 'Réagir au premier orange.', 13),
  ('C14', 'C', 5, 'Autonomie', 'Ma routine après MAbeautyplus', 'Roue 6 axes', 'Définir la routine minimale à maintenir après l’accompagnement.', '["Faire le tour des 6 axes.", "Choisir ce qui doit absolument continuer.", "Créer sa routine minimale."]'::jsonb, 'Qu’est-ce que vous voulez continuer même sans rendez-vous chaque semaine ?', 'La noter et la conserver.', '3–5 min', '[]'::jsonb, '', 'Choisit 3 habitudes à maintenir après l’accompagnement.', 'Elle sait ce qui soutiendra son autonomie.', 'Elle crée sa routine minimale après MAbeautyplus.', 'La noter et la conserver.', 14),
  ('C15', 'C', 5, 'Point B', 'Ma carte de nouveau départ', 'Carte à compléter', 'Formuler ce que la cliente a appris et ce qu’elle veut préserver.', '["Compléter « Aujourd’hui je me sens… ».", "Compléter « J’ai appris… ».", "Compléter « Je continuerai… »."]'::jsonb, 'Si vous deviez laisser un message à la version de vous-même dans un mois, que diriez-vous ?', 'Relire la carte dans 1 mois.', '3–5 min', '[]'::jsonb, '', 'Complète 3 phrases sur une carte.', 'Elle formule ce qu’elle a appris et ce qu’elle veut préserver.', 'Elle repart avec une carte à relire dans un mois.', 'Relire la carte dans 1 mois.', 15)
ON CONFLICT (code) DO UPDATE SET
  phase = EXCLUDED.phase, etape = EXCLUDED.etape, theme = EXCLUDED.theme,
  titre = EXCLUDED.titre, materiel = EXCLUDED.materiel, objectif = EXCLUDED.objectif,
  regles = EXCLUDED.regles, phrase_lancement = EXCLUDED.phrase_lancement,
  mission = EXCLUDED.mission, duree = EXCLUDED.duree, options = EXCLUDED.options,
  a_enregistrer = EXCLUDED.a_enregistrer, action_cliente = EXCLUDED.action_cliente,
  prise_conscience = EXCLUDED.prise_conscience, resultat = EXCLUDED.resultat,
  petit_pas = EXCLUDED.petit_pas, ordre = EXCLUDED.ordre;
