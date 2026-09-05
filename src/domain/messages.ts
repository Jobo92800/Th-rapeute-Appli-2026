/*
  Le carnet de liaison interne.

  Deux objets qui se ressemblent et qu'il ne faut pas confondre :

    UNE ANNONCE part de la direction vers des thérapeutes. Son état utile,
    c'est **qui l'a lue**. Il n'y a rien à traiter.

    UN SIGNALEMENT part d'une thérapeute vers la direction. Son état utile,
    c'est **où en est le traitement**.

  Ce module ne connaît ni la base ni l'écran : il dit comment un état se
  nomme, de quelle couleur il se montre, et quel est le suivant.
*/

export type TypeMessage = 'annonce' | 'signalement';
export type StatutMessage = 'nouveau' | 'en_cours' | 'traite' | 'sans_suite';

export interface Message {
  id: string;
  type: TypeMessage;
  auteur_id: string | null;
  auteur: string;
  centre_id: string | null;
  sujet: string;
  corps: string;
  statut: StatutMessage;
  reponse: string;
  repondu_le: string | null;
  cree_le: string;
  maj_le: string;
}

export interface Destinataire {
  message_id: string;
  therapeute_id: string;
  /*
    Le prénom, joint à la lecture. La direction ne veut pas savoir « 9 sur
    13 » : elle veut savoir laquelle des quatre n'a pas encore ouvert, pour
    lui en parler de vive voix.
  */
  prenom?: string;
  lu_le: string | null;
}

/*
  Couleurs sémantiques, distinctes de l'accent de l'interface — les mêmes
  conventions que les échéances : rouge pour ce qui demande une action,
  bleu pour ce qui est en route, vert pour ce qui est réglé, gris pour ce
  qui est clos sans suite.
*/
export interface EtatMessage {
  libelle: string;
  pastille: string;
  /** Vrai tant que la direction a quelque chose à faire. */
  aTraiter: boolean;
}

export const ETATS: Record<StatutMessage, EtatMessage> = {
  nouveau: {
    libelle: 'Nouveau',
    pastille: 'bg-rose-100 text-rose-800',
    aTraiter: true,
  },
  en_cours: {
    libelle: 'En cours',
    pastille: 'bg-marine-100 text-marine-800',
    aTraiter: true,
  },
  traite: {
    libelle: 'Traité',
    pastille: 'bg-emerald-100 text-emerald-800',
    aTraiter: false,
  },
  sans_suite: {
    libelle: 'Sans suite',
    pastille: 'bg-ardoise-200 text-ardoise-700',
    aTraiter: false,
  },
};

/** L'ordre dans lequel la direction fait avancer un signalement. */
export const STATUTS_SIGNALEMENT: StatutMessage[] = [
  'nouveau',
  'en_cours',
  'traite',
  'sans_suite',
];

/**
 * Les signalements que la direction n'a pas encore refermés.
 *
 * On ne compte que les signalements : une annonce reste « nouveau » toute
 * sa vie, et la compter ferait sonner la pastille pour rien.
 */
export function aTraiter(messages: Message[]): Message[] {
  return messages.filter((m) => m.type === 'signalement' && ETATS[m.statut].aTraiter);
}

/**
 * Combien de destinataires ont lu, sur combien.
 *
 * C'est le seul état qui vaille pour une annonce : la direction veut savoir
 * si le message est passé, pas s'il est « traité ».
 */
export function lecture(destinataires: Destinataire[]): { lus: number; total: number } {
  return {
    lus: destinataires.filter((d) => d.lu_le !== null).length,
    total: destinataires.length,
  };
}

/**
 * Le résumé qu'on lit sur la liste, sans ouvrir — vu de la direction.
 *
 * Une annonce dit où elle en est de sa diffusion, un signalement où il en
 * est de son traitement.
 */
export function resume(message: Message, destinataires: Destinataire[]): string {
  if (message.type === 'annonce') {
    const { lus, total } = lecture(destinataires);
    if (total === 0) return 'Aucun destinataire';
    if (lus === 0) return `Pas encore lue · ${total} destinataire${total > 1 ? 's' : ''}`;
    if (lus === total) return total === 1 ? 'Lue' : `Lue par toutes les ${total}`;
    return `Lue par ${lus} sur ${total}`;
  }
  return ETATS[message.statut].libelle;
}

/**
 * Le même résumé, vu d'une thérapeute.
 *
 * La diffusion d'une annonce — « lue par 9 sur 13 » — ne regarde que la
 * direction : une thérapeute n'a pas à savoir laquelle de ses collègues a
 * ouvert le message. Elle voit seulement où elle en est, elle.
 */
export function resumeRecu(message: Message, maLigne: Destinataire | undefined): string {
  if (message.type === 'annonce') return maLigne?.lu_le ? 'Lue' : 'Nouvelle';
  return ETATS[message.statut].libelle;
}

/**
 * Les destinataires d'une annonce, rangés pour être lus d'un coup d'œil.
 *
 * Celles qui n'ont pas encore ouvert viennent en premier : ce sont les
 * seules sur lesquelles il reste quelque chose à faire.
 */
export function parLecture(destinataires: Destinataire[]): {
  enAttente: Destinataire[];
  ontLu: Destinataire[];
} {
  const parPrenom = (a: Destinataire, b: Destinataire) =>
    (a.prenom ?? '').localeCompare(b.prenom ?? '', 'fr');
  return {
    enAttente: destinataires.filter((d) => d.lu_le === null).sort(parPrenom),
    ontLu: destinataires.filter((d) => d.lu_le !== null).sort(parPrenom),
  };
}
