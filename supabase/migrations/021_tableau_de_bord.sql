/*
  MAbeautyplus V2 — Migration 021 : le tableau de bord de la direction

  Tous les chiffres en un seul aller-retour, et un seul endroit où les
  règles de calcul sont écrites. Deux notions d'argent, à ne jamais
  confondre :

    — l'ENCAISSÉ : ce qui est réellement rentré sur la période, échéance
      par échéance, à la date de règlement. C'est l'argent en caisse.
    — le SIGNÉ : ce que les cures validées sur la période représentent.
      C'est la vente, elle sera encaissée plus tard, parfois sur dix mois.

  Un mois peut afficher un gros signé et un faible encaissé — c'est normal,
  ce n'est pas une erreur.

  Le retard se définit exactement comme dans la vue situation_reglement :
  une échéance à venir ou impayée dont la date est passée. Deux définitions
  différentes du retard dans la même application, et plus personne ne sait
  qui a raison.

  Réservée à la direction : une thérapeute ne voit pas les chiffres des
  autres centres, ni les siens agrégés.
*/

CREATE OR REPLACE FUNCTION tableau_de_bord(
  p_centre text DEFAULT NULL,
  p_du     date DEFAULT CURRENT_DATE,
  p_au     date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  resultat jsonb;
BEGIN
  IF NOT est_direction() THEN
    RAISE EXCEPTION 'Le tableau de bord est réservé à la direction.';
  END IF;

  IF p_du > p_au THEN
    RAISE EXCEPTION 'La date de début est postérieure à la date de fin.';
  END IF;

  WITH
  -- ---------------------------------------------------------------------
  -- L'argent rentré sur la période
  -- ---------------------------------------------------------------------
  reglements AS (
    SELECT e.montant, COALESCE(e.moyen, 'non precise') AS moyen
    FROM echeances e
    JOIN programmes p ON p.id = e.programme_id
    WHERE e.statut = 'paye'
      AND e.date_reglement BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR p.centre_id = p_centre)
  ),
  ventes AS (
    SELECT v.quantite * v.prix_unitaire AS montant, v.quantite
    FROM ventes_complements v
    WHERE v.date_vente BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR v.centre_id = p_centre)
  ),
  bilans_factures AS (
    SELECT COALESCE(b.montant_facture, 0) AS montant
    FROM bilans b
    WHERE b.facturation = 'facture'
      AND b.date_bilan BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR b.centre_id = p_centre)
  ),

  -- ---------------------------------------------------------------------
  -- Ce qui a été vendu sur la période
  -- ---------------------------------------------------------------------
  cures AS (
    SELECT p.id, p.montant_total, p.mode_reglement, p.numero
    FROM programmes p
    WHERE p.statut <> 'abandonne'
      AND p.date_validation BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR p.centre_id = p_centre)
  ),

  -- ---------------------------------------------------------------------
  -- L'activité
  -- ---------------------------------------------------------------------
  seances_faites AS (
    SELECT s.technologie
    FROM seances s
    WHERE s.cloturee
      AND s.date_seance BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR s.centre_id = p_centre)
  ),
  bilans_periode AS (
    SELECT b.id, b.cliente_id, b.profil_dominant, b.terrain_dominant
    FROM bilans b
    WHERE b.date_bilan BETWEEN p_du AND p_au
      AND b.statut <> 'abandonne'
      AND (p_centre IS NULL OR b.centre_id = p_centre)
  ),
  nouvelles AS (
    SELECT c.id
    FROM clientes c
    WHERE c.cree_le::date BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR c.centre_id = p_centre)
  ),
  contrats_periode AS (
    SELECT k.id, k.cliente_id
    FROM contrats k
    WHERE k.signe_le::date BETWEEN p_du AND p_au
      AND (p_centre IS NULL OR k.centre_id = p_centre)
  ),

  -- ---------------------------------------------------------------------
  -- L'argent qui reste dû, tous programmes confondus
  -- ---------------------------------------------------------------------
  attendu AS (
    SELECT
      COALESCE(SUM(e.montant) FILTER (
        WHERE e.statut IN ('a_venir', 'impaye')), 0) AS reste,
      COALESCE(SUM(e.montant) FILTER (
        WHERE e.statut IN ('a_venir', 'impaye') AND e.date_prevue < CURRENT_DATE), 0) AS retard_montant,
      COUNT(*) FILTER (
        WHERE e.statut IN ('a_venir', 'impaye') AND e.date_prevue < CURRENT_DATE) AS retard_nb,
      COALESCE(SUM(e.montant) FILTER (
        WHERE e.statut IN ('a_venir', 'impaye')
          AND e.date_prevue BETWEEN CURRENT_DATE AND CURRENT_DATE + 7), 0) AS semaine_montant,
      COUNT(*) FILTER (
        WHERE e.statut IN ('a_venir', 'impaye')
          AND e.date_prevue BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS semaine_nb
    FROM echeances e
    JOIN programmes p ON p.id = e.programme_id
    WHERE p.statut <> 'abandonne'
      AND (p_centre IS NULL OR p.centre_id = p_centre)
  ),

  -- ---------------------------------------------------------------------
  -- Douze mois d'histoire, pour la courbe
  -- ---------------------------------------------------------------------
  mois AS (
    SELECT generate_series(
      date_trunc('month', p_au::timestamp) - INTERVAL '11 months',
      date_trunc('month', p_au::timestamp),
      INTERVAL '1 month'
    )::date AS m
  ),
  mensuel AS (
    SELECT
      to_char(mois.m, 'YYYY-MM') AS mois,
      (SELECT COALESCE(SUM(e.montant), 0)
         FROM echeances e JOIN programmes p ON p.id = e.programme_id
        WHERE e.statut = 'paye'
          AND date_trunc('month', e.date_reglement)::date = mois.m
          AND (p_centre IS NULL OR p.centre_id = p_centre)) AS encaisse,
      (SELECT COALESCE(SUM(p.montant_total), 0)
         FROM programmes p
        WHERE p.statut <> 'abandonne'
          AND date_trunc('month', p.date_validation)::date = mois.m
          AND (p_centre IS NULL OR p.centre_id = p_centre)) AS signe
    FROM mois
    ORDER BY mois.m
  ),

  -- ---------------------------------------------------------------------
  -- Le parrainage : ce qui attend d'être posé sur une prochaine cure
  -- ---------------------------------------------------------------------
  marraines AS (
    SELECT
      c.id,
      (SELECT COUNT(*) FROM clientes f
        WHERE f.parrain_id = c.id AND f.archivee_le IS NULL
          AND EXISTS (SELECT 1 FROM contrats k WHERE k.cliente_id = f.id)) AS engagees,
      (SELECT COALESCE(SUM(l.seances_offertes), 0)
         FROM programmes p JOIN programme_lignes l ON l.programme_id = p.id
        WHERE p.cliente_id = c.id) AS utilisees
    FROM clientes c
    WHERE c.archivee_le IS NULL
      AND (p_centre IS NULL OR c.centre_id = p_centre)
  ),

  -- ---------------------------------------------------------------------
  -- Le stock qui appelle une commande
  -- ---------------------------------------------------------------------
  alertes AS (
    SELECT s.nom, s.centre_id, s.quantite, s.seuil_bas, s.seuil_critique
    FROM etat_stock s
    WHERE s.quantite <= s.seuil_bas
      AND (p_centre IS NULL OR s.centre_id = p_centre)
    ORDER BY s.quantite, s.nom
    LIMIT 12
  )

  SELECT jsonb_build_object(
    'periode', jsonb_build_object('du', p_du, 'au', p_au, 'centre', p_centre),

    'encaisse', jsonb_build_object(
      'cures',       (SELECT COALESCE(SUM(montant), 0) FROM reglements),
      'complements', (SELECT COALESCE(SUM(montant), 0) FROM ventes),
      'bilans',      (SELECT COALESCE(SUM(montant), 0) FROM bilans_factures),
      'total',       (SELECT COALESCE(SUM(montant), 0) FROM reglements)
                   + (SELECT COALESCE(SUM(montant), 0) FROM ventes)
                   + (SELECT COALESCE(SUM(montant), 0) FROM bilans_factures),
      'par_moyen',   (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'moyen'), '[]'::jsonb)
                        FROM (SELECT jsonb_build_object(
                                'moyen', moyen,
                                'montant', SUM(montant),
                                'nb', COUNT(*)) AS x
                              FROM reglements GROUP BY moyen) s)
    ),

    'signe', jsonb_build_object(
      'nb',           (SELECT COUNT(*) FROM cures),
      'montant',      (SELECT COALESCE(SUM(montant_total), 0) FROM cures),
      'panier_moyen', (SELECT COALESCE(ROUND(AVG(montant_total), 0), 0) FROM cures),
      'premieres',    (SELECT COUNT(*) FROM cures WHERE numero = 1),
      'suivantes',    (SELECT COUNT(*) FROM cures WHERE numero > 1),
      'par_mode',     (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'mode'), '[]'::jsonb)
                         FROM (SELECT jsonb_build_object(
                                 'mode', mode_reglement,
                                 'nb', COUNT(*),
                                 'montant', SUM(montant_total)) AS x
                               FROM cures GROUP BY mode_reglement) s)
    ),

    'activite', jsonb_build_object(
      'seances',            (SELECT COUNT(*) FROM seances_faites),
      'par_technologie',    (SELECT COALESCE(jsonb_agg(x ORDER BY x->>'technologie'), '[]'::jsonb)
                               FROM (SELECT jsonb_build_object(
                                       'technologie', technologie,
                                       'nb', COUNT(*)) AS x
                                     FROM seances_faites GROUP BY technologie) s),
      'bilans',             (SELECT COUNT(*) FROM bilans_periode),
      'contrats_signes',    (SELECT COUNT(*) FROM contrats_periode),
      'nouvelles_clientes', (SELECT COUNT(*) FROM nouvelles)
    ),

    'attendu', (SELECT jsonb_build_object(
      'reste',           reste,
      'retard_montant',  retard_montant,
      'retard_nb',       retard_nb,
      'semaine_montant', semaine_montant,
      'semaine_nb',      semaine_nb) FROM attendu),

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
      'marraines',     (SELECT COUNT(*) FROM marraines WHERE engagees > 0),
      'a_poser',       (SELECT COALESCE(SUM(GREATEST(0, LEAST(engagees * 2, 10) - utilisees)), 0)
                          FROM marraines WHERE engagees > 0)
    ),

    'stock', jsonb_build_object(
      'alertes', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'nom', nom, 'centre_id', centre_id, 'quantite', quantite,
                    'seuil_bas', seuil_bas, 'seuil_critique', seuil_critique)), '[]'::jsonb)
                  FROM alertes)
    ),

    'mensuel', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                  'mois', mois, 'encaisse', encaisse, 'signe', signe) ORDER BY mois), '[]'::jsonb)
                FROM mensuel)
  )
  INTO resultat;

  RETURN resultat;
END $$;

-- Réservée aux comptes connectés, et la fonction vérifie elle-même le rôle.
REVOKE ALL ON FUNCTION tableau_de_bord(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION tableau_de_bord(text, date, date) TO authenticated;
