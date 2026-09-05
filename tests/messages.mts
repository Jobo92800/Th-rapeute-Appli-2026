/*
  Le carnet de liaison.

  Deux objets qui se ressemblent et dont l'état utile diffère : une annonce
  se mesure à qui l'a lue, un signalement à où en est son traitement. C'est
  cette distinction que ces contrôles protègent — la confondre ferait
  demander « traité ? » à une annonce, et sonner la pastille pour rien.
*/

import { section, verifie, egal } from './harnais.mts';
import {
  ETATS,
  STATUTS_SIGNALEMENT,
  aTraiter,
  lecture,
  resume,
  resumeRecu,
  type Destinataire,
  type Message,
} from '../src/domain/messages.ts';

function msg(p: Partial<Message>): Message {
  return {
    id: p.id ?? 'm', type: p.type ?? 'signalement', auteur_id: 'a', auteur: 'Marie',
    centre_id: 'grau-du-roi', sujet: p.sujet ?? 'Sujet', corps: '', statut: p.statut ?? 'nouveau',
    reponse: '', repondu_le: null, cree_le: '2026-09-05', maj_le: '2026-09-05',
  };
}
const dest = (n: number, lus: number): Destinataire[] =>
  Array.from({ length: n }, (_, i) => ({ message_id: 'm', therapeute_id: `t${i}`, lu_le: i < lus ? '2026-09-05' : null }));

export function controlerMessages() {
  section('Ce que la direction doit encore traiter');

  const liste = [
    msg({ id: '1', type: 'signalement', statut: 'nouveau' }),
    msg({ id: '2', type: 'signalement', statut: 'en_cours' }),
    msg({ id: '3', type: 'signalement', statut: 'traite' }),
    msg({ id: '4', type: 'signalement', statut: 'sans_suite' }),
    msg({ id: '5', type: 'annonce', statut: 'nouveau' }),
  ];

  egal('nouveau et en cours restent à traiter', aTraiter(liste).map((m) => m.id), ['1', '2']);
  verifie('traité ne compte plus', !aTraiter(liste).some((m) => m.id === '3'));
  verifie('sans suite non plus', !aTraiter(liste).some((m) => m.id === '4'));
  /*
    Le piège : une annonce naît « nouveau » et le reste toute sa vie. La
    compter ferait sonner la pastille de la direction pour un message
    qu'elle a elle-même écrit.
  */
  verifie('une annonce ne se traite pas', !aTraiter(liste).some((m) => m.id === '5'));

  section('Où en est une annonce');

  egal('personne n’a lu', lecture(dest(4, 0)), { lus: 0, total: 4 });
  egal('deux sur quatre', lecture(dest(4, 2)), { lus: 2, total: 4 });
  egal('toutes ont lu', lecture(dest(4, 4)), { lus: 4, total: 4 });

  const annonce = msg({ type: 'annonce' });
  egal('sans destinataire, on le dit', resume(annonce, []), 'Aucun destinataire');
  egal('pas encore lue', resume(annonce, dest(3, 0)), 'Pas encore lue · 3 destinataires');
  egal('lue à moitié', resume(annonce, dest(4, 2)), 'Lue par 2 sur 4');
  egal('lue par toutes', resume(annonce, dest(4, 4)), 'Lue par toutes les 4');
  egal('une seule destinataire, au singulier', resume(annonce, dest(1, 1)), 'Lue');
  egal('et non lue au singulier aussi', resume(annonce, dest(1, 0)), 'Pas encore lue · 1 destinataire');

  section('Ce qu’une thérapeute lit de la même annonce');

  /*
    Le compte de diffusion est une information de direction. Sur l'écran
    d'une thérapeute, l'annonce ne dit que si elle-même l'a ouverte.
  */
  const [aElle] = dest(1, 0);
  const [elleALu] = dest(1, 1);
  egal('non ouverte', resumeRecu(annonce, aElle), 'Nouvelle');
  egal('ouverte', resumeRecu(annonce, elleALu), 'Lue');
  verifie(
    'le nombre de collègues qui ont lu ne lui est jamais montré',
    !resumeRecu(annonce, elleALu).includes('sur') && !resumeRecu(annonce, aElle).includes('sur'),
  );
  egal('son propre signalement garde son état', resumeRecu(msg({ statut: 'en_cours' }), undefined), 'En cours');

  section('Où en est un signalement');

  for (const s of STATUTS_SIGNALEMENT) {
    egal(`« ${ETATS[s].libelle} » se résume par son état`, resume(msg({ statut: s }), []), ETATS[s].libelle);
  }
  egal('les quatre états sont couverts', STATUTS_SIGNALEMENT.length, 4);
  verifie(
    'chacun porte un libellé et une couleur',
    STATUTS_SIGNALEMENT.every((s) => ETATS[s].libelle.length > 0 && ETATS[s].pastille.includes('bg-')),
  );
}
