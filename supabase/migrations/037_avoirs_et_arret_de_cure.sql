/*
  MAbeautyplus V2 — Migration 037 : arrêter une cure, et l'avoir qui va avec

  Une cliente arrête en cours de route. Déménagement, grossesse, problème de
  santé, ou simplement elle ne revient plus. Jusqu'ici l'application n'avait
  aucun geste pour ça : la cure restait « en cours » pour toujours, ses
  échéances continuaient d'être réclamées sur l'accueil et au tableau de
  bord, et la seule sortie était de supprimer la fiche — c'est-à-dire de
  perdre son histoire.

  Deux notions, qu'il ne faut pas confondre :

    ARRÊTER LA CURE, c'est dire « on n'ira pas au bout ». Les échéances non
    réglées sont annulées : on ne réclame plus de l'argent pour des séances
    qui n'auront pas lieu. La cure sort des comptes — le socle savait déjà
    le faire, tout est filtré sur `statut <> 'abandonne'` depuis la 006 et
    la 028. Ce qui a été fait reste fait, ce qui a été payé reste payé.

    L'AVOIR, c'est ce que le centre doit à la cliente. Il naît le plus
    souvent d'un arrêt de cure — elle a payé plus qu'elle n'a consommé — mais
    il peut aussi être accordé seul, en geste commercial. Il vit ensuite sa
    propre vie : il se dépense sur une cure, ou il se rembourse en argent.

  L'AVOIR NE SE STOCKE PAS, IL SE CALCULE. C'est la règle de la maison, celle
  du stock et des séances restantes : on écrit des mouvements — accordé,
  utilisé, remboursé — et le solde est leur somme. Un compteur recopié ment
  au bout de quelques semaines ; une somme de mouvements, jamais. On peut
  toujours dire d'où vient chaque euro et qui l'a saisi.

  Un avoir traverse les cinq centres, comme le parrainage : c'est une dette
  de l'entreprise envers la cliente, pas d'un centre en particulier. Le
  centre reste écrit sur chaque mouvement, pour la comptabilité.

  CE QUI NE CHANGE PAS : aucun prix, aucun barème, aucun échéancier existant.
  Une cure qu'on n'arrête pas se comporte exactement comme avant.
*/

-- ===========================================================================
-- 1. L'ARRÊT SE DATE ET S'EXPLIQUE
--
--    Le statut « abandonne » existait déjà dans le socle et sort déjà la
--    cure de tous les comptes. Il lui manquait le pourquoi et le quand :
--    six mois plus tard, « cette cure est abandonnée » sans autre indication
--    ne se rattrape pas.
-- ===========================================================================

ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS date_arret  date,
  ADD COLUMN IF NOT EXISTS motif_arret text;

COMMENT ON COLUMN programmes.date_arret IS
  'Jour où la cure a été arrêtée. Renseignée uniquement si statut = abandonne.';
COMMENT ON COLUMN programmes.motif_arret IS
  'Pourquoi la cure s''est arrêtée, dit avec les mots de la thérapeute.';

-- ===========================================================================
-- 2. UNE ÉCHÉANCE PEUT ÊTRE ANNULÉE
--
--    « Annulée » n'est ni « payée » ni « donnée » : c'est une échéance qui
--    n'a plus lieu d'être, parce que la cure s'est arrêtée avant elle, ou
--    parce qu'un avoir l'a couverte. Sans ce statut, l'échéancier de la
--    fiche continuerait d'afficher en rouge des sommes que personne ne doit.
-- ===========================================================================

ALTER TABLE echeances DROP CONSTRAINT IF EXISTS echeances_statut_check;
ALTER TABLE echeances ADD CONSTRAINT echeances_statut_check
  CHECK (statut IN ('a_venir', 'paye', 'donne', 'impaye', 'annule'));

COMMENT ON COLUMN echeances.statut IS
  'a_venir · paye · donne (offerte) · impaye · annule (cure arrêtée, ou couverte par un avoir).';

-- L'index qui sert à trouver ce qu'il reste à encaisser ne doit pas voir
-- les échéances annulées.
DROP INDEX IF EXISTS echeances_a_encaisser_idx;
CREATE INDEX IF NOT EXISTS echeances_a_encaisser_idx ON echeances (date_prevue)
  WHERE statut IN ('a_venir', 'impaye');

