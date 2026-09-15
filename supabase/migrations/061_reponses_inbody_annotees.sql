/*
  MAbeautyplus V2 — Migration 061 : les réponses InBody disent où lire

  Les quatre questions d'analyse du BioPortrait (graisse viscérale, masse
  musculaire, métabolisme de base, rétention d'eau) proposaient des mots —
  « Basse », « Moyenne », « Élevée » — que chaque thérapeute traduisait à sa
  façon depuis la feuille InBody. Jonathan (15 septembre 2026) a fixé, pour
  chaque réponse, l'endroit exact de la feuille où on la lit : la zone
  grise pour la graisse viscérale, la norme pour la masse musculaire, la
  fourchette pour le métabolisme, le ratio pour la rétention.

  LES POINTS NE BOUGENT PAS. Ni l'ordre des réponses, ni ce qu'elles
  donnent au terrain et à la prescription : à réponses identiques, une
  cliente reçoit le même BioPortrait et paie exactement pareil. C'est
  pourquoi la version 3 est modifiée EN PLACE plutôt que de créer une
  version 4 : « Mes réponses » relit chaque bilan dans sa version, et les
  bilans déjà passés afficheront les nouveaux libellés — même sens, mots
  plus précis. L'`inbody` figé sur chaque bilan à sa validation garde,
  lui, les mots de l'époque.

  Le fichier 036 porte les mêmes libellés : rejouer l'un ou l'autre donne
  le même barème.

  Le script vérifie que chaque nouveau libellé COMMENCE par l'ancien, et
  refuse tout sinon : une réponse déplacée changerait les points d'une
  cliente sans que rien ne le dise.
*/

CREATE OR REPLACE FUNCTION pg_temp.renommer_reponses(o jsonb, noms jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  sortie jsonb := '[]'::jsonb;
  i integer;
BEGIN
  IF jsonb_array_length(o) <> jsonb_array_length(noms) THEN
    RAISE EXCEPTION 'Nombre de réponses différent : % en base, % demandées.',
      jsonb_array_length(o), jsonb_array_length(noms);
  END IF;
  FOR i IN 0 .. jsonb_array_length(o) - 1 LOOP
    IF position((o->i->>0) IN (noms->>i)) <> 1 THEN
      RAISE EXCEPTION 'La réponse « % » ne commence pas par « % » : l''ordre a changé, on refuse.',
        noms->>i, o->i->>0;
    END IF;
    sortie := sortie || jsonb_build_array(jsonb_set(o->i, '{0}', noms->i));
  END LOOP;
  RETURN sortie;
END $$;

UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{STEPS}', (
  SELECT jsonb_agg(
    CASE s->>'t'
      WHEN 'Graisse viscérale' THEN jsonb_set(s, '{o}', pg_temp.renommer_reponses(s->'o',
        '["Basse (bas de la zone gris clair)", "Moyenne (autour de la médiane)", "Élevée (dans la zone gris foncé)", "Très élevée (au-delà de la fourchette)"]'))
      WHEN 'Masse musculaire' THEN jsonb_set(s, '{o}', pg_temp.renommer_reponses(s->'o',
        '["Très faible (inférieure)", "Faible (norme basse)", "Normale (norme haute)", "Élevée (légèrement supérieure)", "Très élevée (largement supérieure)"]'))
      WHEN 'Métabolisme de base' THEN jsonb_set(s, '{o}', pg_temp.renommer_reponses(s->'o',
        '["Actif (au-dessus de la norme)", "Normal (dans la fourchette)", "Lent (sur / juste sous la fourchette basse)", "Très lent (+200 kcal sous la fourchette basse)"]'))
      WHEN 'Rétention d''eau' THEN jsonb_set(s, '{o}', pg_temp.renommer_reponses(s->'o',
        '["Basse (0,380 ou -)", "Moyenne (0,381 à 0,390)", "Élevée (0,390 ou +)"]'))
      ELSE s
    END
    ORDER BY ord)
  FROM jsonb_array_elements(contenu->'STEPS') WITH ORDINALITY AS e(s, ord)
))
WHERE version = 3
  AND (contenu->'STEPS')::text NOT LIKE '%zone gris clair%';   -- rejouable : déjà fait, on ne touche plus

-- Contrôle : les quatre questions et leurs réponses, telles qu'elles seront posées.
SELECT s->>'t' AS question, string_agg(r->>0, ' · ' ORDER BY ord) AS reponses
FROM bareme_empreinte b,
     jsonb_array_elements(b.contenu->'STEPS') AS s,
     jsonb_array_elements(s->'o') WITH ORDINALITY AS o(r, ord)
WHERE b.version = 3 AND s->>'phase' = 'analyse' AND COALESCE((s->>'score')::boolean, false) = false
GROUP BY s->>'t';
