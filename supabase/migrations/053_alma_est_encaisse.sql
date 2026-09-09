/*
  MAbeautyplus V2 — Migration 053 : une cure Alma est encaissée à la signature

  CE QU'ON CORRIGE.

  Chez Alma, c'est l'organisme qui avance l'argent et qui porte le risque :
  le centre est payé le jour de la signature. Les mensualités qui suivent
  regardent la cliente et Alma, jamais le centre.

  L'application les écrivait pourtant « à venir », comme des chèques. Trois
  conséquences, toutes fausses, et toutes silencieuses :

    — l'écran du matin réclamait chaque mois un argent déjà reçu, et une
      thérapeute pouvait appeler une cliente pour lui demander 173,47 € que
      le centre avait encaissés depuis longtemps ;

    — « Reste à encaisser » annonçait le montant entier de la cure, sur la
      fiche comme dans Airtable, donc dans les relances du CRM ;

    — le tableau de bord ne compte dans l'encaissé que ce qui est `paye` :
      tout ce qui est passé par Alma en sortait. Le chiffre d'affaires
      encaissé était sous-évalué d'autant.

  CE QUI NE CHANGE PAS : les échéances restent en base, avec leurs dates et
  leurs montants. Le contrat les annonce à la cliente, et c'est bien ce
  qu'elle va payer — mais à Alma, pas au centre.

  CE QUE ÇA DÉPLACE DANS VOS CHIFFRES : l'encaissé remonte, à la date de
  validation de chaque cure Alma. Ce n'est pas de l'argent nouveau, c'est de
  l'argent qui était déjà là et que l'application ne voyait pas.

  Ce script ne touche qu'aux échéances **encore dues** d'une cure Alma. Une
  échéance déjà pointée à la main garde sa date de règlement.
*/

UPDATE echeances e
   SET statut         = 'paye',
       moyen          = 'alma',
       date_reglement = COALESCE(
         p.date_validation,
         (p.cree_le AT TIME ZONE 'Europe/Paris')::date
       ),
       note = COALESCE(NULLIF(e.note, ''), 'Avancé par Alma à la signature')
  FROM programmes p
 WHERE p.id = e.programme_id
   AND p.mode_reglement LIKE 'alma%'
   AND p.statut <> 'abandonne'
   AND e.statut IN ('a_venir', 'impaye');

/*
  Contrôle. `encore_dues` doit valoir 0 : plus aucune mensualité Alma n'est
  réclamée. `cures_alma` et `montant_alma` disent ce qui vient de rejoindre
  l'encaissé — à comparer avec ce que vous savez avoir reçu.
*/
SELECT
  COUNT(DISTINCT p.id)                                    AS cures_alma,
  COUNT(*) FILTER (WHERE e.statut IN ('a_venir','impaye')) AS encore_dues,
  ROUND(SUM(e.montant) FILTER (WHERE e.statut = 'paye'), 2) AS montant_alma
FROM programmes p
JOIN echeances e ON e.programme_id = p.id
WHERE p.mode_reglement LIKE 'alma%'
  AND p.statut <> 'abandonne';
