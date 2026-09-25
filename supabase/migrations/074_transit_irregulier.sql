/*
  MAbeautyplus V2 — Migration 074 : « Irrégulier » au transit

  Une réponse de plus à la question « Votre digestion / transit : » du
  BioPortrait (Jonathan, 25 septembre 2026). Entre « Réguliers » et
  « Ballonnements fréquents », il manquait le cas le plus courant : un
  transit qui n'est pas régulier sans être pour autant un ballonnement ou
  une constipation. Faute de case, ces clientes cochaient « Réguliers »,
  et leur terrain Digestif ne se signalait jamais.

  ELLE S'INSÈRE EN DEUXIÈME POSITION, parce que la liste va du plus léger
  au plus marqué et qu'on la lit dans cet ordre. Or les réponses d'un bilan
  sont des POSITIONS dans la liste : « Ballonnements » passe de 1 à 2 et
  « Constipation » de 2 à 3. Un bilan déjà enregistré se relirait donc une
  réponse trop douce, et se recalculerait avec moins de points. Le script
  déplace ces réponses, comme la 065 l'avait fait pour « Éventration »,
  dans la même transaction que le barème et une seule fois.

  Les points suivent la gradation existante : T5 monte 0 · 1 · 2 · 3, et la
  pressodynamie 0 · 1 · 1 · 2 — un transit irrégulier signale une
  élimination qui traîne, sans peser autant qu'un ventre gonflé.

  Le fichier 036 porte la même liste : rejouer l'un ou l'autre donne le
  même barème.
*/

BEGIN;

-- La trace du déplacement des réponses, posée par la 065. Rappelée ici
-- pour que ce fichier se joue seul sur une base neuve.
CREATE TABLE IF NOT EXISTS migrations_faites (
  nom text PRIMARY KEY,
  le  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE migrations_faites ENABLE ROW LEVEL SECURITY;

/*
  L'index de la question n'est pas écrit en dur : il se cherche par son
  libellé. Une liste figée à côté d'un contenu versionné finit toujours par
  mentir — c'est le piège qui a fait afficher « Rétention » sur le score
  InBody.
*/
DO $$
DECLARE
  idx  int;
  deja boolean;
BEGIN
  SELECT (ord - 1)::int INTO idx
  FROM bareme_empreinte b,
       jsonb_array_elements(b.contenu->'STEPS') WITH ORDINALITY AS t(st, ord)
  WHERE b.version = 3
    AND st->>'t' LIKE 'Votre digestion / transit%'
  LIMIT 1;

  IF idx IS NULL THEN
    RAISE EXCEPTION 'Question « Votre digestion / transit » introuvable dans le barème version 3.';
  END IF;

  SELECT (contenu->'STEPS'->idx->'o')::text LIKE '%Irrégulier%'
    INTO deja
  FROM bareme_empreinte
  WHERE version = 3;

  IF deja THEN
    RAISE NOTICE 'Déjà fait : « Irrégulier » est dans le barème, rien à faire.';
    RETURN;
  END IF;

  -- 1. La réponse, juste après « Réguliers ».
  UPDATE bareme_empreinte
  SET contenu = jsonb_set(
    contenu,
    ARRAY['STEPS', idx::text, 'o'],
    (
      SELECT jsonb_agg(o ORDER BY rang)
      FROM (
        SELECT o, ord::numeric AS rang
        FROM jsonb_array_elements(contenu->'STEPS'->idx->'o') WITH ORDINALITY AS t(o, ord)
        UNION ALL
        SELECT '["Irrégulier", {"T5": 1}, {"PRESSO": 1}]'::jsonb, 1.5
      ) s
    )
  )
  WHERE version = 3;

  -- 2. Les bilans déjà enregistrés : tout ce qui était 1 ou 2 descend d'un cran.
  IF NOT EXISTS (SELECT 1 FROM migrations_faites WHERE nom = '074_transit_irregulier') THEN
    -- Une question à choix unique se range comme un nombre.
    UPDATE bilans
    SET reponses = jsonb_set(reponses, ARRAY[idx::text], to_jsonb(((reponses->>(idx::text))::int) + 1))
    WHERE bareme_version = 3
      AND famille = 'perte_de_poids'
      AND jsonb_typeof(reponses->(idx::text)) = 'number'
      AND (reponses->>(idx::text))::int >= 1;

    -- Par précaution : la même réponse rangée en liste.
    UPDATE bilans
    SET reponses = jsonb_set(
      reponses,
      ARRAY[idx::text],
      (
        SELECT jsonb_agg(CASE WHEN v >= 1 THEN v + 1 ELSE v END)
        FROM jsonb_array_elements_text(reponses->(idx::text)) AS t(x),
             LATERAL (SELECT x::int AS v) k
      )
    )
    WHERE bareme_version = 3
      AND famille = 'perte_de_poids'
      AND jsonb_typeof(reponses->(idx::text)) = 'array';
  END IF;

  INSERT INTO migrations_faites (nom) VALUES ('074_transit_irregulier') ON CONFLICT DO NOTHING;
END $$;

COMMIT;

-- Contrôle : quatre réponses, « Irrégulier » en deuxième.
SELECT ord - 1 AS indice, o->>0 AS reponse, o->1 AS axes, o->2 AS soins
FROM bareme_empreinte b,
     jsonb_array_elements(b.contenu->'STEPS') WITH ORDINALITY AS s(st, rang),
     jsonb_array_elements(st->'o') WITH ORDINALITY AS t(o, ord)
WHERE b.version = 3
  AND st->>'t' LIKE 'Votre digestion / transit%'
ORDER BY ord;
