/*
  MAbeautyplus V2 — Migration 078 : Cabestany devient Pollestres

  Le centre a déménagé, du 4 Rue Ambroise Croizat à Cabestany au
  16 Rue Alfred Sauvy à Pollestres (Jonathan, 14 octobre 2026). C'est le
  même centre : les mêmes thérapeutes, les mêmes clientes, la même société
  MB4PRO, les mêmes cures en cours. Seuls le nom et l'adresse changent.

  CE QUI CHANGE, ET RIEN D'AUTRE.

  `nom`, pour tous les écrans — le sélecteur de centre, la colonne Centre de
  la liste des clientes, l'en-tête des documents. `adresse`, `code_postal`
  et `ville`, parce qu'ils s'impriment sur le contrat de prestation : à
  l'article qui identifie le prestataire, et au bas de page, « Fait à … ».
  Un contrat qui annonce une adresse où le centre n'est plus est un contrat
  faux.

  L'ORTHOGRAPHE EST CELLE DE LA COMMUNE : « Pollestres », avec un S
  (66450). Ces lignes partent sur un document qui engage les deux parties ;
  le nom officiel y a sa place.

  CE QUI NE CHANGE PAS, ET POURQUOI.

    — `id` reste `cabestany`. C'est la clé technique : elle est inscrite sur
      chaque fiche cliente, chaque cure, chaque séance, chaque contrat,
      chaque mouvement de stock et chaque compte de thérapeute. La renommer
      demanderait de réécrire dix tables en même temps, pour un mot que
      personne ne lit. Même parti pris que `bareme_empreinte`, la table
      `jeux` et la famille `anti_age` : LE NOM VISIBLE CHANGE, LE NOM
      TECHNIQUE RESTE. Le code continue donc de dire `'cabestany'`, et
      `soinsAntiAgeDuCentre('cabestany')` répond toujours « pas d'anti-âge
      ici ».

    — `nom_airtable` reste « Cabestany » (choix de Jonathan, 14 octobre
      2026). C'est la valeur exacte que la synchro écrit dans la colonne
      Centre du CRM, et c'est aussi celle que lisent ses vues filtrées et
      ses automatisations. L'application affiche le nouveau nom, le CRM
      garde l'ancien, et rien ne cesse de trouver ce centre. Le jour où les
      vues seront reprises, une seule ligne suffira :
      `UPDATE centres SET nom_airtable = 'Pollestres' WHERE id = 'cabestany';`

    — `societe` (MB4PRO) et le siège social, au Grau-du-Roi.

    — LES CONTRATS DÉJÀ SIGNÉS. Leur PDF porte l'adresse du jour de la
      signature, et c'est juste : il dit où le centre était et où la cliente
      a signé. Un document signé ne se réécrit pas.

    — LE NUMÉRO DE SIRET, « 938 742 541 00015 ». Un SIRET identifie un
      établissement, pas une société : la question se posait donc. Vérifiée
      au registre le 14 octobre 2026, elle est tranchée — ce numéro est
      celui du SIÈGE SOCIAL de MB4PRO, au 577 Rue des Tamaris au
      Grau-du-Roi, et le siège ne déménage pas. La boutique, elle, est un
      second établissement, « 938 742 541 00023 », que le contrat ne cite
      pas. Rien à changer ici, et rien à rouvrir : si un jour c'était le
      numéro de la boutique qu'il fallait imprimer, c'est le champ `siren`
      de cette ligne qui le porterait.

  Sans danger, rejouable autant de fois que nécessaire.
*/

BEGIN;

UPDATE centres
   SET nom         = 'Pollestres',
       adresse     = '16 Rue Alfred Sauvy',
       code_postal = '66450',
       ville       = 'Pollestres'
 WHERE id = 'cabestany';

COMMIT;

-- Contrôle : une ligne, le nouveau nom et la nouvelle adresse, le nom
-- Airtable resté à « Cabestany ».
SELECT id, nom, ville, code_postal, adresse, societe, siren, nom_airtable
  FROM centres
 WHERE id = 'cabestany';
