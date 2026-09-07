/*
  Dire ce qui ne va pas.

  `String(e)` sur une erreur Supabase donne « [object Object] » : ni Postgrest
  ni les fonctions Edge ne rendent des `Error`, ils rendent des objets avec
  un `message`. L'écran affichait donc, en toutes lettres, le mot qui
  n'apprend rien à personne — alors même que la règle de la maison est que
  l'erreur montre son message brut, parce que c'est lui qui nomme la cause.

  Cette fonction sait lire les deux, et remonte `details` et `hint` quand
  PostgreSQL les fournit : « function etat_des_comptes() does not exist »
  n'a de valeur que complet.
*/
export function texteErreur(e: unknown): string {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;

  if (typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown; error?: unknown };
    const morceaux = [o.message, o.details, o.hint]
      .filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
    if (morceaux.length > 0) return [...new Set(morceaux)].join(' — ');
    if (typeof o.error === 'string') return o.error;

    try {
      const j = JSON.stringify(e);
      if (j && j !== '{}') return j;
    } catch {
      /* une erreur circulaire : on retombe sur le message générique */
    }
  }

  return 'Erreur inconnue.';
}

/**
 * Le cas particulier qui se produit vraiment : l'application a été
 * redéployée pendant qu'une thérapeute avait sa page ouverte, et un morceau
 * chargé à la demande n'existe plus sous ce nom. Recharger suffit.
 */
export function estUnePageDepassee(e: unknown): boolean {
  return /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
    texteErreur(e),
  );
}
