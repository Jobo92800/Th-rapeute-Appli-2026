/*
  MAbeautyplus V2 — Migration 072 : ce que la cliente ressent, à part

  Sur la radiofréquence du Profil Signature, la séance porte deux cases au
  lieu d'une (Jonathan, 23 septembre 2026) :

    — COMMENTAIRE : ce que la thérapeute observe. La chaleur supportée, les
      zones passées, la réaction de la peau.
    — RESSENTI : ce que la cliente dit. Si ça a tiré, chauffé, ce qu'elle a
      vu depuis la dernière fois.

  Mélangés dans une seule case, le second disparaît : c'est toujours la
  technique qu'on écrit en premier, et le ressenti tient dans les mots de
  la cliente — c'est justement ce qu'on veut relire à la séance suivante.

  Les autres soins gardent leur case unique : l'I-Shape et la presso ont
  déjà « Programme utilisé » à côté du commentaire (064), et la luxo n'a
  jamais demandé cette séparation.

  Rejouable sans risque.
*/

ALTER TABLE seances
  ADD COLUMN IF NOT EXISTS ressenti text;

COMMENT ON COLUMN seances.ressenti IS
  'Ce que la cliente dit de la séance, dans ses mots. Séparé du commentaire de la thérapeute sur les soins qui le demandent (radiofréquence).';

-- Contrôle : la colonne existe.
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_name = 'seances' AND column_name = 'ressenti'
) AS colonne_ressenti;