-- ===========================================================================
-- 3. LES MOUVEMENTS D'AVOIR
-- ===========================================================================

CREATE TABLE IF NOT EXISTS avoirs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  centre_id      text NOT NULL REFERENCES centres(id),
  therapeute_id  uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),

  sens           text NOT NULL CHECK (sens IN ('accorde', 'utilise', 'rembourse')),
  -- Toujours positif : c'est « sens » qui dit dans quel sens il compte.
  montant        numeric(10,2) NOT NULL CHECK (montant > 0),

  -- La cure qui a donné naissance à l'avoir (arrêt), ou celle sur laquelle
  -- il a été dépensé. Nulle pour un geste commercial ou un remboursement.
  programme_id   uuid REFERENCES programmes(id) ON DELETE SET NULL,

  -- Renseigné pour un remboursement en argent.
  moyen          text CHECK (moyen IS NULL OR moyen IN ('cheque', 'especes', 'cb', 'virement', 'alma')),

  motif          text NOT NULL DEFAULT '',
  date_avoir     date NOT NULL DEFAULT CURRENT_DATE,
  cree_le        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avoirs_cliente_idx ON avoirs (cliente_id, date_avoir DESC);
CREATE INDEX IF NOT EXISTS avoirs_centre_idx  ON avoirs (centre_id, date_avoir DESC);

COMMENT ON TABLE avoirs IS
  'Mouvements d''avoir : accordé, utilisé sur une cure, remboursé en argent. Le solde ne se stocke pas, il se calcule.';

ALTER TABLE avoirs ENABLE ROW LEVEL SECURITY;

-- Un avoir se lit et s'écrit depuis le centre de la cliente, comme le reste
-- de son dossier. La direction voit les cinq.
DROP POLICY IF EXISTS avoirs_acces ON avoirs;
CREATE POLICY avoirs_acces ON avoirs FOR ALL TO authenticated
  USING (acces_centre(centre_id)) WITH CHECK (acces_centre(centre_id));

-- ===========================================================================
-- 4. LE SOLDE, CALCULÉ
--
--    Une cliente n'a qu'un solde, tous centres confondus. Ce qu'elle a en
--    avoir au Crès, elle peut le dépenser à Montpellier.
-- ===========================================================================

CREATE OR REPLACE VIEW solde_avoir WITH (security_invoker = true) AS
SELECT
  a.cliente_id,
  COALESCE(SUM(a.montant) FILTER (WHERE a.sens = 'accorde'), 0)   AS accorde,
  COALESCE(SUM(a.montant) FILTER (WHERE a.sens = 'utilise'), 0)   AS utilise,
  COALESCE(SUM(a.montant) FILTER (WHERE a.sens = 'rembourse'), 0) AS rembourse,
  COALESCE(SUM(a.montant) FILTER (WHERE a.sens = 'accorde'), 0)
    - COALESCE(SUM(a.montant) FILTER (WHERE a.sens = 'utilise'), 0)
    - COALESCE(SUM(a.montant) FILTER (WHERE a.sens = 'rembourse'), 0) AS solde,
  MAX(a.date_avoir) AS dernier_mouvement
FROM avoirs a
GROUP BY a.cliente_id;

COMMENT ON VIEW solde_avoir IS
  'Ce que le centre doit encore à chaque cliente : accordé moins utilisé moins remboursé.';

-- ===========================================================================
-- 5. ARRÊTER UNE CURE
--
--    Un seul geste, indivisible : la cure passe en arrêtée, ses échéances
--    non réglées sont annulées, et l'avoir est créé si on en accorde un.
--    Si l'une des trois écritures échoue, aucune ne passe.
-- ===========================================================================

