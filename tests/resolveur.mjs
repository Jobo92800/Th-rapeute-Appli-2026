/*
  Node veut l'extension dans les imports, Vite s'en passe. Plutôt que
  d'écrire « ./bioportrait.ts » partout dans le code de l'application pour
  faire plaisir au banc d'essai, on complète la résolution ici — ce hook ne
  sert qu'aux tests et ne change rien à ce qui est livré.
*/

const EXTENSIONS = ['.ts', '.tsx', '/index.ts'];

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (erreur) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      for (const ext of EXTENSIONS) {
        try {
          return await next(specifier + ext, context);
        } catch {
          // on essaie l'extension suivante
        }
      }
    }
    throw erreur;
  }
}
