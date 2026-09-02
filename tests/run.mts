/*
  Banc d'essai des règles métier de MAbeautyplus V2.

      npm test

  Ce qui est vérifié ici décide de ce qu'une cliente paie, de ce qu'elle
  reçoit et de ce qu'on lui interdit pour raison de santé. Aucun de ces
  calculs ne doit changer par accident.

  Aucune bibliothèque de test n'est installée : Node exécute le TypeScript
  directement, et le harnais tient en quarante lignes.
*/

import { bilan } from './harnais.mts';
import { controlerTarification } from './tarification.mts';
import { controlerPrescription } from './prescription.mts';
import { controlerMetier } from './metier.mts';

console.log('\n  MAbeautyplus V2 — contrôle des règles métier');

controlerTarification();
controlerPrescription();
controlerMetier();

process.exit(bilan());
