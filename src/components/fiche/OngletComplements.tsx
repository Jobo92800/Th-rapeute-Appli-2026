import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Package, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ajouterVente,
  lireGrilleTarifaire,
  programmesDeLaCliente,
  supprimerVente,
  ventesDeLaCliente,
} from '../../services/metier';
import { etatDuCentre } from '../../services/stock';
import { finDeCure, libelleFinDeCure } from '../../domain/stock';
import { formaterEuros } from '../../domain/tarification';
import type { EtatStock, ProduitComplement, VenteComplement } from '../../types/db';

interface Props {
  clienteId: string;
  centreId: string;
}

/**
 * Les compléments d'une cliente : ce qu'elle a acheté, quand sa boîte sera
 * finie, et — c'est la nouveauté — le rayon du centre qui se décompte tout
 * seul. En V1 les deux vivaient séparément et le stock devenait faux.
 */
export default function OngletComplements({ clienteId, centreId }: Props) {
  const qc = useQueryClient();
  const [saisieOuverte, setSaisieOuverte] = useState(false);

  const { data: ventes = [], isLoading } = useQuery({
    queryKey: ['ventes', clienteId],
    queryFn: () => ventesDeLaCliente(clienteId),
  });

  const { data: rayon = [], error: erreurRayon } = useQuery({
    queryKey: ['stock', centreId],
    queryFn: () => etatDuCentre(centreId),
  });

  const { data: grille } = useQuery({
    queryKey: ['tarifs'],
    queryFn: lireGrilleTarifaire,
    staleTime: 5 * 60_000,
  });

  const { data: programmes = [] } = useQuery({
    queryKey: ['programmes', clienteId],
    queryFn: () => programmesDeLaCliente(clienteId),
  });

  const complements = useMemo(
    () => rayon.filter((l) => l.categorie === 'complement'),
    [rayon],
  );

  const cureEnCours = programmes.at(-1)?.programme ?? null;

  const suppression = useMutation({
    mutationFn: supprimerVente,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ventes', clienteId] });
      qc.invalidateQueries({ queryKey: ['stock', centreId] });
      toast.success('Vente supprimée, la boîte revient au rayon');
    },
    onError: () => toast.error("La vente n'a pas pu être supprimée."),
  });

  if (erreurRayon) {
    return (
      <div className="carte flex items-start gap-3 border-amber-200 bg-amber-50 p-5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-900">
          Le catalogue des compléments n’existe pas encore dans la base. Passez la migration 015
          dans l’éditeur SQL de Supabase (projet MAbeautyplus V2), puis rechargez cette page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {cureEnCours?.complement_recommande && (
        <p className="rounded-lg border border-marine-200 bg-marine-50 px-4 py-2.5 text-sm text-marine-900">
          Recommandé au bilan : <strong>{cureEnCours.complement_recommande}</strong>
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {complements.map((c) => (
          <RecapProduit key={c.produit_id} produit={c} ventes={ventes} />
        ))}
      </section>

      <section className="carte">
        <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ardoise-900">Ventes enregistrées</h2>
          <button
            type="button"
            onClick={() => setSaisieOuverte((v) => !v)}
            className="bouton-discret"
          >
            {saisieOuverte ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saisieOuverte ? 'Annuler' : 'Ajouter un complément'}
          </button>
        </div>

        {saisieOuverte && (
          <FormulaireVente
            complements={complements}
            prixParDefaut={grille?.complement ?? 37}
            onEnregistrer={async (saisie) => {
              await ajouterVente({
                cliente_id: clienteId,
                centre_id: centreId,
                programme_id: cureEnCours?.id ?? null,
                date_vente: saisie.date,
                produit: saisie.produit,
                quantite: saisie.quantite,
                prix_unitaire: saisie.prix,
              });
              qc.invalidateQueries({ queryKey: ['ventes', clienteId] });
              qc.invalidateQueries({ queryKey: ['stock', centreId] });
              qc.invalidateQueries({ queryKey: ['mouvements', centreId] });
              setSaisieOuverte(false);
              toast.success('Vente enregistrée, le rayon est à jour');
            }}
          />
        )}

        {isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-ardoise-400">Chargement…</p>
        ) : ventes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ardoise-500">
            Aucune vente de complément pour cette cliente.
          </p>
        ) : (
          <ul className="divide-y divide-ardoise-100">
            {ventes.map((v) => {
              const produit = complements.find((c) => c.code === v.produit);
              const echeance = finDeCure(v.date_vente, v.quantite, produit?.jours_par_boite ?? null);

              return (
                <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ardoise-900">
                      {produit?.nom ?? v.produit} · {v.quantite} boîte{v.quantite > 1 ? 's' : ''}
                    </span>
                    <span className="block text-xs text-ardoise-500">
                      {format(new Date(v.date_vente), 'd MMM yyyy', { locale: fr })} ·{' '}
                      {formaterEuros(v.quantite * Number(v.prix_unitaire))}
                      {echeance.fin
                        ? ` · fin le ${format(echeance.fin, 'd MMM yyyy', { locale: fr })}`
                        : ''}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        echeance.joursRestants === null
                          ? 'border-ardoise-200 bg-ardoise-50 text-ardoise-600'
                          : echeance.terminee
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {libelleFinDeCure(echeance)}
                    </span>
                    <button
                      type="button"
                      aria-label="Supprimer cette vente"
                      onClick={() => {
                        if (!confirm('Supprimer cette vente ? La boîte revient au rayon.')) return;
                        suppression.mutate(v.id);
                      }}
                      className="rounded-lg p-1.5 text-ardoise-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Une carte par complément : ce qu'elle a pris, et où en est sa cure. */
function RecapProduit({ produit, ventes }: { produit: EtatStock; ventes: VenteComplement[] }) {
  const siennes = ventes.filter((v) => v.produit === produit.code);
  const total = siennes.reduce((n, v) => n + v.quantite, 0);
  const derniere = siennes[0]; // les ventes arrivent de la plus récente à la plus ancienne

  const echeance = derniere
    ? finDeCure(derniere.date_vente, derniere.quantite, produit.jours_par_boite)
    : null;

  return (
    <div className="carte p-4">
      <p className="text-sm font-semibold text-ardoise-900">{produit.nom}</p>
      <p className="chiffres mt-1 text-2xl font-bold text-marine-700">{total}</p>
      <p className="mt-1 text-xs text-ardoise-500">
        {total === 0
          ? 'Jamais vendu à cette cliente'
          : echeance
            ? libelleFinDeCure(echeance)
            : 'Pas d’échéance'}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ardoise-400">
        <Package className="h-3 w-3" />
        {produit.quantite} en rayon
      </p>
    </div>
  );
}

interface SaisieVente {
  date: string;
  produit: ProduitComplement;
  quantite: number;
  prix: number;
}

function FormulaireVente({
  complements,
  prixParDefaut,
  onEnregistrer,
}: {
  complements: EtatStock[];
  prixParDefaut: number;
  onEnregistrer: (v: SaisieVente) => Promise<void>;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [produit, setProduit] = useState<ProduitComplement | ''>('');
  const [quantite, setQuantite] = useState(1);
  const [prix, setPrix] = useState(prixParDefaut);
  const [enCours, setEnCours] = useState(false);

  const enRayon = complements.find((c) => c.code === produit);
  const manque = enRayon ? quantite - enRayon.quantite : 0;

  async function valider() {
    if (!produit) {
      toast.error('Choisissez un complément.');
      return;
    }
    setEnCours(true);
    try {
      await onEnregistrer({ date, produit, quantite, prix });
      setProduit('');
      setQuantite(1);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "La vente n'a pas pu être enregistrée.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-3 border-b border-ardoise-100 bg-ardoise-50 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="etiquette" htmlFor="vente-date">
            Date
          </label>
          <input
            id="vente-date"
            type="date"
            className="champ"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="vente-produit">
            Complément
          </label>
          <select
            id="vente-produit"
            className="champ"
            value={produit}
            onChange={(e) => setProduit(e.target.value as ProduitComplement)}
          >
            <option value="">Choisir…</option>
            {complements.map((c) => (
              <option key={c.produit_id} value={c.code}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="vente-quantite">
            Boîtes
          </label>
          <input
            id="vente-quantite"
            type="number"
            min={1}
            className="champ"
            value={quantite}
            onChange={(e) => setQuantite(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="vente-prix">
            Prix la boîte
          </label>
          <input
            id="vente-prix"
            type="number"
            min={0}
            step="0.01"
            className="champ"
            value={prix}
            onChange={(e) => setPrix(Math.max(0, Number(e.target.value)))}
          />
        </div>
      </div>

      {manque > 0 && (
        <p className="flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Il n’en reste que {enRayon?.quantite} en rayon. La vente s’enregistre quand même — le
          stock passera en négatif, ce qui veut dire qu’un comptage est à refaire.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ardoise-500">
          {quantite} × {formaterEuros(prix)} = <strong>{formaterEuros(quantite * prix)}</strong>
        </p>
        <button type="button" onClick={valider} disabled={enCours} className="bouton-principal">
          Enregistrer
        </button>
      </div>
    </div>
  );
}
