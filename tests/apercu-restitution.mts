/*
  Fabrique une restitution d'exemple, pour la regarder.

      node --experimental-strip-types --import ./tests/resolveur.mjs \
           tests/apercu-restitution.mts /chemin/sortie.pdf [3|4]

  « Avant de livrer un écran, le regarder » vaut aussi pour un document : il
  part chez la cliente, et personne ne le relit après nous. Ce script le
  produit hors application, avec des données plausibles, pour qu'on puisse
  l'ouvrir avant de livrer.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { baremeLivre } from './prescription.mts';
import type { Bareme, Reponses } from '../src/domain/bioportrait.ts';
import { calculerBioPortrait } from '../src/domain/bioportrait.ts';
import { construireRestitution } from '../src/domain/recapitulatif.ts';
import { genererRestitutionPdf } from '../src/services/restitutionPdf.ts';

function baremeComplet(): Bareme {
  const bareme = baremeLivre();
  const c = JSON.parse(readFileSync('supabase/contenu/restitution-bioportrait.json', 'utf8'));
  for (const [code, champs] of Object.entries(c.AXES)) {
    Object.assign(bareme.AX[code as keyof typeof bareme.AX], champs as object);
  }
  for (const etape of bareme.STEPS) {
    const lu = etape.t ? c.LECTURE[etape.t] : undefined;
    if (lu) etape.lecture = lu.map(([s, n, a, t]: [string, number, boolean, string]) => ({ s, n, a, t }));
  }
  bareme.RESTITUTION = c.RESTITUTION;
  return bareme;
}

const bareme = baremeComplet();

/*
  Une cliente plausible : elle grignote le soir, elle est fatiguée, son
  transit la gêne, et son InBody montre une masse musculaire basse.
*/
const reponses: Reponses = {};
bareme.STEPS.forEach((e, i) => {
  if (e.phase === 'client' && e.o) reponses[i] = e.type === 'multi' ? [e.o.length - 1] : Math.min(2, e.o.length - 1);
});
const analyse = bareme.STEPS.map((e, i) => (e.phase === 'analyse' ? i : -1)).filter((i) => i >= 0);
[2, 1, 1, 1, 1].forEach((choix, k) => {
  if (analyse[k] != null) reponses[analyse[k]] = choix;
});

const bp = calculerBioPortrait(bareme, reponses);

const donnees = construireRestitution({
  bareme,
  bioportrait: bp,
  reponses,
  proposition: {
    lignes: [
      { technologie: 'luxo', seances: 20, prixUnitaire: 59 },
      { technologie: 'ishape', seances: 12, prixUnitaire: 59 },
      { technologie: 'presso', seances: 12, prixUnitaire: 59 },
    ],
    electro: true,
    guide: true,
    tenue: true,
    complements: [],
    montantTotal: 2655,
    bilanDejaRegle: 0,
    modeReglement: 'centre_4x',
    frais: 0,
    echeances: [
      { rang: 1, montant: 753, type: 'echeance' },
      { rang: 2, montant: 634, type: 'echeance' },
      { rang: 3, montant: 634, type: 'echeance' },
      { rang: 4, montant: 634, type: 'echeance' },
    ],
    prixGuide: 29,
    prixTenue: 60,
  } as never,
  cliente: { civilite: 'Mme', prenom: 'Claire', nom: 'MARTIN' },
  centre: {
    nom: 'Le Crès',
    adresse: '1 Avenue des Chasseurs',
    codePostal: '34920',
    ville: 'Le Crès',
    telephone: '04 66 73 02 00',
    email: 'contact@mabeautyplus.fr',
  },
  dateBilan: '2 octobre 2026',
  prixBilan: 129,
  pages: (Number(process.argv[3]) === 3 ? 3 : 4) as 3 | 4,
});

const pdf = genererRestitutionPdf(donnees);
const octets = pdf.output('arraybuffer');
const sortie = process.argv[2] ?? 'restitution.pdf';
writeFileSync(sortie, Buffer.from(octets));

console.log(`${sortie} — ${donnees.pages} pages`);
console.log(`  profil ${donnees.profil.nom} × terrain ${donnees.terrain.nom}`);
console.log(`  ${donnees.composition.length} mesures, ${donnees.correspondances.length} correspondances, ${donnees.soins.length} soins`);
