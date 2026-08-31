/** Types de la base V2. Suivent exactement les migrations SQL. */

export interface Centre {
  id: string;
  nom: string;
  societe: string;
  siren: string;
  adresse: string;
  code_postal: string;
  ville: string;
  telephone: string;
  email: string;
  siege_adresse: string;
  siege_code_postal: string;
  siege_ville: string;
  nom_airtable: string;
  actif: boolean;
}

export type RoleCompte = 'centre' | 'direction';

export interface CompteCentre {
  user_id: string;
  centre_id: string | null;
  role: RoleCompte;
}

export interface Therapeute {
  id: string;
  centre_id: string;
  prenom: string;
  actif: boolean;
  ordre: number;
}

export interface Cliente {
  id: string;
  centre_id: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  date_naissance: string | null;
  age: number | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  source: string | null;
  therapeutes: string[];
  airtable_record_id: string | null;
  origine: 'v2' | 'import_v1';
  origine_ref: string | null;
  archivee_le: string | null;
  cree_le: string;
  maj_le: string;
}

/** Champs modifiables depuis le formulaire de fiche. */
export type ClienteSaisie = Pick<
  Cliente,
  | 'prenom'
  | 'nom'
  | 'email'
  | 'telephone'
  | 'date_naissance'
  | 'age'
  | 'adresse'
  | 'code_postal'
  | 'ville'
  | 'source'
  | 'therapeutes'
>;

export type StatutSync = 'en_attente' | 'en_cours' | 'ok' | 'erreur';

export interface TacheSync {
  id: string;
  entite: string;
  entite_id: string;
  statut: StatutSync;
  tentatives: number;
  derniere_erreur: string | null;
  cree_le: string;
  traite_le: string | null;
}

export type PhaseJeu = 'A' | 'B' | 'C';

export interface Jeu {
  code: string;
  phase: PhaseJeu;
  etape: number;
  theme: string;
  titre: string;
  materiel: string;
  objectif: string;
  regles: string[];
  phrase_lancement: string;
  mission: string;
  duree: string;
  options: string[];
  a_enregistrer: string;
  action_cliente: string;
  prise_conscience: string;
  resultat: string;
  petit_pas: string;
  nature: 'pedagogique' | 'action';
  prioritaire: boolean;
  ordre: number;
}
