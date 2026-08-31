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

export type RoleCompte = 'therapeute' | 'direction';

/**
 * Une personne. Elle a un compte de connexion si `user_id` est renseigné ;
 * sinon elle reste sélectionnable sur les fiches sans pouvoir se connecter.
 * La direction n'est rattachée à aucun centre : `centre_id` est vide.
 */
export interface Therapeute {
  id: string;
  centre_id: string | null;
  prenom: string;
  nom: string | null;
  email: string | null;
  user_id: string | null;
  role: RoleCompte;
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
  parcours_audio: 'A' | 'B' | 'C' | null;
  acces_audio_le: string | null;
  archivee_le: string | null;
  /** La marraine, même si elle est suivie dans un autre centre. */
  parrain_id: string | null;
  /** Son nom, quand elle n'a pas de fiche (cliente de la V1). */
  parrain_libre: string;
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

// ---------------------------------------------------------------------------
// Bilan Empreinte
// ---------------------------------------------------------------------------

export type StatutBilan = 'en_cours' | 'termine' | 'abandonne';
export type Facturation = 'en_attente' | 'facture' | 'offert';

export interface Bilan {
  id: string;
  cliente_id: string | null;
  centre_id: string;
  therapeute_id: string | null;
  date_bilan: string;
  statut: StatutBilan;
  bareme_version: number;
  reponses: Record<string, number>;
  curseur: number;
  texte_libre: string;
  inbody: Record<string, unknown>;
  scores: Record<string, number>;
  profil_dominant: string | null;
  terrain_dominant: string | null;
  profils_secondaires: string[];
  terrains_secondaires: string[];
  facturation: Facturation;
  montant_facture: number | null;
  cree_le: string;
  maj_le: string;
}

// ---------------------------------------------------------------------------
// Programme et règlement
// ---------------------------------------------------------------------------

export type StatutProgramme = 'propose' | 'valide' | 'en_cours' | 'termine' | 'abandonne';
export type ModeReglement = 'comptant' | '4x_maison' | '10x_alma';
export type Technologie = 'luxo' | 'ishape' | 'presso' | 'dome';

export type TailleTenue = 'S' | 'M' | 'L' | 'XL';

export interface Programme {
  id: string;
  cliente_id: string;
  bilan_id: string | null;
  centre_id: string;
  therapeute_id: string | null;
  numero: number;
  statut: StatutProgramme;
  electro: boolean;
  guide: boolean;
  tenue: boolean;
  /** Taille remise à la cliente, choisie à la signature du contrat. */
  taille_tenue: TailleTenue | null;
  prix_guide: number;
  prix_tenue: number;
  montant_total: number;
  mode_reglement: ModeReglement;
  frais_financement: number;
  complement_recommande: string | null;
  date_validation: string | null;
  cree_le: string;
  maj_le: string;
}

export interface LigneProgramme {
  id: string;
  programme_id: string;
  technologie: Technologie;
  seances_prevues: number;
  /** Séances gagnées par parrainage : comptées dans le suivi, jamais dans le montant. */
  seances_offertes: number;
  prix_unitaire: number;
}

export type StatutEcheance = 'a_venir' | 'paye' | 'donne' | 'impaye';
export type MoyenPaiement = 'cheque' | 'especes' | 'cb' | 'virement' | 'alma';

export interface Echeance {
  id: string;
  programme_id: string;
  type: 'acompte' | 'echeance';
  rang: number;
  montant: number;
  date_prevue: string | null;
  moyen: MoyenPaiement | null;
  statut: StatutEcheance;
  date_reglement: string | null;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Séances et suivi
// ---------------------------------------------------------------------------

export interface Seance {
  id: string;
  programme_id: string;
  cliente_id: string;
  centre_id: string;
  therapeute_id: string | null;
  date_seance: string;
  technologie: Technologie;
  poids: number | null;
  commentaire: string;
  photo_prise: boolean;
  jeu_code: string | null;
  jeu_valide: boolean;
  jeu_reponse: Record<string, unknown>;
  cloturee: boolean;
  cree_le: string;
}

export interface SuiviSeances {
  programme_id: string;
  cliente_id: string;
  centre_id: string;
  technologie: Technologie;
  seances_prevues: number;
  /** Séances gagnées par parrainage, comprises dans les prévues. */
  seances_offertes: number;
  seances_faites: number;
  seances_restantes: number;
}

export interface Mensuration {
  id: string;
  cliente_id: string;
  programme_id: string | null;
  centre_id: string;
  date_mesure: string;
  poitrine: number | null;
  sous_poitrine: number | null;
  taille: number | null;
  ventre: number | null;
  hanches: number | null;
  bras_droit: number | null;
  bras_gauche: number | null;
  cuisse_droite: number | null;
  cuisse_gauche: number | null;
  mollet_droit: number | null;
  mollet_gauche: number | null;
  cree_le: string;
}

export type ProduitComplement = 'BURN' | 'SOS' | 'DETOX' | 'SKIN';

export interface VenteComplement {
  id: string;
  cliente_id: string;
  programme_id: string | null;
  centre_id: string;
  therapeute_id: string | null;
  date_vente: string;
  produit: ProduitComplement;
  quantite: number;
  prix_unitaire: number;
  cree_le: string;
}

export interface Tarif {
  code: string;
  effet_le: string;
  montant: number;
  libelle: string;
}

// ---------------------------------------------------------------------------
// Notes entre thérapeutes
// ---------------------------------------------------------------------------

export interface NoteCliente {
  id: string;
  cliente_id: string;
  centre_id: string;
  therapeute_id: string | null;
  auteur: string;
  texte: string;
  epinglee: boolean;
  cree_le: string;
}

export interface ResumeNotes {
  cliente_id: string;
  centre_id: string;
  nb: number;
  derniere_le: string;
  a_epinglee: boolean;
}

// ---------------------------------------------------------------------------
// Contrats et consentements
// ---------------------------------------------------------------------------

export interface ResumeContrat {
  id: string;
  cliente_id: string;
  programme_id: string | null;
  centre_id: string;
  nom_cliente: string;
  signe_le: string;
  envoye_le: string | null;
  envoye_a: string | null;
  therapeute: string | null;
  montant: string | null;
  nb_consentements: number;
}

export interface Consentement {
  id: string;
  contrat_id: string;
  service_id: string;
  nom_fichier: string;
  pdf_base64: string;
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export type CategorieProduit = 'complement' | 'guide' | 'tenue' | 'cosmetique' | 'autre';

export interface ProduitStock {
  id: string;
  code: string;
  nom: string;
  categorie: CategorieProduit;
  unite: string;
  centres: string[] | null;
  jours_par_boite: number | null;
  code_tarif: string | null;
  ordre: number;
  actif: boolean;
  cree_le: string;
}

/** Une ligne de rayon : le produit, le centre, et la quantité calculée. */
export interface EtatStock {
  produit_id: string;
  code: string;
  nom: string;
  categorie: CategorieProduit;
  unite: string;
  ordre: number;
  jours_par_boite: number | null;
  centre_id: string;
  quantite: number;
  seuil_bas: number;
  seuil_critique: number;
  dernier_mouvement_le: string | null;
}

export type SensMouvement = 'entree' | 'sortie';
export type MotifMouvement = 'reception' | 'vente' | 'offert' | 'perte' | 'usage_centre' | 'inventaire';

export interface MouvementStock {
  id: string;
  produit_id: string;
  centre_id: string;
  sens: SensMouvement;
  quantite: number;
  motif: MotifMouvement;
  vente_id: string | null;
  therapeute_id: string | null;
  auteur: string;
  note: string;
  fait_le: string;
  cree_le: string;
}
