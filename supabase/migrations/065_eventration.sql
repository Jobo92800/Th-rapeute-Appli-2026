/*
  MAbeautyplus V2 — Migration 065 : l'éventration contre-indique l'I-Shape

  Une réponse de plus à la première question du BioPortrait (« Êtes-vous
  concerné(e) par l'une de ces situations de santé ? ») : « Éventration ».
  Cochée, elle RETIRE l'I-Shape de la prescription — une contre-indication
  franche, pas un avis médical : l'électrostimulation sur une paroi
  abdominale ouverte est interdite. Jonathan, 15 septembre 2026.

  ELLE S'INSÈRE AVANT « AUCUNE DE CES SITUATIONS », pour que « Aucune »
  reste la dernière ligne — c'est là qu'on la cherche. Or les réponses d'un
  bilan sont des POSITIONS dans la liste : « Aucune » passe de la 9e à la
  10e place (indices 8 → 9), et un bilan déjà enregistré qui avait coché
  « Aucune » se relirait « Éventration » — et, recalculé, perdrait son
  I-Shape. Le script déplace donc aussi ces réponses, pour tous les bilans
  de la version 3. Tout se fait dans une transaction : le barème et les
  réponses bougent ensemble, ou pas du tout.

  Le fichier 036 porte la même liste : rejouer l'un ou l'autre donne le
  même barème.
*/

BEGIN;

-- 0. Une trace, pour que le déplacement des réponses (étape 2) ne se
--    rejoue jamais : deux passages décaleraient « Aucune » deux fois.
CREATE TABLE IF NOT EXISTS migrations_faites (
  nom text PRIMARY KEY,
  le  timestamptz NOT NULL DEFAULT now()
);

-- 1. La réponse, avant « Aucune de ces situations ».
UPDATE bareme_empreinte
SET contenu = jsonb_set(
  contenu,
  '{STEPS,0,o}',
  (
    SELECT jsonb_agg(o ORDER BY ord)
    FROM (
      SELECT o, ord::numeric AS ord
      FROM jsonb_array_elements(contenu->'STEPS'->0->'o') WITH ORDINALITY AS t(o, ord)
      WHERE o->>0 <> 'Aucune de ces situations'
      UNION ALL
      SELECT '["Éventration", {}, {}, {"ISHAPE": "rem"}]'::jsonb, 8.5
      UNION ALL
      SELECT o, ord::numeric
      FROM jsonb_array_elements(contenu->'STEPS'->0->'o') WITH ORDINALITY AS t(o, ord)
      WHERE o->>0 = 'Aucune de ces situations'
    ) s
  )
)
WHERE version = 3
  AND contenu->'STEPS'->0->>'t' LIKE 'Êtes-vous concerné%'
  AND NOT (contenu->'STEPS'->0->'o')::text LIKE '%Éventration%';   -- rejouable

-- 2. Les bilans déjà enregistrés sur la version 3 : « Aucune » était la
--    réponse 8, elle devient la 9. Une seule fois : on ne touche qu'aux
--    bilans qui portent la réponse 8, et jamais deux fois (trace ci-dessus).
UPDATE bilans b
SET reponses = jsonb_set(
  reponses,
  '{0}',
  (
    SELECT jsonb_agg(CASE WHEN v = 8 THEN 9 ELSE v END)
    FROM jsonb_array_elements_text(reponses->'0') AS t(x), LATERAL (SELECT x::int AS v) k
  )
)
WHERE b.bareme_version = 3
  AND b.famille IS DISTINCT FROM 'anti_age'
  AND jsonb_typeof(reponses->'0') = 'array'
  AND reponses->'0' @> '[8]'::jsonb
  AND NOT EXISTS (SELECT 1 FROM migrations_faites WHERE nom = '065_eventration');

INSERT INTO migrations_faites (nom) VALUES ('065_eventration') ON CONFLICT DO NOTHING;

COMMIT;

-- Contrôle : la liste des réponses, « Éventration » en 9e, « Aucune » en 10e.
SELECT ord - 1 AS indice, o->>0 AS reponse, o->3 AS contre_indication
FROM bareme_empreinte b, jsonb_array_elements(b.contenu->'STEPS'->0->'o') WITH ORDINALITY AS t(o, ord)
WHERE b.version = 3
ORDER BY ord;
