/*
  Le Bio-Portrait Anti-Âge : ce que le questionnaire dit d'une peau, sur le
  barème réellement livré (extrait de la migration 056).
*/

import { readFileSync } from 'node:fs';
import { section, verifie, egal, egalEuros } from './harnais.mts';
import { construireEcheancierCure } from '../src/domain/tarification.ts';
import { reechelonner } from '../src/domain/reglement.ts';
import type { Echeance } from '../src/types/db.ts';
import { construireRecapAntiAge } from '../src/domain/recapitulatif.ts';
import {
  calculerAntiAge,
  questionsAPoser,
  relireLesReponsesAntiAge,
  nomDuTerrain,
  type BaremeAntiAge,
  type ReponsesAntiAge,
} from '../src/domain/antiAge.ts';

export function baremeAntiAgeLivre(): BaremeAntiAge {
  const sql = readFileSync('supabase/migrations/056_bioportrait_anti_age.sql', 'utf8');
  const debut = sql.indexOf("(1, '") + "(1, '".length;
  const fin = sql.indexOf("'::jsonb", debut);
  return JSON.parse(sql.slice(debut, fin).replaceAll("''", "'")) as BaremeAntiAge;
}

/** Répond par le libellé, pour que les contrôles se lisent. */
function repondre(bareme: BaremeAntiAge, choix: Record<string, string | string[]>): ReponsesAntiAge {
  const r: ReponsesAntiAge = {};
  for (const [code, libelles] of Object.entries(choix)) {
    const q = bareme.QUESTIONS.find((x) => x.code === code)!;
    const idx = (Array.isArray(libelles) ? libelles : [libelles]).map((l) => {
      const i = q.o.findIndex((o) => o[0] === l);
      if (i < 0) throw new Error(`${code} : option « ${l} » introuvable`);
      return i;
    });
    r[code] = q.type === 'multi' ? idx : idx[0];
  }
  return r;
}

