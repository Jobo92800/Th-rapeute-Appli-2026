/*
  MAbeautyplus V2 — Migration 075 : le délai d'un mois ne concerne que les
  soins qui le justifient

  Dans le Bilan Profil Signature, la question « Date du dernier peeling,
  laser ou injection : » se posait dès que la cliente avait répondu OUI à
  « Avez-vous déjà réalisé des soins esthétiques du visage ? », quoi qu'elle
  ait coché ensuite. Une cliente qui avait seulement coché « Autre » — ou un
  soin visage classique — se voyait demander cette date, répondait « moins
  d'un mois » en pensant à son soin, et la cure se trouvait décalée d'un
  mois sans raison. Jonathan, 25 septembre 2026.

  La question ne se pose donc plus que si la cliente a coché **Peelings,
  Laser ou Injections** — c'est exactement ce que la question demande, et
  c'est de ces trois soins que vient le délai d'un mois. Un soin visage
  classique, une technologie esthétique ou un « Autre » ne décalent rien.

  Les positions des réponses ne sont pas écrites en dur : elles se cherchent
  par leur libellé, pour que l'ajout d'une réponse à « Lesquels ? » ne
  déplace pas la condition en silence.

  Le fichier 071 porte la même condition : rejouer l'un ou l'autre donne le
  même barème. Rien à reprendre sur les bilans déjà enregistrés — le code
  relit la condition, une réponse restée en mémoire ne décale plus rien.
*/

BEGIN;

DO $$
DECLARE
  idx  int;
  opts jsonb;
BEGIN
  SELECT (ord - 1)::int INTO idx
  FROM bareme_signature b,
       jsonb_array_elements(b.contenu->'QUESTIONS') WITH ORDINALITY AS t(q, ord)
  WHERE b.version = 1
    AND q->>'code' = 'q10c'
  LIMIT 1;

  IF idx IS NULL THEN
    RAISE EXCEPTION 'Question q10c (date du dernier peeling) introuvable dans le barème Signature 1.';
  END IF;

  -- Les rangs de « Peelings », « Laser » et « Injections » dans « Lesquels ? ».
  SELECT jsonb_agg(ord - 1 ORDER BY ord) INTO opts
  FROM bareme_signature b,
       jsonb_array_elements(b.contenu->'QUESTIONS') WITH ORDINALITY AS t(q, qord),
       jsonb_array_elements(q->'o') WITH ORDINALITY AS o(opt, ord)
  WHERE b.version = 1
    AND q->>'code' = 'q10b'
    AND opt->>0 IN ('Peelings', 'Laser', 'Injections');

  IF opts IS NULL OR jsonb_array_length(opts) <> 3 THEN
    RAISE EXCEPTION 'Les réponses Peelings / Laser / Injections sont introuvables dans q10b (trouvé : %).', opts;
  END IF;

  UPDATE bareme_signature
  SET contenu = jsonb_set(
    contenu,
    ARRAY['QUESTIONS', idx::text, 'si'],
    jsonb_build_object('code', 'q10b', 'options', opts)
  )
  WHERE version = 1;
END $$;

COMMIT;

-- Contrôle : la question de la date, et ce qui la déclenche.
SELECT q->>'code' AS code, q->>'t' AS question, q->'si' AS se_pose_si
FROM bareme_signature b,
     jsonb_array_elements(b.contenu->'QUESTIONS') AS t(q)
WHERE b.version = 1
  AND q->>'code' IN ('q10', 'q10b', 'q10c');
