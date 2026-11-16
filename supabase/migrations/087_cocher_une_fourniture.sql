/*
  MAbeautyplus V2 — Migration 087 : cocher une fourniture fonctionne.

  CE QUI NE MARCHAIT PAS. Cocher un produit rendait, à tous les coups :

      there is no unique or exclusion constraint matching
      the ON CONFLICT specification

  L'index qui empêche de cocher deux fois le même produit est PARTIEL — il
  ne couvre que les lignes du catalogue, pas les lignes libres :

      CREATE UNIQUE INDEX … ON lignes_de_courses (liste_id, fourniture_id)
        WHERE fourniture_id IS NOT NULL;

  Pour qu'un `ON CONFLICT` s'appuie sur un index partiel, PostgreSQL exige
  que la clause reprenne le MÊME filtre. Sans lui, il ne reconnaît aucun
  index candidat et refuse l'écriture entière. La migration 084 avait écrit
  `ON CONFLICT (liste_id, fourniture_id)` tout court : la liste de courses
  n'a jamais pu enregistrer une seule coche.

  Le banc d'essai ne voit pas ce défaut : il contrôle les règles métier en
  TypeScript, pas le SQL. C'est l'application réelle qui l'a montré.
*/

CREATE OR REPLACE FUNCTION cocher_la_fourniture(
  p_centre_id text, p_fourniture_id uuid, p_quantite integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_liste uuid := liste_ouverte(p_centre_id);
BEGIN
  IF p_quantite <= 0 THEN
    DELETE FROM lignes_de_courses
     WHERE liste_id = v_liste AND fourniture_id = p_fourniture_id;
    RETURN;
  END IF;

  INSERT INTO lignes_de_courses (liste_id, fourniture_id, quantite, demandee_par)
  VALUES (v_liste, p_fourniture_id, p_quantite, therapeute_courante())
  /* Le filtre répété : c'est lui qui désigne l'index partiel. */
  ON CONFLICT (liste_id, fourniture_id) WHERE fourniture_id IS NOT NULL
  DO UPDATE SET quantite = EXCLUDED.quantite, demandee_par = EXCLUDED.demandee_par;
END;
$$;
