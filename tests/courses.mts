/*
  La liste de courses : la semaine, et ce qui se modifie encore.

  Une liste de courses se trompe sans bruit — on croit avoir coché, la
  liste était close, et le centre se retrouve sans papier le lundi. D'où
  ces contrôles sur la semaine et sur ce qui reste modifiable.
*/

import { section, verifie, egal } from './harnais.mts';
import {
  cochees,
  estHabituelle,
  listeModifiable,
  lundiDeLaSemaine,
  parHabitude,
  rangerParCategorie,
  type Fourniture,
} from '../src/domain/courses.ts';

function f(p: Partial<Fourniture> = {}): Fourniture {
  return {
    id: 'f1',
    nom: 'Papier toilette',
    categorie: 'hygiene',
    unite: 'paquet',
    lien_amazon: null,
    quantite: 0,
    demandee_par: null,
    habitude: 0,
    ...p,
  };
}

export function controlerCourses() {
  section('La liste de courses — la semaine');

  egal('un lundi est son propre lundi', lundiDeLaSemaine(new Date('2026-11-16T09:00:00')), '2026-11-16');
  egal('un mercredi remonte au lundi', lundiDeLaSemaine(new Date('2026-11-18T23:30:00')), '2026-11-16');
  egal('un dimanche reste dans sa semaine', lundiDeLaSemaine(new Date('2026-11-22T18:00:00')), '2026-11-16');
  egal('et le lundi suivant ouvre la suivante', lundiDeLaSemaine(new Date('2026-11-23T00:05:00')), '2026-11-23');
  egal('un 1er janvier qui tombe un vendredi', lundiDeLaSemaine(new Date('2027-01-01T12:00:00')), '2026-12-28');

  section('La liste de courses — ce qui se modifie encore');

  const mercredi = new Date('2026-11-18T10:00:00');
  verifie('la liste de la semaine est ouverte', listeModifiable('2026-11-16', null, mercredi));
  verifie('celle de la semaine passée est close', !listeModifiable('2026-11-09', null, mercredi));
  verifie('une liste validée ne se modifie plus', !listeModifiable('2026-11-16', '2026-11-17T08:00:00Z', mercredi));
  verifie(
    'même validée et de la semaine en cours',
    !listeModifiable(lundiDeLaSemaine(mercredi), '2026-11-18T09:00:00Z', mercredi),
  );

  section('La liste de courses — la lecture de l’écran');

  {
    const catalogue = [
      f({ id: 'a', categorie: 'hygiene' }),
      f({ id: 'b', categorie: 'accueil', nom: 'Thé' }),
      f({ id: 'c', categorie: 'hygiene', nom: 'Mouchoirs' }),
    ];
    const rayons = rangerParCategorie(catalogue);
    egal('les rayons vides ne s’affichent pas', rayons.map((r) => r.id), ['hygiene', 'accueil']);
    egal('et l’hygiène garde ses deux produits', rayons[0]!.fournitures.length, 2);
  }

  {
    const catalogue = [f({ id: 'a', quantite: 2 }), f({ id: 'b' }), f({ id: 'c', quantite: 1 })];
    egal('on n’achète que ce qui est coché', cochees(catalogue).map((x) => x.id), ['a', 'c']);
    egal('une liste vide n’achète rien', cochees([f(), f()]).length, 0);
  }

  {
    verifie('trois fois en six mois, c’est une habitude', estHabituelle(f({ habitude: 3 })));
    verifie('deux fois, c’est une circonstance', !estHabituelle(f({ habitude: 2 })));
    const tri = [f({ id: 'a', habitude: 1 }), f({ id: 'b', habitude: 9 })].sort(parHabitude);
    egal('les plus demandées remontent', tri.map((x) => x.id), ['b', 'a']);
  }
}
