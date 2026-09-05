/*
  Le bilan santé de la fiche.

  Il n'entre dans aucun calcul, mais il se lit avant une séance : ce qui est
  vérifié ici, c'est qu'une information de santé ne se perde pas en route et
  qu'un « non » ne se confonde jamais avec « on n'a pas demandé ».
*/

import { section, verifie, egal } from './harnais.mts';
import {
  LIBRES,
  OUI_NON,
  estRenseigne,
  nettoyer,
  pointsDAttention,
  questionsOuiNon,
  reponseLibre,
  reponseOuiNon,
} from '../src/domain/sante.ts';

export function controlerSante() {
  section('Les questions posées');

  egal('sept oui/non', OUI_NON.length, 7);
  egal('sept champs libres', LIBRES.length, 7);
  verifie(
    'chaque question a une clé et un libellé',
    [...OUI_NON, ...LIBRES].every((q) => q.cle.length > 0 && q.libelle.length > 0),
  );
  verifie(
    'aucune clé en double',
    new Set([...OUI_NON, ...LIBRES].map((q) => q.cle)).size === 14,
  );

  section('« Enceinte » ne se demande pas à un monsieur');

  egal('à une dame, les sept', questionsOuiNon(true).length, 7);
  egal('à un monsieur, six', questionsOuiNon(false).length, 6);
  verifie(
    'et c’est bien celle-là qui saute',
    !questionsOuiNon(false).some((q) => q.cle === 'enceinte'),
  );

  section('« Non » et « pas demandé » ne se confondent pas');

  /*
    Le piège qui ferait passer une hypertension à la trappe : traiter une
    question sans réponse comme un « non ».
  */
  egal('sans réponse, on ne sait pas', reponseOuiNon({}, 'hypertension'), null);
  egal('un non est un non', reponseOuiNon({ hypertension: false }, 'hypertension'), false);
  egal('un oui est un oui', reponseOuiNon({ hypertension: true }, 'hypertension'), true);
  egal('un champ libre vide rend une chaîne vide', reponseLibre({}, 'thyroide'), '');

  section('Ce qui mérite d’être vu');

  const sante = {
    hypertension: true,
    diabete: false,
    enceinte: true,
    medicaments: 'Anticoagulant',
    thyroide: '   ',
  };
  const points = pointsDAttention(sante);
  egal('les oui et les champs remplis, rien d’autre', points, [
    'Hypertension',
    'Enceinte',
    'Médicament(s) : Anticoagulant',
  ]);
  verifie('un non n’est pas une information', !points.some((p) => p.includes('Diabète')));
  verifie('un champ de blancs non plus', !points.some((p) => p.includes('thyroïde')));
  verifie(
    'et « enceinte » disparaît chez un monsieur',
    !pointsDAttention(sante, false).includes('Enceinte'),
  );

  section('Ce qu’on écrit en base');

  egal('les blancs ne s’enregistrent pas', nettoyer({ thyroide: '  ' }), {});
  egal('un texte est rogné', nettoyer({ thyroide: '  Hypo  ' }), { thyroide: 'Hypo' });
  egal('un faux se garde', nettoyer({ diabete: false }), { diabete: false });

  verifie('une fiche vierge n’est pas renseignée', !estRenseigne({}));
  verifie('un seul non suffit à dire qu’on a demandé', estRenseigne({ diabete: false }));
  verifie('un champ de blancs ne suffit pas', !estRenseigne({ thyroide: '   ' }));
}
