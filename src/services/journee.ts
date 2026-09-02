import { supabase } from '../lib/supabase';
import { finDeCure, type FinDeCure } from '../domain/stock';

/** Une échéance dépassée ou due aujourd'hui, avec de quoi rappeler la personne. */
export interface AEncaisser {
  id: string;
  cliente_id: string;
  cliente: string;
  telephone: string | null;
  montant: number;
  date_prevue: string;
  jours_de_retard: number;
}

/** Une cliente dont la boîte de compléments est finie, ou le sera bientôt. */
export interface ARenouveler {
  cliente_id: string;
  cliente: string;
  telephone: string | null;
  produit: string;
  fin: FinDeCure;
}

const jour = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Ce qu'il reste à encaisser aujourd'hui : les échéances dues ou dépassées,
 * nom et téléphone compris. Un montant en retard ne se relance pas — une
 * personne, si.
 */
export async function aEncaisser(centreId: string | null): Promise<AEncaisser[]> {
  let requete = supabase
    .from('echeances')
    .select(
      'id, montant, date_prevue, programme:programmes!inner(centre_id, statut, cliente:clientes!inner(id, prenom, nom, telephone, archivee_le))',
    )
    .in('statut', ['a_venir', 'impaye'])
    .lte('date_prevue', jour(new Date()))
    .order('date_prevue');

  if (centreId) requete = requete.eq('programme.centre_id', centreId);

  const { data, error } = await requete;
  if (error) throw error;

  const aujourdhui = new Date(jour(new Date()));

  return (data ?? [])
    .filter((e) => {
      const p = e.programme as unknown as {
        statut: string;
        cliente: { archivee_le: string | null };
      };
      // Une fiche archivée est sortie du suivi : on ne la relance pas.
      return p?.statut !== 'abandonne' && !p?.cliente?.archivee_le;
    })
    .map((e) => {
      const c = (e.programme as unknown as { cliente: Record<string, string> }).cliente;
      const prevue = new Date(e.date_prevue as string);

      return {
        id: e.id as string,
        cliente_id: c.id,
        cliente: `${c.prenom} ${c.nom}`,
        telephone: c.telephone ?? null,
        montant: Number(e.montant),
        date_prevue: e.date_prevue as string,
        jours_de_retard: Math.round((aujourdhui.getTime() - prevue.getTime()) / 86_400_000),
      };
    });
}

/**
 * Les compléments arrivés à leur fin, ou qui y arrivent dans la semaine.
 *
 * C'est une vente qui ne se déclenche pas toute seule : sans ce rappel,
 * personne ne sait qu'une cliente a fini sa boîte de BURN il y a trois
 * jours — et elle repart sans complément.
 */
export async function aRenouveler(centreId: string | null, dansJours = 7): Promise<ARenouveler[]> {
  const depuis = new Date();
  depuis.setMonth(depuis.getMonth() - 6);

  const [ventes, produits] = await Promise.all([
    (async () => {
      let r = supabase
        .from('ventes_complements')
        .select(
          'id, date_vente, quantite, produit, centre_id, cliente:clientes!inner(id, prenom, nom, telephone, archivee_le)',
        )
        .gte('date_vente', jour(depuis))
        .order('date_vente', { ascending: false });

      if (centreId) r = r.eq('centre_id', centreId);
      return r;
    })(),
    supabase.from('produits_stock').select('code, nom, jours_par_boite'),
  ]);

  if (ventes.error) throw ventes.error;

  const catalogue = new Map(
    (produits.data ?? []).map((p) => [p.code as string, p as { nom: string; jours_par_boite: number | null }]),
  );

  /*
    Une cliente peut racheter plusieurs fois le même complément : seule la
    dernière boîte compte, sinon on la relancerait pour une cure qu'elle a
    déjà renouvelée.
  */
  const derniere = new Map<string, ARenouveler>();

  for (const v of ventes.data ?? []) {
    const c = v.cliente as unknown as Record<string, string | null>;
    if (c.archivee_le) continue;

    const produit = catalogue.get(v.produit as string);
    if (!produit?.jours_par_boite) continue;

    const cle = `${c.id}-${v.produit}`;
    if (derniere.has(cle)) continue;

    const fin = finDeCure(v.date_vente as string, Number(v.quantite), produit.jours_par_boite);
    if (fin.joursRestants == null || fin.joursRestants > dansJours) continue;

    derniere.set(cle, {
      cliente_id: c.id as string,
      cliente: `${c.prenom} ${c.nom}`,
      telephone: c.telephone ?? null,
      produit: produit.nom,
      fin,
    });
  }

  return [...derniere.values()].sort(
    (a, b) => (a.fin.joursRestants ?? 0) - (b.fin.joursRestants ?? 0),
  );
}

/** Les séances clôturées aujourd'hui, pour savoir où en est la journée. */
export async function seancesDuJour(centreId: string | null): Promise<number> {
  let requete = supabase
    .from('seances')
    .select('*', { count: 'exact', head: true })
    .eq('cloturee', true)
    .eq('date_seance', jour(new Date()));

  if (centreId) requete = requete.eq('centre_id', centreId);

  const { count, error } = await requete;
  if (error) throw error;
  return count ?? 0;
}
