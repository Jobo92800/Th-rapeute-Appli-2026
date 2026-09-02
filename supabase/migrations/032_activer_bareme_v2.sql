/*
  MAbeautyplus V2 — Migration 032 : le diagnostic version 2 devient le bilan

  L'écran sait désormais lire les nouvelles questions, appliquer les
  contre-indications, prescrire la cure et calculer l'échéancier. Le barème
  version 2 peut donc devenir celui du bilan.

  La version 1 n'est pas supprimée : les bilans déjà passés la référencent
  et doivent rester recalculables. Elle cesse simplement d'être proposée.

  Pour revenir en arrière, si quelque chose clochait en conditions réelles :

    UPDATE bareme_empreinte SET actif = false WHERE actif;
    UPDATE bareme_empreinte SET actif = true WHERE version = 1;
*/

UPDATE bareme_empreinte SET actif = false WHERE actif;
UPDATE bareme_empreinte SET actif = true  WHERE version = 2;