CREATE OR REPLACE FUNCTION arreter_cure(
  p_programme_id uuid,
  p_motif        text DEFAULT '',
  p_avoir        numeric DEFAULT 0,
  p_date         date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente uuid;
  v_centre  text;
  v_statut  text;
BEGIN
  SELECT p.cliente_id, p.centre_id, p.statut
    INTO v_cliente, v_centre, v_statut
    FROM programmes p WHERE p.id = p_programme_id;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'Cette cure n''existe pas.';
  END IF;
  IF NOT acces_centre(v_centre) THEN
    RAISE EXCEPTION 'Cette cure appartient à un centre qui n''est pas accessible depuis ce compte.';
  END IF;
  IF v_statut = 'abandonne' THEN
    RAISE EXCEPTION 'Cette cure est déjà arrêtée.';
  END IF;
  IF p_avoir < 0 THEN
    RAISE EXCEPTION 'Un avoir ne peut pas être négatif.';
  END IF;

  -- On ne réclame plus rien pour des séances qui n'auront pas lieu.
  UPDATE echeances
     SET statut = 'annule',
         note   = COALESCE(NULLIF(note, ''), 'Cure arrêtée le ' || to_char(p_date, 'DD/MM/YYYY'))
   WHERE programme_id = p_programme_id
     AND statut IN ('a_venir', 'impaye');

  UPDATE programmes
     SET statut      = 'abandonne',
         date_arret  = p_date,
         motif_arret = NULLIF(p_motif, '')
   WHERE id = p_programme_id;

  IF p_avoir > 0 THEN
    INSERT INTO avoirs (cliente_id, centre_id, sens, montant, programme_id, motif, date_avoir)
    VALUES (v_cliente, v_centre, 'accorde', p_avoir, p_programme_id,
            COALESCE(NULLIF(p_motif, ''), 'Arrêt de la cure'), p_date);
  END IF;

  -- Le CRM doit voir la cure arrêtée et le nouvel avoir de la cliente.
  INSERT INTO airtable_sync (entite, entite_id) VALUES ('programme', p_programme_id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;

  INSERT INTO airtable_sync (entite, entite_id) VALUES ('cliente', v_cliente)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
END $$;

COMMENT ON FUNCTION arreter_cure(uuid, text, numeric, date) IS
  'Arrête une cure : annule ses échéances non réglées, la sort des comptes, et accorde un avoir si demandé.';

-- ===========================================================================
-- 6. ROUVRIR UNE CURE ARRÊTÉE
--
--    Parce qu'on se trompe. Le geste se défait tant que l'avoir n'a pas été
--    dépensé : si la cliente a déjà utilisé ou touché cet argent, on refuse
--    plutôt que de créer un trou dans les comptes.
-- ===========================================================================

CREATE OR REPLACE FUNCTION rouvrir_cure(p_programme_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente uuid;
  v_centre  text;
  v_statut  text;
  v_avoir   numeric;
  v_solde   numeric;
BEGIN
  SELECT p.cliente_id, p.centre_id, p.statut
    INTO v_cliente, v_centre, v_statut
    FROM programmes p WHERE p.id = p_programme_id;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'Cette cure n''existe pas.';
  END IF;
  IF NOT acces_centre(v_centre) THEN
    RAISE EXCEPTION 'Cette cure appartient à un centre qui n''est pas accessible depuis ce compte.';
  END IF;
  IF v_statut <> 'abandonne' THEN
    RAISE EXCEPTION 'Cette cure n''est pas arrêtée.';
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_avoir
    FROM avoirs
   WHERE programme_id = p_programme_id AND sens = 'accorde';

  IF v_avoir > 0 THEN
    SELECT COALESCE(s.solde, 0) INTO v_solde FROM solde_avoir s WHERE s.cliente_id = v_cliente;
    IF COALESCE(v_solde, 0) < v_avoir THEN
      RAISE EXCEPTION 'Impossible de rouvrir cette cure : l''avoir de % € qu''elle a créé a déjà été utilisé ou remboursé, au moins en partie.', v_avoir;
    END IF;
    DELETE FROM avoirs WHERE programme_id = p_programme_id AND sens = 'accorde';
  END IF;

  -- On ne ressuscite que les échéances annulées par l'arrêt. Celles qu'un
  -- avoir avait couvertes avant lui sont tombées à zéro : les remettre « à
  -- venir » réclamerait 0 € à la cliente, et l'avoir aurait disparu deux fois.
  UPDATE echeances
     SET statut = 'a_venir',
         note   = NULLIF(regexp_replace(COALESCE(note, ''), '^Cure arrêtée le \d{2}/\d{2}/\d{4}$', ''), '')
   WHERE programme_id = p_programme_id AND statut = 'annule' AND montant > 0;

  UPDATE programmes
     SET statut = CASE WHEN date_validation IS NULL THEN 'propose' ELSE 'en_cours' END,
         date_arret = NULL,
         motif_arret = NULL
   WHERE id = p_programme_id;

  INSERT INTO airtable_sync (entite, entite_id) VALUES ('programme', p_programme_id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;

  INSERT INTO airtable_sync (entite, entite_id) VALUES ('cliente', v_cliente)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
END $$;

COMMENT ON FUNCTION rouvrir_cure(uuid) IS
  'Annule un arrêt de cure. Refuse si l''avoir créé à cette occasion a déjà été dépensé.';

-- ===========================================================================
-- 7. ACCORDER UN AVOIR SANS ARRÊTER DE CURE
--    Un geste commercial, un dédommagement, une erreur de caisse.
-- ===========================================================================

CREATE OR REPLACE FUNCTION accorder_avoir(
  p_cliente_id uuid,
  p_montant    numeric,
  p_motif      text DEFAULT '',
  p_date       date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_centre text;
BEGIN
  SELECT c.centre_id INTO v_centre FROM clientes c WHERE c.id = p_cliente_id;

  IF v_centre IS NULL THEN
    RAISE EXCEPTION 'Cette fiche n''existe pas.';
  END IF;
  IF NOT acces_centre(v_centre) THEN
    RAISE EXCEPTION 'Cette fiche appartient à un centre qui n''est pas accessible depuis ce compte.';
  END IF;
  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant d''un avoir doit être supérieur à zéro.';
  END IF;

  INSERT INTO avoirs (cliente_id, centre_id, sens, montant, motif, date_avoir)
  VALUES (p_cliente_id, v_centre, 'accorde', p_montant, COALESCE(NULLIF(p_motif, ''), 'Avoir accordé'), p_date);

  INSERT INTO airtable_sync (entite, entite_id) VALUES ('cliente', p_cliente_id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
END $$;

-- ===========================================================================
-- 8. DÉPENSER UN AVOIR SUR UNE CURE
--
--    L'avoir descend l'échéancier en partant de la fin : la dernière
--    échéance est la plus lointaine, c'est celle qu'on efface en premier.
--    Une échéance entièrement couverte devient « annulée » ; la dernière
--    entamée voit simplement son montant baisser.
--
--    Le montant de la cure, lui, ne bouge pas. C'est ce que la cliente a
--    signé, et c'est ce que le tableau de bord doit continuer de compter —
--    exactement comme les frais Alma et les séances offertes, qui font déjà
--    différer le montant signé de ce qui est encaissé.
-- ===========================================================================

CREATE OR REPLACE FUNCTION utiliser_avoir(
  p_programme_id uuid,
  p_montant      numeric,
  p_date         date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente uuid;
  v_centre  text;
  v_statut  text;
  v_solde   numeric;
  v_du      numeric;
  v_reste   numeric := p_montant;
  e         record;
BEGIN
  SELECT p.cliente_id, p.centre_id, p.statut
    INTO v_cliente, v_centre, v_statut
    FROM programmes p WHERE p.id = p_programme_id;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'Cette cure n''existe pas.';
  END IF;
  IF NOT acces_centre(v_centre) THEN
    RAISE EXCEPTION 'Cette cure appartient à un centre qui n''est pas accessible depuis ce compte.';
  END IF;
  IF v_statut = 'abandonne' THEN
    RAISE EXCEPTION 'On ne peut pas poser un avoir sur une cure arrêtée.';
  END IF;
  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant à utiliser doit être supérieur à zéro.';
  END IF;

  SELECT COALESCE(s.solde, 0) INTO v_solde FROM solde_avoir s WHERE s.cliente_id = v_cliente;
  IF COALESCE(v_solde, 0) < p_montant THEN
    RAISE EXCEPTION 'Son avoir est de % €, on ne peut pas en utiliser % €.', COALESCE(v_solde, 0), p_montant;
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_du
    FROM echeances
   WHERE programme_id = p_programme_id AND statut IN ('a_venir', 'impaye');

  IF v_du < p_montant THEN
    RAISE EXCEPTION 'Il ne reste que % € à encaisser sur cette cure : un avoir de % € n''y tient pas.', v_du, p_montant;
  END IF;

  FOR e IN
    SELECT id, montant FROM echeances
     WHERE programme_id = p_programme_id AND statut IN ('a_venir', 'impaye')
     ORDER BY rang DESC
  LOOP
    EXIT WHEN v_reste <= 0;

    IF e.montant <= v_reste THEN
      v_reste := v_reste - e.montant;
      UPDATE echeances
         SET montant = 0, statut = 'annule',
             note = 'Couverte par son avoir'
       WHERE id = e.id;
    ELSE
      UPDATE echeances
         SET montant = e.montant - v_reste,
             note = 'Réduite de ' || to_char(v_reste, 'FM999999990.00') || ' € par son avoir'
       WHERE id = e.id;
      v_reste := 0;
    END IF;
  END LOOP;

  INSERT INTO avoirs (cliente_id, centre_id, sens, montant, programme_id, motif, date_avoir)
  VALUES (v_cliente, v_centre, 'utilise', p_montant, p_programme_id, 'Déduit de l''échéancier', p_date);

  INSERT INTO airtable_sync (entite, entite_id) VALUES ('programme', p_programme_id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;

  INSERT INTO airtable_sync (entite, entite_id) VALUES ('cliente', v_cliente)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
END $$;

COMMENT ON FUNCTION utiliser_avoir(uuid, numeric, date) IS
  'Déduit un avoir des échéances non réglées d''une cure, en partant de la plus lointaine.';

-- ===========================================================================
-- 9. REMBOURSER UN AVOIR EN ARGENT
-- ===========================================================================

CREATE OR REPLACE FUNCTION rembourser_avoir(
  p_cliente_id uuid,
  p_montant    numeric,
  p_moyen      text,
  p_date       date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_centre text;
  v_solde  numeric;
BEGIN
  SELECT c.centre_id INTO v_centre FROM clientes c WHERE c.id = p_cliente_id;

  IF v_centre IS NULL THEN
    RAISE EXCEPTION 'Cette fiche n''existe pas.';
  END IF;
  IF NOT acces_centre(v_centre) THEN
    RAISE EXCEPTION 'Cette fiche appartient à un centre qui n''est pas accessible depuis ce compte.';
  END IF;
  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant remboursé doit être supérieur à zéro.';
  END IF;

  SELECT COALESCE(s.solde, 0) INTO v_solde FROM solde_avoir s WHERE s.cliente_id = p_cliente_id;
  IF COALESCE(v_solde, 0) < p_montant THEN
    RAISE EXCEPTION 'Son avoir est de % €, on ne peut pas en rembourser % €.', COALESCE(v_solde, 0), p_montant;
  END IF;

  INSERT INTO avoirs (cliente_id, centre_id, sens, montant, moyen, motif, date_avoir)
  VALUES (p_cliente_id, v_centre, 'rembourse', p_montant, p_moyen, 'Remboursé à la cliente', p_date);

  INSERT INTO airtable_sync (entite, entite_id) VALUES ('cliente', p_cliente_id)
  ON CONFLICT (entite, entite_id) WHERE statut IN ('en_attente', 'erreur')
  DO UPDATE SET statut = 'en_attente', cree_le = now(), derniere_erreur = NULL;
END $$;

-- ===========================================================================
-- 10. LES DROITS
--
--     PostgreSQL donne un droit d'exécution implicite à PUBLIC sur toute
--     fonction nouvellement créée. Ces cinq-là touchent à de l'argent : on
--     le retire, et on ne le rend qu'aux comptes connectés. Les fonctions
--     vérifient de toute façon le centre elles-mêmes.
-- ===========================================================================

REVOKE ALL ON FUNCTION arreter_cure(uuid, text, numeric, date)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rouvrir_cure(uuid)                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION accorder_avoir(uuid, numeric, text, date)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION utiliser_avoir(uuid, numeric, date)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rembourser_avoir(uuid, numeric, text, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION arreter_cure(uuid, text, numeric, date)     TO authenticated;
GRANT EXECUTE ON FUNCTION rouvrir_cure(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION accorder_avoir(uuid, numeric, text, date)   TO authenticated;
GRANT EXECUTE ON FUNCTION utiliser_avoir(uuid, numeric, date)         TO authenticated;
GRANT EXECUTE ON FUNCTION rembourser_avoir(uuid, numeric, text, date) TO authenticated;
