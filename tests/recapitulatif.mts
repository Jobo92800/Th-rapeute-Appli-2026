/*
  Le récapitulatif envoyé par mail à une cliente qui veut réfléchir.

  Il part chez elle, sans relecture. Deux choses ne doivent donc jamais
  déraper : le montant, qui doit être exactement celui annoncé de vive voix,
  et les textes du barème, qui portent des balises HTML invisibles à l'écran
  et bien visibles dans un PDF.
*/

import { section, verifie, egal, egalEuros } from './harnais.mts';
import { baremeLivre } from './prescription.mts';
import {
  construireRecap,
  nomFichierRecap,
  sansBalises,
  type Proposition,
} from '../src/domain/recapitulatif.ts';
import { calculerBioPortrait } from '../src/domain/bioportrait.ts';

export function controlerRecapitulatif() {
  const bareme = baremeLivre();

  section('Les textes du barème, mis au propre');

  egal(
    'le gras disparaît',
    sansBalises('Votre corps vit en <b>état d’alerte permanent</b>.'),
    'Votre corps vit en état d’alerte permanent.',
  );
  egal('les entités se décodent', sansBalises('Ventre &amp; hanches'), 'Ventre & hanches');
  egal('les espaces en trop se resserrent', sansBalises('  deux   mots \n ici '), 'deux mots ici');
  verifie(
    'aucun texte du barème livré ne garde de balise',
    Object.values(bareme.AX).every(
      (a) => !/[<>]/.test(sansBalises(a.feel) + sansBalises(a.sig) + a.imp.map(sansBalises).join('')),
    ),
  );

  section('Le récapitulatif d’une cliente');

  const bp = calculerBioPortrait(bareme, {});

  // Ce que la thérapeute a montré : seize séances, pas les vingt calculées.
  const proposition: Proposition = {
    lignes: [
      { technologie: 'luxo', seances: 12, prixUnitaire: 59 },
      { technologie: 'presso', seances: 4, prixUnitaire: 59 },
    ],
    guide: true,
    tenue: false,
    prixGuide: 29,
    prixTenue: 60,
    montantTotal: 16 * 59 + 29,
    modeReglement: 'centre_4x',
    frais: 0,
    echeances: [
      { rang: 1, montant: 265 },
      { rang: 2, montant: 236 },
      { rang: 3, montant: 236 },
      { rang: 4, montant: 236 },
    ],
  };

  const r = construireRecap({
    bareme,
    bioportrait: bp,
    inbody: [{ libelle: 'Masse musculaire', valeur: 'Faible' }],
    proposition,
    cliente: { civilite: 'Madame', prenom: 'Sophie', nom: 'Marchand' },
    centre: {
      nom: 'Le Crès',
      adresse: '1 rue des Tilleuls',
      codePostal: '34920',
      ville: 'Le Crès',
      telephone: '04 67 00 00 00',
      email: 'lecres@mabeautyplus.fr',
    },
    dateBilan: '2026-09-03',
  });

  egal('les deux soins sont repris', r.soins.length, 2);
  egal('avec leur nom en clair', r.soins[0].libelle, 'Luxothérapie Perte de poids');
  egalEuros('douze séances de luxo font 708 €', r.soins[0].montant, 708);
  egal('seize séances au total', r.totalSeances, 16);
  egalEuros('le montant est celui annoncé, pas un recalcul', r.montantTotal, 973);
  egal('le guide est compté en option', r.options.length, 1);
  verifie('la tenue non facturée n’apparaît pas', !r.options.some((o) => o.libelle.includes('Tenue')));
  egal('le mode de règlement est dit en français', r.reglement, 'Au centre, en 4 fois sans frais');
  egalEuros('sans frais, la cliente règle le montant de la cure', r.montantRegle, 973);

  section('Ce que la cliente règle vraiment, chez Alma');

  const alma = construireRecap({
    bareme,
    bioportrait: bp,
    inbody: [],
    proposition: { ...proposition, modeReglement: 'alma_10x', frais: 63.25 },
    cliente: { civilite: 'Madame', prenom: 'Sophie', nom: 'Marchand' },
    centre: r.centre,
    dateBilan: '2026-09-03',
  });

  egalEuros('le montant de la cure ne change pas', alma.montantTotal, 973);
  egalEuros('mais elle règle les frais en plus', alma.montantRegle, 1036.25);
  egal('et le document le dit', alma.reglement, 'Par carte, en 10 fois via Alma');

  section('Ce qu’on n’annonce pas à la cliente');

  verifie(
    'un axe sous le seuil n’est pas présenté comme présent',
    r.aussiPresents.every((a) => a.pourcentage >= 60),
    r.aussiPresents.map((a) => `${a.nom} ${a.pourcentage}`).join(', '),
  );

  section('Le fichier joint au mail');

  egal(
    'son nom se lit, sans accent ni espace',
    nomFichierRecap({ prenom: 'Éloïse', nom: 'Le Guen', dateBilan: '2026-09-03' }),
    'BioPortrait_Eloise-Le-Guen_2026-09-03.pdf',
  );
}
