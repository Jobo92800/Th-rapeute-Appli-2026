/*
  MAbeautyplus V2 — Migration 025 : deux corrections du tableau de bord

  1. Le filtre par thérapeute était incomplet. Les règlements de cures
     étaient bien filtrés, mais ni les ventes de compléments ni les bilans
     facturés : chaque thérapeute se voyait donc attribuer les 74 € de
     compléments vendus par le centre, même celles qui n'ont pas encore de
     compte. Un filtre à moitié appliqué est pire que pas de filtre : on
     croit lire un chiffre personnel et on lit celui du centre.

  2. L'ancien tableau de bord traçait une courbe par centre sur douze mois.
     Les barres encaissé/signé répondent à une autre question — « l'argent
     rentre-t-il aussi vite qu'il se vend ? » — et ne remplacent pas la
     comparaison des centres dans le temps. On ajoute donc la série
     mensuelle par centre.
*/

CREATE OR REPLACE FUNCTION tableau_de_bord(
  p_centre     text DEFAULT NULL,
  p_du         date DEFAULT CURRENT_DATE,
  p_au         date DEFAULT CURRENT_DATE,
  p_therapeute uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  resultat  jsonb;
  v_duree   integer;
  v_du_prec date;
  v_au_prec date;
BEGIN
  IF NOT est_direction() THEN
    RAISE EXCEPTION 'Le tableau de bord est réservé à la direction.';
  END IF;

  IF p_du > p_au THEN
    RAISE EXCEPTION 'La date de début est postérieure à la date de fin.';
  END IF;

  v_duree   := (p_au - p_du) + 1;
  v_au_prec := p_du - 1;
  v_du_prec := v_au_prec - (v_duree - 1);

  WITH
  reglements AS (
    SELECT e.montant, COALESCE(e.moyen, 'non precise') AS moyen
    FROM echeances e
    JOIN programmes p ON p.id = e.programme_id
    WHERE e.statut = 'paye'
      AND e.date_reglement BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR p.centre_id = p_centre)
      AND (p_therapeute IS NULL OR p.therapeute_id = p_therapeute)
  ),
  reglements_prec AS (
    SELECT e.montant
    FROM echeances e
    JOIN programmes p ON p.id = e.programme_id
    WHERE e.statut = 'paye'
      AND e.date_reglement BETWEEN v_du_prec AND v_au_prec
      AND (p_centre IS NULL OR p.centre_id = p_centre)
      AND (p_therapeute IS NULL OR p.therapeute_id = p_therapeute)
  ),
  -- Les compléments suivent la thérapeute qui les a vendus.
  ventes AS (
    SELECT v.quantite * v.prix_unitaire AS montant
    FROM ventes_complements v
    WHERE v.date_vente BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR v.centre_id = p_centre)
      AND (p_therapeute IS NULL OR v.therapeute_id = p_therapeute)
  ),
  -- Les bilans aussi.
  bilans_factures AS (
    SELECT COALESCE(b.montant_facture, 0) AS montant
    FROM bilans b
    WHERE b.facturation = 'facture'
      AND b.date_bilan BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR b.centre_id = p_centre)
      AND (p_therapeute IS NULL OR b.therapeute_id = p_therapeute)
  ),

  cures AS (
    SELECT p.id, p.cliente_id, p.centre_id, p.therapeute_id,
           p.montant_total, p.mode_reglement, p.numero, p.date_validation
    FROM programmes p
    WHERE p.statut <> 'abandonne'
      AND p.date_validation BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR p.centre_id = p_centre)
      AND (p_therapeute IS NULL OR p.therapeute_id = p_therapeute)
  ),
  cures_prec AS (
    SELECT p.montant_total
    FROM programmes p
    WHERE p.statut <> 'abandonne'
      AND p.date_validation BETWEEN v_du_prec AND v_au_prec
      AND (p_centre IS NULL OR p.centre_id = p_centre)
      AND (p_therapeute IS NULL OR p.therapeute_id = p_therapeute)
  ),

  seances_faites AS (
    SELECT s.technologie FROM seances s
    WHERE s.cloturee AND s.date_seance BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR s.centre_id = p_centre)
      AND (p_therapeute IS NULL OR s.therapeute_id = p_therapeute)
  ),
  bilans_periode AS (
    SELECT b.id, b.profil_dominant, b.terrain_dominant FROM bilans b
    WHERE b.date_bilan BETWEEN p_du AND p_au AND b.statut <> 'abandonne'
      AND (p_centre IS NULL OR b.centre_id = p_centre)
      AND (p_therapeute IS NULL OR b.therapeute_id = p_therapeute)
  ),
  -- Une cliente n'appartient à personne : elle n'est pas filtrée par
  -- thérapeute, seulement par centre.
  nouvelles AS (
    SELECT c.id FROM clientes c
    WHERE c.cree_le::date BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR c.centre_id = p_centre)
  ),
  contrats_periode AS (
    SELECT k.id FROM contrats k
    WHERE k.signe_le::date BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR k.centre_id = p_centre)
      AND (p_therapeute IS NULL OR k.therapeute_id = p_therapeute)
  ),

  attendu AS (
    SELECT
      COALESCE(SUM(e.montant) FILTER (WHERE e.statut IN ('a_venir','impaye')), 0) AS reste,
      COALESCE(SUM(e.montant) FILTER (
        WHERE e.statut IN ('a_venir','impaye') AND e.date_prevue < CURRENT_DATE), 0) AS retard_montant,
      COUNT(*) FILTER (
        WHERE e.statut IN ('a_venir','impaye') AND e.date_prevue < CURRENT_DATE) AS retard_nb,
      COALESCE(SUM(e.montant) FILTER (
        WHERE e.statut IN ('a_venir','impaye')
          AND e.date_prevue BETWEEN CURRENT_DATE AND CURRENT_DATE + 7), 0) AS semaine_montant,
      COUNT(*) FILTER (
        WHERE e.statut IN ('a_venir','impaye')
          AND e.date_prevue BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS semaine_nb
    FROM echeances e
    JOIN programmes p ON p.id = e.programme_id
    WHERE p.statut <> 'abandonne'
      AND (p_centre IS NULL OR p.centre_id = p_centre)
      AND (p_therapeute IS NULL OR p.therapeute_id = p_therapeute)
  ),

  mois AS (
    SELECT generate_series(
      date_trunc('month', p_au::timestamp) - INTERVAL '11 months',
      date_trunc('month', p_au::timestamp), INTERVAL '1 month')::date AS m
  ),
  mensuel AS (
    SELECT
      to_char(mois.m, 'YYYY-MM') AS mois,
      (SELECT COALESCE(SUM(e.montant), 0)
         FROM echeances e JOIN programmes p ON p.id = e.programme_id
        WHERE e.statut = 'paye'
          AND date_trunc('month', e.date_reglement)::date = mois.m
          AND (p_centre IS NULL OR p.centre_id = p_centre)
          AND (p_therapeute IS NULL OR p.therapeute_id = p_therapeute)) AS encaisse,
      (SELECT COALESCE(SUM(p.montant_total), 0)
         FROM programmes p
        WHERE p.statut <> 'abandonne'
          AND date_trunc('month', p.date_validation)::date = mois.m
          AND (p_centre IS NULL OR p.centre_id = p_centre)
          AND (p_therapeute IS NULL OR p.therapeute_id = p_therapeute)) AS signe
    FROM mois
  ),

  -- Douze mois, centre par centre : la courbe de l'ancien tableau de bord.
  mensuel_centre AS (
    SELECT
      ce.id AS centre_id,
      ce.nom AS centre,
      to_char(mois.m, 'YYYY-MM') AS mois,
      (SELECT COALESCE(SUM(p.montant_total), 0)
         FROM programmes p
        WHERE p.statut <> 'abandonne'
          AND p.centre_id = ce.id
          AND date_trunc('month', p.date_validation)::date = mois.m
          AND (p_therapeute IS NULL OR p.therapeute_id = p_therapeute)) AS montant
    FROM centres ce
    CROSS JOIN mois
    WHERE ce.actif AND (p_centre IS NULL OR ce.id = p_centre)
  ),

  mois6 AS (
    SELECT generate_series(
      date_trunc('month', p_au::timestamp) - INTERVAL '5 months',
      date_trunc('month', p_au::timestamp), INTERVAL '1 month')::date AS m
  ),
  croise AS (
    SELECT ce.id AS centre_id, ce.nom AS centre, to_char(mois6.m, 'YYYY-MM') AS mois,
      (SELECT COALESCE(SUM(p.montant_total), 0) FROM programmes p
        WHERE p.statut <> 'abandonne' AND p.centre_id = ce.id
          AND date_trunc('month', p.date_validation)::date = mois6.m
          AND (p_therapeute IS NULL OR p.therapeute_id = p_therapeute)) AS montant
    FROM centres ce CROSS JOIN mois6
    WHERE ce.actif AND (p_centre IS NULL OR ce.id = p_centre)
  ),

  marraines AS (
    SELECT c.id,
      (SELECT COUNT(*) FROM clientes f
        WHERE f.parrain_id = c.id AND f.archivee_le IS NULL
          AND EXISTS (SELECT 1 FROM contrats k WHERE k.cliente_id = f.id)) AS engagees,
      (SELECT COALESCE(SUM(l.seances_offertes), 0)
         FROM programmes p JOIN programme_lignes l ON l.programme_id = p.id
        WHERE p.cliente_id = c.id) AS utilisees
    FROM clientes c
    WHERE c.archivee_le IS NULL AND (p_centre IS NULL OR c.centre_id = p_centre)
  ),

  alertes AS (
    SELECT s.nom, s.centre_id, s.quantite, s.seuil_bas, s.seuil_critique
    FROM etat_stock s
    WHERE s.quantite <= s.seuil_bas AND (p_centre IS NULL OR s.centre_id = p_centre)
    ORDER BY s.quantite, s.nom LIMIT 12
  )

  SELECT jsonb_build_object(
    'periode', jsonb_build_object('du', p_du, 'au', p_au, 'centre', p_centre,
                                  'du_precedent', v_du_prec, 'au_precedent', v_au_prec),

    'encaisse', jsonb_build_object(
      'cures',       (SELECT COALESCE(SUM(montant), 0) FROM reglements),
      'complements', (SELECT COALESCE(SUM(montant), 0) FROM ventes),
      'bilans',      (SELECT COALESCE(SUM(montant), 0) FROM bilans_factures),
      'total',       (SELECT COALESCE(SUM(montant), 0) FROM reglements)
                   + (SELECT COALESCE(SUM(montant), 0) FROM ventes)
                   + (SELECT COALESCE(SUM(montant), 0) FROM bilans_factures),
      'precedent',   (SELECT COALESCE(SUM(montant), 0) FROM reglements_prec),
      'par_moyen',   (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'moyen'), '[]'::jsonb)
                        FROM (SELECT jsonb_build_object('moyen', moyen,
                                'montant', SUM(montant), 'nb', COUNT(*)) AS x
                              FROM reglements GROUP BY moyen) s)
    ),

    'signe', jsonb_build_object(
      'nb',           (SELECT COUNT(*) FROM cures),
      'montant',      (SELECT COALESCE(SUM(montant_total), 0) FROM cures),
      'precedent',    (SELECT COALESCE(SUM(montant_total), 0) FROM cures_prec),
      'panier_moyen', (SELECT COALESCE(ROUND(AVG(montant_total), 0), 0) FROM cures),
      'panier_precedent', (SELECT COALESCE(ROUND(AVG(montant_total), 0), 0) FROM cures_prec),
      'premieres',    (SELECT COUNT(*) FROM cures WHERE numero = 1),
      'suivantes',    (SELECT COUNT(*) FROM cures WHERE numero > 1),
      'par_mode',     (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'mode'), '[]'::jsonb)
                         FROM (SELECT jsonb_build_object('mode', mode_reglement,
                                 'nb', COUNT(*), 'montant', SUM(montant_total)) AS x
                               FROM cures GROUP BY mode_reglement) s)
    ),

    'par_centre', (SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'montant')::numeric DESC), '[]'::jsonb)
                     FROM (SELECT jsonb_build_object('centre_id', c.centre_id, 'centre', ce.nom,
                             'montant', SUM(c.montant_total), 'nb', COUNT(*)) AS x
                           FROM cures c JOIN centres ce ON ce.id = c.centre_id
                           GROUP BY c.centre_id, ce.nom) s),

    'par_therapeute', (SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'montant')::numeric DESC), '[]'::jsonb)
                         FROM (SELECT jsonb_build_object('therapeute_id', c.therapeute_id,
                                 'therapeute', COALESCE(t.prenom, 'Non renseignée'),
                                 'centre_id', c.centre_id,
                                 'montant', SUM(c.montant_total), 'nb', COUNT(*)) AS x
                               FROM cures c LEFT JOIN therapeutes t ON t.id = c.therapeute_id
                               GROUP BY c.therapeute_id, t.prenom, c.centre_id) s),

    'mensuel_par_centre', jsonb_build_object(
      'mois', (SELECT COALESCE(jsonb_agg(m ORDER BY m), '[]'::jsonb)
                 FROM (SELECT DISTINCT mois AS m FROM mensuel_centre) x),
      'lignes', (SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'total')::numeric DESC), '[]'::jsonb)
                   FROM (SELECT jsonb_build_object('centre_id', centre_id, 'centre', centre,
                           'valeurs', jsonb_object_agg(mois, montant),
                           'total', SUM(montant)) AS x
                         FROM mensuel_centre GROUP BY centre_id, centre) s)
    ),

    'croise', jsonb_build_object(
      'mois', (SELECT COALESCE(jsonb_agg(m ORDER BY m), '[]'::jsonb)
                 FROM (SELECT DISTINCT mois AS m FROM croise) x),
      'lignes', (SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'total')::numeric DESC), '[]'::jsonb)
                   FROM (SELECT jsonb_build_object('centre_id', centre_id, 'centre', centre,
                           'valeurs', jsonb_object_agg(mois, montant),
                           'total', SUM(montant)) AS x
                         FROM croise GROUP BY centre_id, centre) s)
    ),

    'dernieres_ventes', (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'date' DESC), '[]'::jsonb)
      FROM (SELECT jsonb_build_object('date', p.date_validation, 'cliente_id', cl.id,
              'cliente', cl.prenom || ' ' || cl.nom, 'centre', ce.nom,
              'therapeute', COALESCE(t.prenom, '—'),
              'montant', p.montant_total, 'numero', p.numero) AS x
            FROM programmes p
            JOIN clientes cl ON cl.id = p.cliente_id
            JOIN centres ce ON ce.id = p.centre_id
            LEFT JOIN therapeutes t ON t.id = p.therapeute_id
            WHERE p.statut <> 'abandonne' AND p.date_validation IS NOT NULL
              AND (p_centre IS NULL OR p.centre_id = p_centre)
              AND (p_therapeute IS NULL OR p.therapeute_id = p_therapeute)
            ORDER BY p.date_validation DESC, p.cree_le DESC LIMIT 20) s),

    'activite', jsonb_build_object(
      'seances',            (SELECT COUNT(*) FROM seances_faites),
      'par_technologie',    (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'technologie'), '[]'::jsonb)
                               FROM (SELECT jsonb_build_object('technologie', technologie,
                                       'nb', COUNT(*)) AS x
                                     FROM seances_faites GROUP BY technologie) s),
      'bilans',             (SELECT COUNT(*) FROM bilans_periode),
      'contrats_signes',    (SELECT COUNT(*) FROM contrats_periode),
      'nouvelles_clientes', (SELECT COUNT(*) FROM nouvelles)
    ),

    'attendu', (SELECT jsonb_build_object('reste', reste, 'retard_montant', retard_montant,
      'retard_nb', retard_nb, 'semaine_montant', semaine_montant,
      'semaine_nb', semaine_nb) FROM attendu),

    'empreinte', jsonb_build_object(
      'profils',  (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'code'), '[]'::jsonb)
                     FROM (SELECT jsonb_build_object('code', profil_dominant, 'nb', COUNT(*)) AS x
                           FROM bilans_periode WHERE profil_dominant IS NOT NULL
                           GROUP BY profil_dominant) s),
      'terrains', (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'code'), '[]'::jsonb)
                     FROM (SELECT jsonb_build_object('code', terrain_dominant, 'nb', COUNT(*)) AS x
                           FROM bilans_periode WHERE terrain_dominant IS NOT NULL
                           GROUP BY terrain_dominant) s)
    ),

    'parrainage', jsonb_build_object(
      'marraines', (SELECT COUNT(*) FROM marraines WHERE engagees > 0),
      'a_poser',   (SELECT COALESCE(SUM(GREATEST(0, LEAST(engagees * 2, 10) - utilisees)), 0)
                      FROM marraines WHERE engagees > 0)
    ),

    'stock', jsonb_build_object(
      'alertes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('nom', nom, 'centre_id', centre_id,
                    'quantite', quantite, 'seuil_bas', seuil_bas,
                    'seuil_critique', seuil_critique)), '[]'::jsonb) FROM alertes)
    ),

    'mensuel', (SELECT COALESCE(jsonb_agg(jsonb_build_object('mois', mois,
                  'encaisse', encaisse, 'signe', signe) ORDER BY mois), '[]'::jsonb) FROM mensuel)
  )
  INTO resultat;

  RETURN resultat;
END $$;

REVOKE ALL ON FUNCTION tableau_de_bord(text, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION tableau_de_bord(text, date, date, uuid) TO authenticated;
