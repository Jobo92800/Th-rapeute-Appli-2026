/*
  MAbeautyplus V2 — Migration 049 : le bilan réglé en ligne

  CE QUE C'EST.

  Certaines clientes règlent leur bilan en prenant rendez-vous, sur Planity.
  Quand elles arrivent, les 129 € sont déjà encaissés — ailleurs, avant
  qu'on les voie.

  À NE PAS CONFONDRE AVEC L'ACOMPTE, même s'ils se ressemblent sur
  l'échéancier. L'acompte répartit SA cure : elle dit oui mais ne peut pas
  tout donner aujourd'hui, le total ne bouge pas et le reste suivra. Ici,
  rien n'est réparti : de l'argent est déjà entré, et il vient en déduction
  de ce qu'elle doit encore au centre.

  CE QUI NE CHANGE PAS : le prix de la cure. Elle vaut ce qu'elle vaut, ces
  129 € en font partie, et c'est ce montant qui part dans « Montant Cure ».
  Ce qui change, c'est le partage entre ce qui est encaissé et ce qui reste
  dû.

  L'échéance porte donc le type `bilan`, naît avec le statut `paye`, et ne
  se réclame jamais : ni sur l'écran du matin, ni dans les relances.
*/

ALTER TABLE echeances DROP CONSTRAINT IF EXISTS echeances_type_check;

ALTER TABLE echeances
  ADD CONSTRAINT echeances_type_check
  CHECK (type IN ('acompte', 'echeance', 'bilan'));

COMMENT ON COLUMN echeances.type IS
  'echeance : une ligne du règlement. acompte : le premier versement d''une '
  'cliente qui ne peut pas tout régler. bilan : les 129 € déjà encaissés en '
  'ligne à la prise de rendez-vous — déjà payés, jamais réclamés.';

-- Contrôle : doit renvoyer la contrainte avec les trois valeurs.
SELECT pg_get_constraintdef(oid) AS contrainte
  FROM pg_constraint
 WHERE conrelid = 'echeances'::regclass AND conname = 'echeances_type_check';