export function controlerAntiAge() {
  const bareme = baremeAntiAgeLivre();

  section('Le barème anti-âge livré en base');

  egal('quatorze questions, plus la sous-question des soins déjà faits', bareme.QUESTIONS.length, 15);
  egal('quatre profils', Object.keys(bareme.PROFILS).length, 4);
  egal('quatre terrains', Object.keys(bareme.TERRAINS).length, 4);
  verifie('chaque profil porte son texte cliente', Object.values(bareme.PROFILS).every((p) => p.texte.length > 40));
  verifie('chaque terrain porte le sien', Object.values(bareme.TERRAINS).every((t) => t.texte.length > 40));
  verifie('la mention légale est là', bareme.MENTION.includes('diagnostic médical'));

  /* Les points du document, question par question, vérifiés au hasard. */
  const q1 = bareme.QUESTIONS.find((q) => q.code === 'Q1')!;
  egal('Q1 « rides / ridules » : Rides +3, Hydratation +1, Densité +1',
    q1.o.find((o) => o[0] === 'Les rides / ridules')![1], { rides: 3, hydratation: 1, densite: 1 });
  const q7 = bareme.QUESTIONS.find((q) => q.code === 'Q7')!;
  egal('Q7 « fine / froissée » : Rides +1, Hydratation +2, Densité +2',
    q7.o.find((o) => o[0] === 'Fine / froissée / irrégulière')![1], { rides: 1, hydratation: 2, densite: 2 });
  const q13 = bareme.QUESTIONS.find((q) => q.code === 'Q13')!;
  egal('Q13 « très fine » : terrain Fin +3', q13.o[3][2], { fin: 3 });

  section('La sous-question ne se pose qu’après un oui');

  const sansOui = questionsAPoser(bareme, repondre(bareme, { Q10: 'Non' }));
  verifie('« Lesquels ? » n’apparaît pas après un non', !sansOui.some((q) => q.code === 'Q10b'));
  const avecOui = questionsAPoser(bareme, repondre(bareme, { Q10: 'Oui' }));
  verifie('et apparaît après un oui', avecOui.some((q) => q.code === 'Q10b'));
  egal('quatorze questions posées à qui n’a rien fait avant', sansOui.length, 14);

  section('L’attribution du profil');

  const fermete = calculerAntiAge(bareme, repondre(bareme, {
    Q1: 'Le relâchement cutané', Q3: 'Très relâchée', Q6: 'Nettement relâché', Q8: 'Raffermir et lisser ma peau',
  }));
  egal('relâchement partout : Fermeté & Ovale', fermete.profil, 'fermete_ovale');
  egal('la fermeté en tête des priorités', fermete.priorites[0], 'fermete');

  const hydratation = calculerAntiAge(bareme, repondre(bareme, {
    Q1: 'Le manque d’hydratation', Q4: 'Très déshydratée', Q7: 'Terne / fatiguée', Q8: 'Améliorer visiblement ma qualité de peau',
  }));
  egal('déshydratation partout : Hydratation & Qualité', hydratation.profil, 'hydratation_qualite');

  const rides = calculerAntiAge(bareme, repondre(bareme, {
    Q1: 'Les rides / ridules', Q5: 'Marquées', Q7: 'Fine / froissée / irrégulière',
  }));
  egal('rides marquées et peau froissée : Rides & Densité', rides.profil, 'rides_densite');

  const densite = calculerAntiAge(bareme, repondre(bareme, { Q1: 'La perte de densité' }));
  egal('la perte de densité seule va avec les rides', densite.profil, 'rides_densite');

  /*
    La règle du document : « si le meilleur et le deuxième score sont à
    1 point ou moins d'écart, privilégier Anti-Âge Global ».
  */
  const global = calculerAntiAge(bareme, repondre(bareme, {
    Q1: 'Le manque d’éclat',            // hydratation 2, densité 1
    Q3: 'Légèrement relâchée',          // fermeté 1
    Q6: 'Légèrement moins défini',      // fermeté 1  → fermeté 2, hydratation 2
  }));
  egal('deux axes à égalité : Anti-Âge Global', global.profil, 'global');

  const rien = calculerAntiAge(bareme, {});
  egal('sans aucune réponse : Global, faute de mieux', rien.profil, 'global');
  egal('et aucune priorité', rien.priorites, []);
  egal('et aucun terrain', rien.terrains, []);
  egal('ce qui se dit ainsi', nomDuTerrain(bareme, rien.terrains), 'Aucun terrain particulier');

  section('Le terrain, et le terrain mixte');

  const sensible = calculerAntiAge(bareme, repondre(bareme, { Q11: 'Très facilement', Q12: 'Parfois' }));
  egal('la peau qui réagit : Sensible / Réactif', sensible.terrains, ['sensible']);
  egal('nommé comme dans le document', nomDuTerrain(bareme, sensible.terrains), 'Sensible / Réactif');

  const mixte = calculerAntiAge(bareme, repondre(bareme, { Q12: 'Régulièrement', Q13: 'Oui' }));
  egal('deux terrains à égalité exacte : les deux', mixte.terrains, ['hydratation', 'fin']);
  egal('et un nom composé', nomDuTerrain(bareme, mixte.terrains), 'Hydratation / Fin / Fragilisé');

  section('Relire ce qu’elle a répondu');

  const relues = relireLesReponsesAntiAge(bareme, repondre(bareme, {
    Q1: 'L’ovale du visage', Q10: 'Oui', Q10b: ['Peelings', 'Laser'],
  }));
  egal('la première question, avec son libellé', relues[0].reponses, ['L’ovale du visage']);
  egal('la sous-question rend toutes ses cases', relues.find((r) => r.code === 'Q10b')?.reponses, ['Peelings', 'Laser']);
  verifie('les questions sans réponse restent là, vides', relues.some((r) => r.reponses.length === 0));

  /*
    LA CURE D'ADVANCE LIFT.

    85 € la séance, ni guide ni tenue. Par chèques, « des multiples de 85 € » :
    chaque chèque couvre un nombre entier de séances. L'acompte vaut une
    séance. Alma fonctionne comme pour la perte de poids.
  */
  section('La cure d’Advance Lift se règle par séances entières');

  const dix = construireEcheancierCure({ seances: 10, prixSeance: 85, options: 0, methode: 'centre', n: 4 });
  egalEuros('dix séances : 850 €', dix.montantARegler, 850);
  verifie(
    'chaque chèque est un multiple de 85 €',
    dix.echeances.every((e) => e.montant % 85 === 0),
    dix.echeances.map((e) => e.montant).join(' · '),
  );
  egal('en quatre chèques : 3 · 3 · 2 · 2 séances', dix.echeances.map((e) => e.montant / 85), [3, 3, 2, 2]);

  const avecAcompte = construireEcheancierCure({ seances: 10, prixSeance: 85, options: 0, methode: 'centre', n: 4, acompte: 85 });
  egal('l’acompte est une séance, en tête', avecAcompte.echeances[0], { rang: 1, montant: 85, type: 'acompte' });
  verifie(
    'et le reste se répartit encore en séances entières',
    avecAcompte.echeances.filter((e) => e.type === 'echeance').every((e) => e.montant % 85 === 0),
    avecAcompte.echeances.map((e) => e.montant).join(' · '),
  );
  egalEuros('sans rien perdre', avecAcompte.echeances.reduce((n, e) => n + e.montant, 0), 850);

  const alma = construireEcheancierCure({ seances: 10, prixSeance: 85, options: 0, methode: 'alma', n: 10 });
  verifie('chez Alma, des frais comme pour les autres cures', alma.frais > 0);
  egalEuros('et la cure vaut toujours 850 € hors frais', alma.montantARegler - alma.frais, 850);

  section('Le redécoupage garde les séances entières');

  const dues = [255, 170, 170, 170].map((montant, i) => ({
    id: `e${i}`, programme_id: 'p', rang: i + 1, type: 'echeance', montant,
    date_prevue: `2026-1${i}-10`, statut: 'a_venir', moyen: null, date_reglement: null, note: '',
  })) as unknown as Echeance[];
  const enDeux = reechelonner(dues, 2, new Date('2026-10-10'), 85);
  egal('765 € dus, en deux : 5 et 4 séances', enDeux.echeances.map((e) => e.montant), [425, 340]);
  verifie('toujours des multiples de 85', enDeux.echeances.every((e) => e.montant % 85 === 0));
  const sansUnite = reechelonner(dues, 2, new Date('2026-10-10'));
  egal('sans unité, la règle d’avant : en parts égales', sansUnite.echeances.map((e) => e.montant), [382.5, 382.5]);

  section('Le document du Bio-Portrait Anti-Âge');

  const donnees = construireRecapAntiAge({
    bareme,
    resultat: fermete,
    proposition: {
      lignes: [{ technologie: 'advance_lift', seances: 10, prixUnitaire: 85 }],
      guide: false, tenue: false, prixGuide: 0, prixTenue: 0,
      montantTotal: 850, modeReglement: 'centre_4x', frais: 0,
      echeances: dix.echeances,
    },
    cliente: { civilite: 'Mme', prenom: 'Camille', nom: 'Durand' },
    centre: { nom: 'Le Grau-du-Roi', adresse: '', codePostal: '30240', ville: 'Le Grau-du-Roi', telephone: '', email: '' },
    dateBilan: '2026-09-11',
  });
  egal('le profil porte le nom du document', donnees.profil.nom, 'Fermeté & Ovale');
  egal('et son texte cliente, mot pour mot', donnees.profil.texte, bareme.PROFILS.fermete_ovale.texte);
  egal('les besoins tiennent lieu d’impacts', donnees.profil.impacts, bareme.PROFILS.fermete_ovale.besoins);
  egal('pas de pourcentage : ce sont des points', donnees.profil.pourcentage, null);
  egal('ni InBody, ni axes secondaires', [donnees.inbody.length, donnees.aussiPresents.length], [0, 0]);
  egal('la cure : dix séances d’Advance Lift', donnees.soins, [{ libelle: 'Advance Lift', seances: 10 }]);
  egal('sans guide ni tenue', donnees.options, []);
  egal('les mots du document sont ceux de l’anti-âge', donnees.libelles.titreProfil, 'Votre profil anti-âge');
  verifie('avec la mention légale', Boolean(donnees.libelles.mention?.includes('diagnostic médical')));
  egal('et les priorités en toutes lettres', donnees.libelles.priorites?.[0], 'Fermeté');

  const mixteDoc = construireRecapAntiAge({
    bareme, resultat: mixte,
    proposition: { lignes: [], guide: false, tenue: false, prixGuide: 0, prixTenue: 0, montantTotal: 0, modeReglement: 'inconnu', frais: 0, echeances: [] },
    cliente: { civilite: 'Mme', prenom: 'C', nom: 'D' },
    centre: { nom: '', adresse: '', codePostal: '', ville: '', telephone: '', email: '' },
    dateBilan: '2026-09-11',
  });
  egal('un terrain mixte se présente comme un seul', mixteDoc.terrain.nom, 'Hydratation / Fin / Fragilisé');
  verifie('avec les besoins des deux, sans doublon', new Set(mixteDoc.terrain.impacts).size === mixteDoc.terrain.impacts.length);
}
