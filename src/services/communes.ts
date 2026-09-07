/*
  La ville d'après le code postal.

  L'État publie ça gratuitement et sans clé : `geo.api.gouv.fr`, adossé au
  Code officiel géographique. On n'envoie que cinq chiffres — pas un nom, pas
  une adresse — et on reçoit les communes qui les portent.

  Un code postal ne désigne pas toujours une commune : 34980 en couvre cinq.
  On rend donc la liste, et c'est l'écran qui décide — remplir tout seul
  quand il n'y a pas d'ambiguïté, proposer quand il y en a.

  Rien ici n'est bloquant. Si l'API ne répond pas, la liste revient vide et
  la ville se tape à la main, comme avant.
*/

const CACHE = new Map<string, string[]>();

/** Cinq chiffres, rien d'autre. */
export function codePostalComplet(cp: string): boolean {
  return /^\d{5}$/.test(cp.trim());
}

export async function communesDuCodePostal(cp: string, signal?: AbortSignal): Promise<string[]> {
  const cle = cp.trim();
  if (!codePostalComplet(cle)) return [];

  const connu = CACHE.get(cle);
  if (connu) return connu;

  try {
    const r = await fetch(
      `https://geo.api.gouv.fr/communes?codePostal=${cle}&fields=nom&format=json`,
      { signal },
    );
    if (!r.ok) return [];

    const brut = (await r.json()) as Array<{ nom?: string }>;
    const noms = brut
      .map((c) => c.nom)
      .filter((n): n is string => typeof n === 'string' && n.length > 0)
      .sort((a, b) => a.localeCompare(b, 'fr'));

    CACHE.set(cle, noms);
    return noms;
  } catch {
    // Réseau coupé, requête annulée, API en panne : on ne dit rien et on
    // laisse la thérapeute écrire. Une aide qui proteste n'aide plus.
    return [];
  }
}
