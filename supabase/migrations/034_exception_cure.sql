/*
  MAbeautyplus V2 — Migration 034 : l'exception de cure

  Une pathologie, une contre-indication, une consigne qui change la façon de
  travailler avec cette personne. Ce n'est pas une note : une note se lit
  quand on pense à ouvrir l'onglet. Une exception doit être vue sans avoir
  été cherchée, par n'importe quelle thérapeute, avant la séance.

  Elle vit donc sur la fiche elle-même, pas dans le fil des notes, et
  s'affiche en rouge partout où la cliente apparaît.

  Un seul texte par fiche, et non un historique : ce qui compte est l'état
  actuel. Une consigne périmée qui traîne au milieu d'un fil est pire que
  pas de consigne du tout.
*/

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS exception_cure text NOT NULL DEFAULT '';

COMMENT ON COLUMN clientes.exception_cure IS
  'Pathologie ou consigne impérative, affichée en rouge sur la fiche et dans la liste. Vide = rien à signaler.';

CREATE INDEX IF NOT EXISTS clientes_exception_idx
  ON clientes (centre_id) WHERE exception_cure <> '';
