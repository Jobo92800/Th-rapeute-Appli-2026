import { supabase } from '../lib/supabase';
import type { Bareme } from '../domain/empreinte';
import type {
  Bilan,
  Echeance,
  Jeu,
  LigneProgramme,
  Mensuration,
  Programme,
  Seance,
  SuiviSeances,
  Technologie,
  VenteComplement,
} from '../types/db';
import type { GrilleTarifaire } from '../domain/tarification';

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
  prixGuide: number;
  prixTenue: number;
  montantTotal: number;
  modeReglement: Programme['mode_reglement'];
  fraisFinancement: number;
  echeances: Array<{ rang: number; montant: number }>;
  complementRecommande: string | null;
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
      guide: true,
      prix_guide: n.prixGuide,
      prix_tenue: n.electro ? n.prixTenue : 0,
      montant_total: n.montantTotal,
      mode_reglement: n.modeReglement,
      frais_financement: n.fraisFinancement,
      complement_recommande: n.complementRecommande,
      date_validation: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) throw error;

  const lignes = n.lignes
    .filter((l) => l.seances > 0)
    .map((l) => ({
      programme_id: programme.id,
      technologie: l.technologie,
      seances_prevues: l.seances,
      prix_unitaire: l.prixUnitaire,
    }));

  if (lignes.length > 0) {
    const { error: e } = await supabase.from('programme_lignes').insert(lignes);
    if (e) throw e;
  }

  if (n.echeances.length > 0) {
    const { error: e } = await supabase.from('echeances').insert(
      n.echeances.map((ech) => ({
        programme_id: programme.id,
        type: 'echeance' as const,
        rang: ech.rang,
        montant: ech.montant,
      })),
    );
    if (e) throw e;
  }

  return programme as Programme;
}

export async function majEcheance(id: string, patch: Partial<Echeance>): Promise<void> {
  const { error } = await supabase.from('echeances').update(patch).eq('id', id);
  if (error) throw error;
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
