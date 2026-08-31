import { supabase } from '../lib/supabase';
import type { Bareme } from '../domain/empreinte';
import type {
  Bilan,
  Consentement,
  Echeance,
  Jeu,
  LigneProgramme,
  Mensuration,
  NoteCliente,
  Programme,
  ResumeContrat,
  ResumeNotes,
  Seance,
  SuiviSeances,
  TailleTenue,
  Technologie,
  VenteComplement,
} from '../types/db';
import type { GrilleTarifaire } from '../domain/tarification';
import { datesEcheancier, type SituationReglement } from '../domain/reglement';

// ---------------------------------------------------------------------------
// Tarifs et barème
// ---------------------------------------------------------------------------

export async function lireGrilleTarifaire(): Promise<GrilleTarifaire> {
  const { data, error } = await supabase
    .from('tarifs')
    .select('code, montant, effet_le')
    .lte('effet_le', new Date().toISOString().slice(0, 10))
    .order('effet_le', { ascending: false });

  if (error) throw error;

  // La première occurrence de chaque code est la plus récente en vigueur.
  const vus = new Map<string, number>();
  for (const t of data ?? []) {
    if (!vus.has(t.code)) vus.set(t.code, Number(t.montant));
  }

  return {
    seance: vus.get('seance') ?? 59,
    guide: vus.get('guide') ?? 29,
    tenue: vus.get('tenue') ?? 60,
    bilan: vus.get('bilan') ?? 87,
    dome: vus.get('dome') ?? 39,
    complement: vus.get('complement') ?? 37,
  };
}

