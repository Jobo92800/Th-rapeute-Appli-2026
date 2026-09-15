/*
  Le sommaire des podcasts : ce que la thérapeute lit de l'étape que la
  cliente écoute cette semaine. Une fiche manquante ou décalée d'un cran,
  et on reprend en rendez-vous le défi d'une autre semaine.
*/

import { section, verifie, egal } from './harnais.mts';
import {
  etatDuPodcast,
  fichePodcast,
  podcastDeLEtape,
  podcastEnCours,
  sommaireDuParcours,
  sousTitrePodcast,
} from '../src/domain/sommairePodcasts.ts';

export function controlerPodcasts() {
  section('Le sommaire des podcasts suit Mon Parcours étape pour étape');

  const troisMois = sommaireDuParcours('B');
  const sixMois = sommaireDuParcours('C');

  // Mon Parcours : 13 étapes en 3 mois, 24 en ligne en 6 mois (+ le 24 à venir).
  egal('cure 3 mois : podcasts 0 à 12', troisMois.map((p) => p.numero), Array.from({ length: 13 }, (_, i) => i));
  egal('cure 6 mois : podcasts 0 à 24', sixMois.map((p) => p.numero), Array.from({ length: 25 }, (_, i) => i));

  verifie(
    'les podcasts 1 à 11 sont les mêmes dans les deux cures',
    troisMois.slice(1, 12).every((p, i) => p === sixMois[i + 1]),
  );
  verifie(
    'le podcast 12 diffère : stabiliser en 3 mois, inflammation en 6 mois',
    troisMois[12].titre !== sixMois[12].titre,
  );
  verifie(
    'chaque fiche a un titre, un résumé, un défi et son raccourci',
    [...troisMois, ...sixMois].every(
      (p) => p.titre.length > 0 && p.resume.length > 50 && p.defi.length > 20 && p.defiCourt.length > 0,
    ),
  );
  verifie(
    'le podcast 0 dit qu’il n’a pas de défi hebdomadaire',
    troisMois[0].defi.startsWith('Pas de défi') && sixMois[0].defi.startsWith('Pas de défi'),
  );
  verifie(
    'le podcast 0 annonce la structure de sa cure',
    troisMois[0].resume.includes('3 mois') && sixMois[0].resume.includes('6 mois'),
  );

  egal('les quatre trophées, à leur place', [
    troisMois[4].trophee, troisMois[12].trophee, sixMois[12].trophee, sixMois[24].trophee,
  ], [
    'Rééquilibrage alimentaire validé',
    'Cure de 3 mois complétée',
    'Mi-parcours atteint',
    '6 mois. Une nouvelle version de vous.',
  ]);

  section('L’étape N de Mon Parcours est le podcast N − 1');

  egal('étape 1 → podcast 0', podcastDeLEtape(1), 0);
  egal('étape 13 → podcast 12', fichePodcast('B', 13)?.numero, 12);
  egal('étape 14 en 3 mois → rien', fichePodcast('B', 14), null);
  egal('étape 24 en 6 mois → podcast 23', fichePodcast('C', 24)?.titre, 'Alimentation libre et durable : sortir des cases');
  egal('sous-titre du 0', sousTitrePodcast(0), 'Introduction');
  egal('sous-titre du 7', sousTitrePodcast(7), 'Semaine 7');

  section('Où en est la cliente');

  const debut = { terminees: 0, total: 13 };
  egal('rien d’écouté : le podcast 0 est en cours', podcastEnCours(debut), 0);
  egal('… et le 1 à venir', etatDuPodcast(1, debut), 'a_venir');

  const milieu = { terminees: 3, total: 13 };
  egal('trois étapes faites : le podcast 3 est en cours', podcastEnCours(milieu), 3);
  egal('le 2 est écouté', etatDuPodcast(2, milieu), 'ecoute');
  egal('le 3 est en cours', etatDuPodcast(3, milieu), 'en_cours');
  egal('le 4 est à venir', etatDuPodcast(4, milieu), 'a_venir');

  const fini = { terminees: 13, total: 13 };
  egal('tout écouté : le dernier reste en cours', podcastEnCours(fini), 12);
  egal('… et il est marqué en cours, pas écouté', etatDuPodcast(12, fini), 'en_cours');

  // Le podcast 24 existe au document, pas encore dans Mon Parcours.
  egal('un podcast au-delà des étapes en ligne le dit', etatDuPodcast(24, { terminees: 5, total: 24 }), 'pas_en_ligne');
}
