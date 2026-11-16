/*
  MAbeautyplus V2 — Migration 083 : l'éditeur de tickets Z

  CE QU'ON AJOUTE.

  Un ticket Z, c'est l'arrêté de caisse : ce qui est réellement entré sur
  une période, moyen de règlement par moyen de règlement, caisse par
  caisse, avec le nom de qui a payé. Jusqu'ici il fallait le refaire à la
  main à chaque fois. Cette fonction rend, en un appel, tout ce qu'il faut
  pour en composer un sur n'importe quelle période.

  CE QUI COMPTE COMME ENCAISSÉ : une échéance pointée « payée », rangée à
  sa DATE DE RÈGLEMENT — pas à sa date d'échéance. C'est la seule date qui
  dit quand l'argent est entré.

  Les cures Alma sont encaissées le jour de la signature (voir la 053) :
  l'organisme avance l'argent et porte le risque. Leurs échéances portent
  ce que règle la cliente, frais compris ; `montant_alma` permet de
  rapporter les frais de la cure à la part réellement vue dans la période,
  sans les déduire d'un règlement qui n'est pas passé par Alma (voir la 054).

  CE QU'ON SORT À CÔTÉ, sans le compter : les bilans facturés sans cure
  derrière — l'application n'enregistre ni la date ni le moyen de leur
  règlement — et les ventes de compléments, qui n'ont pas de moyen non plus.
  Les montrer évite de croire que la caisse est complète quand elle ne l'est
  pas.

  RÉSERVÉ À LA DIRECTION, vérifié côté base : une thérapeute qui forcerait
  l'adresse de la page n'obtiendrait rien.
*/

CREATE OR REPLACE FUNCTION ticket_z(p_du date, p_au date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  resultat jsonb;
BEGIN
  IF NOT est_direction() THEN
    RAISE EXCEPTION 'L''éditeur de tickets Z est réservé à la direction.';
  END IF;

  IF p_du IS NULL OR p_au IS NULL THEN
    RAISE EXCEPTION 'Il faut un premier et un dernier jour.';
  END IF;

  IF p_du > p_au THEN
    RAISE EXCEPTION 'La période est à l''envers : le premier jour doit précéder le dernier.';
  END IF;

  SELECT jsonb_build_object(

    'du', p_du,
    'au', p_au,

    'centres', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.nom) ORDER BY c.nom)
      FROM centres c
    ), '[]'::jsonb),

    /* Ce qui est entré : une ligne par échéance pointée payée. */
    'reglements', COALESCE((
      SELECT jsonb_agg(l.ligne ORDER BY l.centre_id, l.quand, l.qui)
      FROM (
        SELECT
          p.centre_id,
          e.date_reglement AS quand,
          cl.prenom || ' ' || cl.nom AS qui,
          jsonb_build_object(
            'centre_id',      p.centre_id,
            'cliente',        cl.prenom || ' ' || cl.nom,
            'cliente_id',     cl.id,
            'date_reglement', e.date_reglement,
            'moyen',          e.moyen,
            'type',           e.type,
            'rang',           e.rang,
            'montant',        e.montant,
            'programme_id',   p.id,
            'montant_cure',   p.montant_total,
            'frais',          COALESCE(p.frais_financement, 0),
            'mode_reglement', p.mode_reglement,
            'nb_echeances',   (
              SELECT count(*) FROM echeances x
              WHERE x.programme_id = p.id AND x.type = 'echeance'
            ),
            /* Tout ce que la cure doit à Alma, pour y rapporter ses frais. */
            'montant_alma',   COALESCE((
              SELECT sum(x.montant) FROM echeances x
              WHERE x.programme_id = p.id AND x.moyen = 'alma'
            ), 0)
          ) AS ligne
        FROM echeances e
        JOIN programmes p ON p.id = e.programme_id
        JOIN clientes   cl ON cl.id = p.cliente_id
        WHERE e.statut = 'paye'
          AND e.date_reglement BETWEEN p_du AND p_au
      ) l
    ), '[]'::jsonb),

    /* Ce qui était dû pendant la période et n'a pas été pointé. */
    'restant', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'centre_id', t.centre_id, 'nb', t.nb, 'montant', t.montant
      ))
      FROM (
        SELECT p.centre_id, count(*)::integer AS nb, sum(e.montant) AS montant
        FROM echeances e
        JOIN programmes p ON p.id = e.programme_id
        WHERE e.statut IN ('a_venir', 'impaye')
          AND e.date_prevue BETWEEN p_du AND p_au
          AND p.statut <> 'abandonne'
        GROUP BY p.centre_id
      ) t
    ), '[]'::jsonb),

    /* Facturés, mais l'application ne sait ni quand ni comment ils ont été réglés. */
    'bilans_seuls', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'centre_id', b.centre_id,
        'cliente',   cl.prenom || ' ' || cl.nom,
        'montant',   b.montant_facture,
        'date',      b.date_bilan
      ) ORDER BY b.date_bilan)
      FROM bilans b
      JOIN clientes cl ON cl.id = b.cliente_id
      WHERE b.date_bilan BETWEEN p_du AND p_au
        AND b.facturation = 'facture'
        AND NOT EXISTS (SELECT 1 FROM programmes p WHERE p.bilan_id = b.id)
    ), '[]'::jsonb),

    /* Vendus sur place, sans moyen de règlement enregistré. */
    'complements', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'centre_id', v.centre_id,
        'cliente',   cl.prenom || ' ' || cl.nom,
        'produit',   v.produit,
        'quantite',  v.quantite,
        'montant',   v.quantite * v.prix_unitaire,
        'date',      v.date_vente
      ) ORDER BY v.date_vente)
      FROM ventes_complements v
      JOIN clientes cl ON cl.id = v.cliente_id
      WHERE v.date_vente BETWEEN p_du AND p_au
    ), '[]'::jsonb),

    /* De quoi lire la caisse : une caisse vide sur une semaine pleine se voit. */
    'activite', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'centre_id', c.id,
        'seances', (
          SELECT count(*) FROM seances s
          WHERE s.centre_id = c.id AND s.date_seance BETWEEN p_du AND p_au
        ),
        'bilans', (
          SELECT count(*) FROM bilans b
          WHERE b.centre_id = c.id AND b.date_bilan BETWEEN p_du AND p_au
        ),
        'cures', (
          SELECT count(*) FROM programmes p
          WHERE p.centre_id = c.id AND p.date_validation BETWEEN p_du AND p_au
        ),
        'signe', (
          SELECT COALESCE(sum(p.montant_total), 0) FROM programmes p
          WHERE p.centre_id = c.id AND p.date_validation BETWEEN p_du AND p_au
        )
      ) ORDER BY c.nom)
      FROM centres c
    ), '[]'::jsonb)

  ) INTO resultat;

  RETURN resultat;
END;
$$;

REVOKE ALL ON FUNCTION ticket_z(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ticket_z(date, date) TO authenticated;
