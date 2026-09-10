/*
  MAbeautyplus V2 — Contrôle : plus aucune mensualité Alma n'est réclamée

  À relancer à volonté, il ne modifie rien.

  Chez Alma, l'organisme avance l'argent : le centre est payé le jour de la
  signature. Les mensualités regardent la cliente et Alma, jamais le centre.
  La migration 053 l'a écrit sur les cures déjà enregistrées ; ce contrôle
  dit si elle est bien passée, et si rien ne s'est glissé depuis.

  À LIRE :

    encore_dues   doit valoir 0. Toute autre valeur veut dire qu'une cure
                  Alma réclame encore de l'argent déjà reçu — l'écran du
                  matin appellera la cliente, et le tableau de bord sortira
                  cette somme du chiffre d'affaires encaissé. Repassez la
                  migration 053, elle est rejouable.

    cures_alma    le nombre de cures passées par Alma.
    montant_alma  ce qu'elles pèsent dans l'encaissé.
*/

SELECT
  COUNT(DISTINCT p.id)                                      AS cures_alma,
  COUNT(*) FILTER (WHERE e.statut IN ('a_venir','impaye'))  AS encore_dues,
  ROUND(SUM(e.montant) FILTER (WHERE e.statut = 'paye'), 2) AS montant_alma
FROM programmes p
JOIN echeances e ON e.programme_id = p.id
WHERE p.mode_reglement LIKE 'alma%'
  AND p.statut <> 'abandonne';
