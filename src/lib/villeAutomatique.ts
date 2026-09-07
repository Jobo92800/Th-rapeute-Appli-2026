import { useEffect, useRef, useState } from 'react';
import { codePostalComplet, communesDuCodePostal } from '../services/communes';

/**
 * Remplit la ville quand le code postal ne laisse aucun doute, propose
 * quand il en laisse.
 *
 * Deux précautions. On n'écrase **jamais** ce qui a été tapé à la main :
 * seule une ville vide, ou une ville que ce hook a lui-même écrite, peut
 * être remplacée. Et on attend un instant après la dernière frappe, sinon
 * « 34000 » déclenche cinq appels au lieu d'un.
 */
export function useVilleAutomatique(
  codePostal: string,
  ville: string,
  definirVille: (v: string) => void,
) {
  const [propositions, setPropositions] = useState<string[]>([]);
  /** Ce que le hook a écrit lui-même : lui seul a le droit de le reprendre. */
  const ecriteIci = useRef<string | null>(null);

  useEffect(() => {
    if (!codePostalComplet(codePostal)) {
      setPropositions([]);
      return;
    }

    const arret = new AbortController();
    const minuterie = setTimeout(async () => {
      const communes = await communesDuCodePostal(codePostal, arret.signal);
      if (arret.signal.aborted) return;

      setPropositions(communes.length > 1 ? communes : []);

      // Seule une ville vide, ou écrite par ce hook, peut être touchée.
      const libre = ville.trim().length === 0 || ville === ecriteIci.current;

      if (communes.length === 1) {
        if (libre && ville !== communes[0]) {
          ecriteIci.current = communes[0];
          definirVille(communes[0]);
        }
        return;
      }

      /*
        Plusieurs communes : on ne choisit pas. Mais on efface ce qu'on avait
        écrit soi-même si ça ne va plus avec le nouveau code postal — sinon
        corriger « 30240 » en « 34980 » laissait « Le Grau-du-Roi » en face,
        et la fiche partait avec une ville qui n'existe pas à ce code.
      */
      if (libre && ville.trim().length > 0 && !communes.includes(ville)) {
        ecriteIci.current = '';
        definirVille('');
      }
    }, 350);

    return () => {
      clearTimeout(minuterie);
      arret.abort();
    };
    // `ville` et `definirVille` sont volontairement hors des dépendances :
    // ce hook réagit au code postal, pas à ce qu'on tape dans la ville.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codePostal]);

  /** À appeler quand la thérapeute choisit dans la liste proposée. */
  function choisir(nom: string) {
    ecriteIci.current = nom;
    definirVille(nom);
    setPropositions([]);
  }

  return { propositions, choisir };
}
