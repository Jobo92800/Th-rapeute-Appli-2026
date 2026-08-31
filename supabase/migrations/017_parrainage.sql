/*
  MAbeautyplus V2 — Migration 017 : le parrainage

  « Parrainez et gagnez » : chaque filleule qui s'engage dans une cure vaut
  2 séances offertes à sa marraine, jusqu'à 10.

  La V1 tenait ça dans un coin de Firebase : un nom de parrain tapé à la
  main et une liste de filleuls avec leurs gains, saisis à la main aussi.
  Rien n'était relié aux cures, donc rien n'était juste bien longtemps.

  Ici, rien de calculable n'est écrit :

    — les filleules sont les clientes dont le champ parrain_id pointe la
      marraine ;
    — « engagée » veut dire « a signé son contrat » — le fait existe déjà
      dans la table contrats ;
    — les séances gagnées se calculent (2 par filleule engagée, plafond 10) ;
    — les séances déjà utilisées se lisent sur les cures de la marraine.

  Le seul fait qu'on écrit est celui qu'on décide : cette cure-ci comporte
  N séances offertes, sur telle technologie.

  Un parrainage traverse les centres : une cliente du Grau-du-Roi peut
  parrainer une amie du Crès. Les fiches restant cloisonnées, trois
  fonctions ouvrent exactement ce qu'il faut voir — prénom, nom, centre —
  et rien de plus.
*/

-- ---------------------------------------------------------------------------
-- 1. QUI A PARRAINÉ QUI
-- ---------------------------------------------------------------------------

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS parrain_id    uuid REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parrain_libre text NOT NULL DEFAULT '';

COMMENT ON COLUMN clientes.parrain_id IS
  'La fiche de la marraine, même si elle est dans un autre centre.';
COMMENT ON COLUMN clientes.parrain_libre IS
  'Nom de la marraine quand elle n''a pas de fiche (cliente de la V1). Aucune séance n''est comptée dans ce cas.';

CREATE INDEX IF NOT EXISTS clientes_parrain_idx
  ON clientes (parrain_id) WHERE parrain_id IS NOT NULL;

-- On ne se parraine pas soi-même.
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS parrain_pas_soi;
ALTER TABLE clientes ADD CONSTRAINT parrain_pas_soi CHECK (parrain_id IS NULL OR parrain_id <> id);

-- ---------------------------------------------------------------------------
-- 2. LES SÉANCES OFFERTES SUR UNE CURE
--    Elles s'ajoutent au décompte sans entrer dans le montant : la cliente
--    achète 12 séances, elle en reçoit 14, le contrat ne change pas.
-- ---------------------------------------------------------------------------

ALTER TABLE programme_lignes
  ADD COLUMN IF NOT EXISTS seances_offertes integer NOT NULL DEFAULT 0
    CHECK (seances_offertes >= 0);

COMMENT ON COLUMN programme_lignes.seances_offertes IS
  'Séances gagnées par parrainage, posées sur cette technologie. Comptées dans le suivi, jamais dans le montant.';

-- Le suivi doit les compter : ce sont des séances dues à la cliente.
--
-- On supprime la vue avant de la refaire : PostgreSQL refuse qu'un
-- CREATE OR REPLACE insère une colonne ailleurs qu'à la fin, et la place de
-- seances_offertes est au milieu, à côté des séances prévues.
DROP VIEW IF EXISTS suivi_seances;

CREATE VIEW suivi_seances WITH (security_invoker = true) AS
SELECT
  p.id                                              AS programme_id,
  p.cliente_id,
  p.centre_id,
  l.technologie,
  l.seances_prevues + l.seances_offertes            AS seances_prevues,
  l.seances_offertes,
  COUNT(s.id) FILTER (WHERE s.cloturee)             AS seances_faites,
  l.seances_prevues + l.seances_offertes - COUNT(s.id) FILTER (WHERE s.cloturee)
                                                    AS seances_restantes
FROM programmes p
JOIN programme_lignes l ON l.programme_id = p.id
LEFT JOIN seances s ON s.programme_id = p.id AND s.technologie = l.technologie
GROUP BY p.id, p.cliente_id, p.centre_id, l.technologie, l.seances_prevues, l.seances_offertes;

-- ---------------------------------------------------------------------------
-- 3. VOIR JUSTE CE QU'IL FAUT DANS LES AUTRES CENTRES
--
--    Ces trois fonctions lisent au-delà du centre de la personne connectée.
--    Elles ne renvoient donc que le strict nécessaire : prénom, nom, centre.
--    Ni téléphone, ni email, ni adresse, ni montants.
-- ---------------------------------------------------------------------------

