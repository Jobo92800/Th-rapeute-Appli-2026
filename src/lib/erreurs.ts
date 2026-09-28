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

/**
 * Le message d'une fonction Edge qui a refusé.
 *
 * `supabase.functions.invoke` ne rend PAS le corps de la réponse quand le
 * statut n'est pas 2xx : `data` vaut null, et `error` est un
 * `FunctionsHttpError` dont le message se réduit à « Edge Function returned
 * a non-2xx status code ». Toutes nos fonctions répondent pourtant
 * `{ error: "…" }` en disant précisément ce qui manque — « Cette cliente
 * n'a pas d'adresse email », « Mon Parcours a refusé » — et ce message
 * était jeté : la thérapeute lisait « l'accès n'a pas pu être créé » sans
 * jamais savoir pourquoi, et nous non plus (Jonathan, 28 septembre 2026).
 *
 * La réponse est accessible sur `error.context`. On la relit ici, une fois,
 * pour retrouver la phrase que la fonction avait écrite.
 */
export async function messageDeLaFonction(erreur: unknown, defaut: string): Promise<string> {
  const contexte = (erreur as { context?: unknown } | null)?.context;

  if (contexte && typeof (contexte as Response).json === 'function') {
    try {
      const corps = await (contexte as Response).clone().json();
      const dit = texteErreur(corps);
      if (dit && dit !== 'Erreur inconnue.') return dit;
    } catch {
      /* Pas de JSON : on retombe sur le message de l'erreur elle-même. */
    }
  }

  const brut = texteErreur(erreur);
  return brut && !/non-2xx status code/i.test(brut) ? brut : defaut;
}
