/*
  Lanceur de l'aperçu, comme `tests/lancer.mjs` pour le banc d'essai : il
  enregistre le résolveur avant d'importer le script, sans quoi Node exige
  l'extension dans chaque import de l'application.

      node --experimental-strip-types tests/apercu.mjs sortie.pdf [3|4]
*/
import { register } from 'node:module';
register('./resolveur.mjs', import.meta.url);
await import('./apercu-restitution.mts');
