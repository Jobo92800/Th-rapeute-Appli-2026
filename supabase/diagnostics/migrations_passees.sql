/*
  MAbeautyplus V2 — Quelles migrations sont réellement passées ?

  Les migrations SQL ne passent pas par GitHub : elles se collent à la main
  dans l'éditeur, et rien ne garde la liste de ce qui a été joué. Au bout
  de quelques semaines, « je crois les avoir faites » devient la seule
  réponse possible — et une migration oubliée ne se voit qu'au moment où
  un écran tombe devant une cliente.

  Ce diagnostic ne modifie rien et se relance à volonté. Il cherche, pour
  chaque migration, L'OBJET QU'ELLE A LAISSÉ DERRIÈRE ELLE : une colonne,
  une commande, une contrainte, un tarif, un mot dans un barème. Il ne dit
  donc pas « la 067 a été jouée » mais « le Dôme est bien à 49 € », ce qui
  est la seule chose qui compte.

  À coller dans l'éditeur SQL de Supabase, projet MAbeautyplus V2.
*/

WITH controles(numero, objet, present) AS (
  VALUES
    ('054', 'Les frais Alma hors du chiffre d''affaires — commande part_centre',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'part_centre')),

    ('057', '« Envoyer au CRM » repose cures et bilans — commande renvoyer_au_crm',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'renvoyer_au_crm')),

    ('059', 'Le Dôme au Grau-du-Roi — tarif du 13 septembre',
     EXISTS (SELECT 1 FROM tarifs WHERE code = 'dome' AND effet_le = DATE '2026-09-13')),

    ('060', 'Supprimer une cure — commandes supprimer_cure et contenu_cure',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'supprimer_cure')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'contenu_cure')),

    ('061', 'Les réponses InBody annotées — « dans la zone gris foncé »',
     EXISTS (SELECT 1 FROM bareme_empreinte
             WHERE version = 3 AND contenu::text LIKE '%dans la zone gris foncé%')),

    ('062', 'Cinq chèques à partir de vingt luxo — mode centre_5x accepté',
     EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'programmes_mode_reglement_check'
               AND pg_get_constraintdef(oid) LIKE '%centre_5x%')),

    ('063', 'La taille de la combi I-Shape — colonne clientes.taille_combi_ishape',
     EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'clientes' AND column_name = 'taille_combi_ishape')),

    ('064', 'Le programme de l''appareil — colonne seances.programme_utilise',
     EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'seances' AND column_name = 'programme_utilise')),

    ('065', 'L''éventration — réponse posée et bilans déplacés',
     EXISTS (SELECT 1 FROM bareme_empreinte
             WHERE version = 3 AND contenu::text LIKE '%Éventration%')
     AND EXISTS (SELECT 1 FROM migrations_faites WHERE nom = '065_eventration')),

    ('066', 'Effacer les fiches de test — commande lister_les_fiches_de_test',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'lister_les_fiches_de_test')),

    ('067', 'Le Dôme à 49 € — tarif du 16 septembre',
     EXISTS (SELECT 1 FROM tarifs
             WHERE code = 'dome' AND effet_le = DATE '2026-09-16' AND montant = 49)),

    ('068', 'Le redécoupage après un chèque encaissé — les nouveaux rangs suivent le plus haut',
     EXISTS (SELECT 1 FROM pg_proc
             WHERE proname = 'reechelonner_les_echeances'
               AND pg_get_functiondef(oid) LIKE '%max(%rang%')),

    ('069', 'Les compléments choisis avec la cure — colonne comprise_dans_la_cure',
     EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'ventes_complements' AND column_name = 'comprise_dans_la_cure')),

    ('070', 'La Mission Déclic sur la luxo seulement — contrainte assouplie',
     EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'cloture_exige_le_jeu'
               AND pg_get_constraintdef(oid) LIKE '%luxo%')),

    ('071', 'Le Bilan Profil Signature — barème, famille et tarifs',
     EXISTS (SELECT 1 FROM bareme_signature WHERE actif)
     AND EXISTS (SELECT 1 FROM tarifs WHERE code = 'radiofrequence')
     AND EXISTS (SELECT 1 FROM tarifs WHERE code = 'bilan_signature')),

    ('072', 'Ce qu''elle ressent — colonne seances.ressenti',
     EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'seances' AND column_name = 'ressenti')),

    ('073', 'Le Profil Signature au Grau-du-Roi — la mention du barème anti-âge',
     EXISTS (SELECT 1 FROM bareme_anti_age WHERE contenu->>'MENTION' LIKE '%Profil Signature%')),

    ('074', 'Le transit irrégulier — réponse posée et bilans déplacés',
     EXISTS (SELECT 1 FROM bareme_empreinte
             WHERE version = 3 AND contenu::text LIKE '%Irrégulier%')
     AND EXISTS (SELECT 1 FROM migrations_faites WHERE nom = '074_transit_irregulier')),

    ('075', 'Le délai d''un mois seulement si peeling, laser ou injection',
     EXISTS (SELECT 1 FROM bareme_signature b,
                  jsonb_array_elements(b.contenu->'QUESTIONS') AS t(q)
             WHERE b.version = 1
               AND q->>'code' = 'q10c'
               AND q->'si'->>'code' = 'q10b'))
)
SELECT
  numero,
  CASE WHEN present THEN 'OK' ELSE '>>> À PASSER' END AS etat,
  objet
FROM controles
ORDER BY numero;
