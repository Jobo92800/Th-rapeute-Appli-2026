/*
  MAbeautyplus V2 — Migration 047 : les cosmétiques KOS sortent des écrans

  Ils étaient au stock depuis la 016, tenus au Grau-du-Roi seulement. Un
  seul centre sur cinq, et aucun écran ne les vend — la vente se notait en
  sortie manuelle. Ils encombraient un rayon que quatre centres n'ont pas.

  ON LES DÉSACTIVE, ON NE LES SUPPRIME PAS.

  `actif = false` suffit : la vue `etat_stock` se termine par `WHERE p.actif`,
  et la liste des produits filtre pareil. Les sept lignes disparaissent donc
  du rayon, de l'alerte de recommande et du récapitulatif des cinq centres,
  sans qu'aucun écran ne change.

  Les supprimer, en revanche, emporterait les mouvements déjà saisis au
  Grau-du-Roi — des réceptions et des ventes réelles, qui sont l'historique
  du centre. Rien ne justifie de les perdre pour un affichage.

  POUR LES REMETTRE, le jour où le Grau-du-Roi les vend depuis l'application :

      UPDATE produits_stock SET actif = true WHERE categorie = 'cosmetique';

  La section « Cosmétiques » de l'écran Stock n'a pas été retirée du code :
  elle ne s'affiche que si elle a des produits, et elle reviendra seule.
*/

UPDATE produits_stock
   SET actif = false
 WHERE categorie = 'cosmetique'
   AND actif;

-- Contrôle : doit renvoyer 0.
SELECT COUNT(*) AS cosmetiques_encore_visibles
  FROM produits_stock
 WHERE categorie = 'cosmetique' AND actif;