export async function lireBaremeActif(): Promise<{ version: number; bareme: Bareme }> {
  const { data, error } = await supabase
    .from('bareme_empreinte')
    .select('version, contenu')
    .eq('actif', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Aucun barème actif : la migration 005 a-t-elle été exécutée ?');
  return { version: data.version, bareme: data.contenu as Bareme };
}

// ---------------------------------------------------------------------------
// Bilans
// ---------------------------------------------------------------------------

export async function enregistrerBilan(bilan: Partial<Bilan>): Promise<Bilan> {
  const { data, error } = await supabase.from('bilans').insert(bilan).select().single();
  if (error) throw error;
  return data as Bilan;
}

export async function majBilan(id: string, patch: Partial<Bilan>): Promise<Bilan> {
  const { data, error } = await supabase
    .from('bilans')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  declencherSynchro();
  return data as Bilan;
}

export async function bilansDeLaCliente(clienteId: string): Promise<Bilan[]> {
  const { data, error } = await supabase
    .from('bilans')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('date_bilan', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Bilan[];
}

// ---------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------

export interface ProgrammeComplet {
  programme: Programme;
  lignes: LigneProgramme[];
  echeances: Echeance[];
  suivi: SuiviSeances[];
}

export async function programmesDeLaCliente(clienteId: string): Promise<ProgrammeComplet[]> {
  const { data: programmes, error } = await supabase
    .from('programmes')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('numero');
  if (error) throw error;
  if (!programmes?.length) return [];

  const ids = programmes.map((p) => p.id);

  const [lignes, echeances, suivi] = await Promise.all([
    supabase.from('programme_lignes').select('*').in('programme_id', ids),
    supabase.from('echeances').select('*').in('programme_id', ids).order('rang'),
    supabase.from('suivi_seances').select('*').in('programme_id', ids),
  ]);

  return (programmes as Programme[]).map((p) => ({
    programme: p,
    lignes: ((lignes.data ?? []) as LigneProgramme[]).filter((l) => l.programme_id === p.id),
    echeances: ((echeances.data ?? []) as Echeance[])
      .filter((e) => e.programme_id === p.id)
      .sort((a, b) => (a.type === b.type ? a.rang - b.rang : a.type === 'acompte' ? -1 : 1)),
    suivi: ((suivi.data ?? []) as SuiviSeances[]).filter((s) => s.programme_id === p.id),
  }));
}

export interface NouveauProgramme {
  clienteId: string;
  bilanId: string | null;
  centreId: string;
  lignes: Array<{ technologie: Technologie; seances: number; prixUnitaire: number }>;
  electro: boolean;
  /** Le guide et la tenue sont-ils facturés sur cette cure ? */
  guide: boolean;
  tenue: boolean;
  prixGuide: number;
  prixTenue: number;
  montantTotal: number;
  modeReglement: Programme['mode_reglement'];
  fraisFinancement: number;
  echeances: Array<{ rang: number; montant: number }>;
  complementRecommande: string | null;
  /** Séances gagnées par parrainage, posées sur une technologie. Jamais facturées. */
  offertes?: { technologie: Technologie; seances: number } | null;
}

/**
 * La taille est choisie avec la cliente au moment de la signature. Elle est
 * écrite avant l'enregistrement du contrat : c'est elle qui dit quelle tenue
 * sortir du rayon.
 */
export async function enregistrerTailleTenue(
  programmeId: string,
  taille: TailleTenue,
): Promise<void> {
  const { error } = await supabase
    .from('programmes')
    .update({ taille_tenue: taille })
    .eq('id', programmeId);
  if (error) throw error;
}

export async function creerProgramme(n: NouveauProgramme): Promise<Programme> {
  // Numéro de cure : 1 pour la première, puis 2, 3…
  const { count } = await supabase
    .from('programmes')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', n.clienteId);

  const { data: programme, error } = await supabase
    .from('programmes')
    .insert({
      cliente_id: n.clienteId,
      bilan_id: n.bilanId,
      centre_id: n.centreId,
      numero: (count ?? 0) + 1,
      statut: 'valide',
      electro: n.electro,
      guide: n.guide,
      tenue: n.tenue,
      prix_guide: n.guide ? n.prixGuide : 0,
      prix_tenue: n.tenue ? n.prixTenue : 0,
      montant_total: n.montantTotal,
      mode_reglement: n.modeReglement,
      frais_financement: n.fraisFinancement,
      complement_recommande: n.complementRecommande,
      date_validation: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) throw error;

  /*
    Une technologie qui ne porte que des séances offertes doit exister quand
    même : sans sa ligne, les séances gagnées n'auraient nulle part où aller.
  */
  const offertes = n.offertes ?? null;
  const lignes = n.lignes
    .filter((l) => l.seances > 0 || (offertes?.technologie === l.technologie && offertes.seances > 0))
    .map((l) => ({
      programme_id: programme.id,
      technologie: l.technologie,
      seances_prevues: l.seances,
      seances_offertes: offertes?.technologie === l.technologie ? offertes.seances : 0,
      prix_unitaire: l.prixUnitaire,
    }));

  if (lignes.length > 0) {
    const { error: e } = await supabase.from('programme_lignes').insert(lignes);
    if (e) throw e;
  }

  if (n.echeances.length > 0) {
    const dates = datesEcheancier(new Date(), n.echeances.length);
    const { error: e } = await supabase.from('echeances').insert(
      n.echeances.map((ech, i) => ({
        programme_id: programme.id,
        type: 'echeance' as const,
        rang: ech.rang,
        montant: ech.montant,
        date_prevue: dates[i],
      })),
    );
    if (e) throw e;
  }

  declencherSynchro();
  return programme as Programme;
}

export async function situationsDuCentre(centreId: string): Promise<SituationReglement[]> {
  const { data, error } = await supabase
    .from('situation_reglement')
    .select('*')
    .eq('centre_id', centreId);

  if (error) throw error;
  return (data ?? []) as SituationReglement[];
}

export async function majEcheance(id: string, patch: Partial<Echeance>): Promise<void> {
  const { error } = await supabase.from('echeances').update(patch).eq('id', id);
  if (error) throw error;
  declencherSynchro();
}

// ---------------------------------------------------------------------------
// Séances et jeux
// ---------------------------------------------------------------------------

export async function lireBibliotheque(): Promise<Jeu[]> {
  const { data, error } = await supabase.from('jeux').select('*').order('code');
  if (error) throw error;
  return (data ?? []) as Jeu[];
}

export async function seancesDuProgramme(programmeId: string): Promise<Seance[]> {
  const { data, error } = await supabase
    .from('seances')
    .select('*')
    .eq('programme_id', programmeId)
    .order('date_seance', { ascending: false })
    .order('cree_le', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Seance[];
}

export async function ouvrirSeance(s: {
  programmeId: string;
  clienteId: string;
  centreId: string;
  technologie: Technologie;
  jeuCode: string | null;
}): Promise<Seance> {
  const { data, error } = await supabase
    .from('seances')
    .insert({
      programme_id: s.programmeId,
      cliente_id: s.clienteId,
      centre_id: s.centreId,
      technologie: s.technologie,
      jeu_code: s.jeuCode,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Seance;
}

export async function majSeance(id: string, patch: Partial<Seance>): Promise<Seance> {
  const { data, error } = await supabase
    .from('seances')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Seance;
}

export async function supprimerSeance(id: string): Promise<void> {
  const { error } = await supabase.from('seances').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Mensurations et compléments
// ---------------------------------------------------------------------------

export async function mensurationsDeLaCliente(clienteId: string): Promise<Mensuration[]> {
  const { data, error } = await supabase
    .from('mensurations')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('date_mesure', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Mensuration[];
}

export async function ajouterMensuration(m: Partial<Mensuration>): Promise<void> {
  const { error } = await supabase.from('mensurations').insert(m);
  if (error) throw error;
}

export async function ventesDeLaCliente(clienteId: string): Promise<VenteComplement[]> {
  const { data, error } = await supabase
    .from('ventes_complements')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('date_vente', { ascending: false });
  if (error) throw error;
  return (data ?? []) as VenteComplement[];
}

export async function ajouterVente(v: Partial<VenteComplement>): Promise<void> {
  const { error } = await supabase.from('ventes_complements').insert(v);
  if (error) throw error;
}

/**
 * Supprimer la vente rend la boîte au rayon : le mouvement de stock qu'elle
 * avait créé part avec elle.
 */
export async function supprimerVente(id: string): Promise<void> {
  const { error } = await supabase.from('ventes_complements').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Notes entre thérapeutes
// ---------------------------------------------------------------------------

export async function notesDeLaCliente(clienteId: string): Promise<NoteCliente[]> {
  const { data, error } = await supabase
    .from('notes_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('epinglee', { ascending: false })
    .order('cree_le', { ascending: false });

  if (error) throw error;
  return (data ?? []) as NoteCliente[];
}

export async function ajouterNote(n: {
  clienteId: string;
  centreId: string;
  auteur: string;
  texte: string;
  epinglee: boolean;
}): Promise<void> {
  const { error } = await supabase.from('notes_cliente').insert({
    cliente_id: n.clienteId,
    centre_id: n.centreId,
    auteur: n.auteur,
    texte: n.texte.trim(),
    epinglee: n.epinglee,
  });
  if (error) throw error;
}

export async function epinglerNote(id: string, epinglee: boolean): Promise<void> {
  const { error } = await supabase.from('notes_cliente').update({ epinglee }).eq('id', id);
  if (error) throw error;
}

export async function supprimerNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes_cliente').delete().eq('id', id);
  if (error) throw error;
}

/** Compteurs pour le bouton de la liste des clientes. */
export async function resumeNotesDuCentre(centreId: string): Promise<ResumeNotes[]> {
  const { data, error } = await supabase
    .from('notes_resume')
    .select('*')
    .eq('centre_id', centreId);

  if (error) throw error;
  return (data ?? []) as ResumeNotes[];
}

// ---------------------------------------------------------------------------
// Contrats et consentements
// ---------------------------------------------------------------------------

export async function contratsDeLaCliente(clienteId: string): Promise<ResumeContrat[]> {
  const { data, error } = await supabase
    .from('contrats_resume')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('signe_le', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ResumeContrat[];
}

export async function enregistrerContrat(c: {
  clienteId: string;
  programmeId: string | null;
  centreId: string;
  nomCliente: string;
  pdfBase64: string;
  donnees: unknown;
  consentements: Array<{ serviceId: string; filename: string; pdfBase64: string }>;
}): Promise<string> {
  const { data, error } = await supabase
    .from('contrats')
    .insert({
      cliente_id: c.clienteId,
      programme_id: c.programmeId,
      centre_id: c.centreId,
      nom_cliente: c.nomCliente,
      pdf_base64: c.pdfBase64,
      donnees: c.donnees,
    })
    .select('id')
    .single();

  if (error) throw error;

  if (c.consentements.length > 0) {
    const { error: e } = await supabase.from('consentements').insert(
      c.consentements.map((x) => ({
        contrat_id: data.id,
        service_id: x.serviceId,
        nom_fichier: x.filename,
        pdf_base64: x.pdfBase64,
      })),
    );
    if (e) throw e;
  }

  return data.id as string;
}

/** Le PDF n'est chargé qu'au moment du téléchargement. */
export async function lirePdfContrat(contratId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('contrats')
    .select('pdf_base64')
    .eq('id', contratId)
    .maybeSingle();

  if (error) throw error;
  return data?.pdf_base64 ?? null;
}

export async function consentementsDuContrat(contratId: string): Promise<Consentement[]> {
  const { data, error } = await supabase
    .from('consentements')
    .select('*')
    .eq('contrat_id', contratId)
    .order('nom_fichier');

  if (error) throw error;
  return (data ?? []) as Consentement[];
}

// ---------------------------------------------------------------------------
// Synchronisation Airtable
// ---------------------------------------------------------------------------

let minuterieSynchro: ReturnType<typeof setTimeout> | null = null;

/**
 * Demande au serveur de vider la file d'attente.
 *
 * Le parcours du bilan enchaîne trois écritures en une seconde (cliente,
 * bilan, cure). On attend donc un court instant et on ne lance qu'un seul
 * appel : la file sera de toute façon complète à ce moment-là.
 *
 * Volontairement silencieuse : l'écriture en base a déjà réussi, et la file
 * garde la trace de ce qui reste à envoyer.
 */
export function declencherSynchro(): void {
  if (minuterieSynchro) clearTimeout(minuterieSynchro);
  minuterieSynchro = setTimeout(() => {
    minuterieSynchro = null;
    supabase.functions.invoke('synchro-airtable').catch(() => undefined);
  }, 1200);
}

export interface ResultatSynchro {
  reprises: number;
  traitees: number;
  echecs: number;
  erreurs: Array<{ entite: string; message: string }>;
}

/**
 * Relance explicite, déclenchée par la thérapeute.
 *
 * Remet à zéro le compteur des tâches en échec — sans quoi celles qui ont
 * dépassé cinq tentatives resteraient écartées et le bouton n'aurait aucun
 * effet visible — puis attend le résultat pour pouvoir l'annoncer.
 */
export async function relancerSynchro(): Promise<ResultatSynchro> {
  const { data: reprises } = await supabase.rpc('reprendre_taches_airtable');

  const { data, error } = await supabase.functions.invoke('synchro-airtable', { body: {} });
  if (error) {
    throw new Error(
      (data as { error?: string })?.error ?? "La synchronisation n'a pas pu être lancée.",
    );
  }

  const r = data as Omit<ResultatSynchro, 'reprises'>;
  return {
    reprises: Number(reprises) || 0,
    traitees: r?.traitees ?? 0,
    echecs: r?.echecs ?? 0,
    erreurs: r?.erreurs ?? [],
  };
}

export interface EtatSynchro {
  enAttente: number;
  enErreur: number;
  dernieresErreurs: Array<{ entite: string; message: string }>;
}

/**
 * Retire de la file les tâches en échec. Utile quand l'échec est voulu : une
 * fiche supprimée à la main dans Airtable ne pourra jamais être mise à jour,
 * et la V2 réessaierait sans fin.
 *
 * Rien n'est perdu : la prochaine modification de la fiche la remet en file.
 */
export async function oublierErreursSynchro(): Promise<number> {
  const { data, error } = await supabase.rpc('oublier_taches_airtable');
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function etatSynchro(): Promise<EtatSynchro> {
  const [attente, erreur, details] = await Promise.all([
    supabase.from('airtable_sync').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabase.from('airtable_sync').select('*', { count: 'exact', head: true }).eq('statut', 'erreur'),
    supabase
      .from('airtable_sync')
      .select('entite, derniere_erreur')
      .eq('statut', 'erreur')
      .order('cree_le', { ascending: false })
      .limit(3),
  ]);

  return {
    enAttente: attente.count ?? 0,
    enErreur: erreur.count ?? 0,
    dernieresErreurs: (details.data ?? []).map((d) => ({
      entite: d.entite as string,
      message: (d.derniere_erreur as string) ?? '',
    })),
  };
}

// ---------------------------------------------------------------------------
// Parcours audio
// ---------------------------------------------------------------------------

/**
 * Crée le compte de la cliente sur l'application « Mon Parcours » et
 * déclenche son invitation par email. Le code d'accès de cette application
 * vit côté serveur, jamais dans le navigateur.
 */
export const MOT_DE_PASSE_MIN = 8;

/**
 * Crée l'accès de la cliente sur « Mon Parcours ».
 *
 * Avec un mot de passe, le compte est utilisable immédiatement : la cliente
 * repart du centre en sachant se connecter. Sans, elle reçoit une invitation
 * par email — plus fragile, le lien expire et se perd.
 */
export async function donnerAccesParcours(
  clienteId: string,
  parcours: 'A' | 'B' | 'C',
  motDePasse?: string,
): Promise<{ dejaLa: boolean; motDePasseDefini: boolean }> {
  const { data, error } = await supabase.functions.invoke('acces-parcours-audio', {
    body: { clienteId, parcours, action: 'creer', motDePasse: motDePasse || undefined },
  });

  if (error) {
    throw new Error(
      (data as { error?: string })?.error ?? "L'accès au parcours audio n'a pas pu être créé.",
    );
  }
  const d = data as { dejaLa?: boolean; motDePasseDefini?: boolean };
  return { dejaLa: Boolean(d?.dejaLa), motDePasseDefini: Boolean(d?.motDePasseDefini) };
}

export async function renvoyerInvitationParcours(clienteId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('acces-parcours-audio', {
    body: { clienteId, action: 'renvoyer' },
  });

  if (error) {
    throw new Error(
      (data as { error?: string })?.error ?? "L'invitation n'a pas pu être renvoyée.",
    );
  }
  return (data as { email?: string })?.email ?? '';
}

export interface CompteParcours {
  id: string;
  parcoursCode: string;
  compteActive: boolean;
  terminees: number;
  total: number;
  derniereActivite: string | null;
}

/** État du compte de la cliente côté Mon Parcours, ou null s'il n'existe pas. */
export async function etatParcours(clienteId: string): Promise<CompteParcours | null> {
  const { data, error } = await supabase.functions.invoke('acces-parcours-audio', {
    body: { clienteId, action: 'etat' },
  });
  if (error) return null;
  return ((data as { compte?: CompteParcours | null })?.compte ?? null) as CompteParcours | null;
}