/* Rechercher une marraine dans les cinq centres, pour la désigner. */
CREATE OR REPLACE FUNCTION chercher_parrain(p_texte text, p_sauf uuid DEFAULT NULL)
RETURNS TABLE (id uuid, prenom text, nom text, centre_id text, centre text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.prenom, c.nom, c.centre_id, ce.nom
  FROM clientes c
  JOIN centres ce ON ce.id = c.centre_id
  WHERE length(trim(coalesce(p_texte, ''))) >= 3
    AND c.archivee_le IS NULL
    AND (p_sauf IS NULL OR c.id <> p_sauf)
    AND (c.prenom || ' ' || c.nom) ILIKE '%' || trim(p_texte) || '%'
  ORDER BY c.nom, c.prenom
  LIMIT 10;
$$;

/* Le nom de la marraine enregistrée, pour l'afficher sur la fiche. */
CREATE OR REPLACE FUNCTION apercu_cliente(p_cliente uuid)
RETURNS TABLE (id uuid, prenom text, nom text, centre_id text, centre text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.prenom, c.nom, c.centre_id, ce.nom
  FROM clientes c
  JOIN centres ce ON ce.id = c.centre_id
  WHERE c.id = p_cliente;
$$;

/*
  Les filleules d'une cliente, et la date de leur engagement — c'est-à-dire
  la signature de leur premier contrat. NULL tant qu'elles n'ont pas signé :
  la marraine ne gagne rien à ce stade, et l'écran le dit.

  On vérifie l'accès à la fiche demandée : la fonction ouvre les autres
  centres pour les filleules, pas pour n'importe quelle fiche.
*/
CREATE OR REPLACE FUNCTION filleules_de(p_cliente uuid)
RETURNS TABLE (
  id         uuid,
  prenom     text,
  nom        text,
  centre_id  text,
  centre     text,
  engagee_le timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM clientes c WHERE c.id = p_cliente AND acces_centre(c.centre_id)
  ) THEN
    RAISE EXCEPTION 'Cette fiche n''est pas accessible depuis ce centre.';
  END IF;

  RETURN QUERY
  SELECT
    f.id, f.prenom, f.nom, f.centre_id, ce.nom,
    (SELECT MIN(k.signe_le) FROM contrats k WHERE k.cliente_id = f.id)
  FROM clientes f
  JOIN centres ce ON ce.id = f.centre_id
  WHERE f.parrain_id = p_cliente
    AND f.archivee_le IS NULL
  ORDER BY f.cree_le;
END $$;

/*
  Rattacher une filleule à sa marraine, ou l'en détacher (p_marraine à NULL).

  L'écriture se fait sur la fiche de la filleule, qui peut être dans un
  autre centre : d'où la fonction. On exige d'avoir accès à l'une des deux
  fiches — c'est depuis l'une des deux qu'on saisit.
*/
CREATE OR REPLACE FUNCTION rattacher_filleule(p_filleule uuid, p_marraine uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_acces boolean;
BEGIN
  IF p_filleule = p_marraine THEN
    RAISE EXCEPTION 'Une cliente ne peut pas être sa propre marraine.';
  END IF;

  SELECT bool_or(acces_centre(c.centre_id)) INTO v_acces
  FROM clientes c
  WHERE c.id = p_filleule OR c.id = p_marraine;

  IF NOT COALESCE(v_acces, false) THEN
    RAISE EXCEPTION 'Aucune de ces deux fiches n''est accessible depuis ce centre.';
  END IF;

  UPDATE clientes
  SET parrain_id = p_marraine,
      parrain_libre = CASE WHEN p_marraine IS NULL THEN parrain_libre ELSE '' END
  WHERE id = p_filleule;
END $$;

-- Ces fonctions passent outre le cloisonnement : elles ne doivent être
-- appelables que par une personne connectée, jamais avec la clé publique
-- du site. PostgreSQL accorde l'exécution à tout le monde par défaut.
REVOKE ALL ON FUNCTION chercher_parrain(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION apercu_cliente(uuid)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION filleules_de(uuid)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rattacher_filleule(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION chercher_parrain(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION apercu_cliente(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION filleules_de(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION rattacher_filleule(uuid, uuid) TO authenticated;
