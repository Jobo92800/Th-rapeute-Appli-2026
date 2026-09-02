/*
  Un harnais minuscule : de quoi écrire des contrôles lisibles, sans
  installer de bibliothèque de test. Le projet n'embarque aucune dépendance
  pour ça — Node exécute le TypeScript directement.
*/

let reussis = 0;
const echecs: string[] = [];
let sectionCourante = '';

export function section(titre: string) {
  sectionCourante = titre;
  console.log(`\n  ${titre}`);
}

export function verifie(titre: string, condition: boolean, detail = '') {
  if (condition) {
    reussis++;
    console.log(`    ✓ ${titre}`);
  } else {
    echecs.push(`${sectionCourante} — ${titre}${detail ? ` (${detail})` : ''}`);
    console.log(`    ✗ ${titre}${detail ? ` — ${detail}` : ''}`);
  }
}

export function egal(titre: string, obtenu: unknown, attendu: unknown) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  verifie(titre, a === b, a === b ? '' : `obtenu ${a}, attendu ${b}`);
}

/** Comparaison à l'euro près, pour les calculs qui passent par des flottants. */
export function egalEuros(titre: string, obtenu: number, attendu: number, tolerance = 0.001) {
  const ecart = Math.abs(obtenu - attendu);
  verifie(titre, ecart <= tolerance, ecart <= tolerance ? '' : `obtenu ${obtenu}, attendu ${attendu}`);
}

export function bilan(): number {
  console.log(`\n${'─'.repeat(64)}`);

  if (echecs.length === 0) {
    console.log(`  ${reussis} contrôles, tout est vert.\n`);
    return 0;
  }

  console.log(`  ${reussis} contrôles réussis, ${echecs.length} en échec :\n`);
  for (const e of echecs) console.log(`   ✗ ${e}`);
  console.log('');
  return 1;
}
