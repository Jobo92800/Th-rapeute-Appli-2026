import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, Check, ClipboardList, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  definirSeuils,
  enregistrerMouvement,
  mouvementsDuProduit,
  recalerStock,
} from '../../services/stock';
import { LIBELLES_MOTIF } from '../../domain/stock';
import type { EtatStock, MotifMouvement } from '../../types/db';

type Geste = 'entree' | 'sortie' | 'inventaire';

const GESTES: { id: Geste; libelle: string; icone: typeof Check }[] = [
  { id: 'entree', libelle: 'J’ai reçu', icone: ArrowDownToLine },
  { id: 'sortie', libelle: 'Ça sort', icone: ArrowUpFromLine },
  { id: 'inventaire', libelle: 'Je recompte', icone: ClipboardList },
];

const MOTIFS_SORTIE: MotifMouvement[] = ['offert', 'perte', 'usage_centre'];

interface Props {
  ligne: EtatStock;
  auteur: string;
  onFerme: () => void;
  onEnregistre: () => void;
}

/**
 * Le seul endroit où le rayon bouge à la main. Les ventes, elles, se
 * saisissent sur la fiche de la cliente : elles descendent le stock toutes
 * seules, sans qu'on ait à le refaire ici.
 */
export default function ModaleMouvement({ ligne, auteur, onFerme, onEnregistre }: Props) {
  const [geste, setGeste] = useState<Geste>('entree');
  const [quantite, setQuantite] = useState(1);
  const [compte, setCompte] = useState(ligne.quantite);
  const [motif, setMotif] = useState<MotifMouvement>('offert');
  const [note, setNote] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [seuilsOuverts, setSeuilsOuverts] = useState(false);
  const [seuilBas, setSeuilBas] = useState(ligne.seuil_bas);
  const [seuilCritique, setSeuilCritique] = useState(ligne.seuil_critique);

  const { data: historique = [] } = useQuery({
    queryKey: ['mouvements-produit', ligne.centre_id, ligne.produit_id],
    queryFn: () => mouvementsDuProduit(ligne.centre_id, ligne.produit_id, 10),
  });

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !enCours && onFerme();
    document.addEventListener('keydown', echap);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', echap);
      document.body.style.overflow = '';
    };
  }, [onFerme, enCours]);

  async function valider() {
    setEnCours(true);
    try {
      if (geste === 'inventaire') {
        const ecart = await recalerStock(ligne.produit_id, ligne.centre_id, compte, note);
        toast.success(
          ecart === 0
            ? 'Le comptage tombait juste, rien à corriger.'
            : `Écart de ${ecart > 0 ? '+' : ''}${ecart} enregistré.`,
        );
      } else {
        await enregistrerMouvement({
          centreId: ligne.centre_id,
          produitId: ligne.produit_id,
          sens: geste,
          quantite,
          motif: geste === 'entree' ? 'reception' : motif,
          note,
          auteur,
        });
        toast.success(
          geste === 'entree'
            ? `${quantite} ${ligne.unite}${quantite > 1 ? 's' : ''} ajoutée${quantite > 1 ? 's' : ''} au rayon`
            : `${quantite} sortie${quantite > 1 ? 's' : ''} du rayon`,
        );
      }
      onEnregistre();
      onFerme();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Le mouvement n'a pas pu être enregistré. Réessayez.",
      );
      setEnCours(false);
    }
  }

  async function enregistrerSeuils() {
    if (seuilCritique > seuilBas) {
      toast.error('Le seuil critique doit être inférieur ou égal au seuil d’alerte.');
      return;
    }
    try {
      await definirSeuils(ligne.produit_id, ligne.centre_id, seuilBas, seuilCritique);
      toast.success('Seuils enregistrés');
      onEnregistre();
    } catch (e) {
      console.error(e);
      toast.error("Les seuils n'ont pas pu être enregistrés.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Mouvement de stock — ${ligne.nom}`}
        className="my-4 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-carte"
      >
        <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ardoise-900">{ligne.nom}</h2>
            <p className="text-xs text-ardoise-500">
              {ligne.quantite} {ligne.unite}
              {Math.abs(ligne.quantite) > 1 ? 's' : ''} en rayon aujourd’hui
            </p>
          </div>
          <button
            onClick={onFerme}
            disabled={enCours}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-2">
            {GESTES.map(({ id, libelle, icone: Icone }) => (
              <button
                key={id}
                type="button"
                onClick={() => setGeste(id)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold transition ${
                  geste === id
                    ? 'border-marine-500 bg-marine-50 text-marine-800'
                    : 'border-ardoise-200 text-ardoise-600 hover:bg-ardoise-50'
                }`}
              >
                <Icone className="h-4 w-4" />
                {libelle}
              </button>
            ))}
          </div>

          {geste === 'inventaire' ? (
            <div>
              <label className="etiquette" htmlFor="compte">
                J’ai compté, dans le rayon
              </label>
              <input
                id="compte"
                type="number"
                min={0}
                className="champ"
                value={compte}
                onChange={(e) => setCompte(Math.max(0, Number(e.target.value)))}
              />
              <p className="mt-1.5 text-xs text-ardoise-500">
                L’écart avec le stock attendu ({ligne.quantite} {ligne.unite}
                {Math.abs(ligne.quantite) > 1 ? 's' : ''}) sera écrit comme un mouvement. Rien
                n’est réécrit : l’historique reste entier.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="etiquette" htmlFor="quantite">
                  Quantité
                </label>
                <input
                  id="quantite"
                  type="number"
                  min={1}
                  className="champ"
                  value={quantite}
                  onChange={(e) => setQuantite(Math.max(1, Number(e.target.value)))}
                />
              </div>

              {geste === 'sortie' && (
                <div>
                  <label className="etiquette" htmlFor="motif">
                    Pourquoi
                  </label>
                  <select
                    id="motif"
                    className="champ"
                    value={motif}
                    onChange={(e) => setMotif(e.target.value as MotifMouvement)}
                  >
                    {MOTIFS_SORTIE.map((m) => (
                      <option key={m} value={m}>
                        {LIBELLES_MOTIF[m]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="etiquette" htmlFor="note">
              Note (facultative)
            </label>
            <input
              id="note"
              className="champ"
              placeholder="Livraison du 12, carton abîmé…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {geste === 'sortie' && (
            <p className="rounded-lg bg-ardoise-50 px-3 py-2 text-xs text-ardoise-600">
              Une boîte vendue à une cliente ne se saisit pas ici : enregistrez-la sur sa fiche,
              onglet « Compléments ». Le rayon se décompte tout seul.
            </p>
          )}

          <div className="border-t border-ardoise-100 pt-3">
            <button
              type="button"
              onClick={() => setSeuilsOuverts((v) => !v)}
              className="text-xs font-semibold text-marine-700 hover:text-marine-800"
            >
              {seuilsOuverts ? 'Masquer les seuils d’alerte' : 'Régler les seuils d’alerte'}
            </button>

            {seuilsOuverts && (
              <div className="mt-3 grid items-end gap-3 sm:grid-cols-3">
                <div>
                  <label className="etiquette" htmlFor="seuil-bas">
                    Alerter à
                  </label>
                  <input
                    id="seuil-bas"
                    type="number"
                    min={0}
                    className="champ"
                    value={seuilBas}
                    onChange={(e) => setSeuilBas(Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <div>
                  <label className="etiquette" htmlFor="seuil-critique">
                    Critique à
                  </label>
                  <input
                    id="seuil-critique"
                    type="number"
                    min={0}
                    className="champ"
                    value={seuilCritique}
                    onChange={(e) => setSeuilCritique(Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <button type="button" onClick={enregistrerSeuils} className="bouton-discret">
                  Enregistrer les seuils
                </button>
              </div>
            )}
          </div>

          {historique.length > 0 && (
            <div className="border-t border-ardoise-100 pt-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ardoise-500">
                Derniers mouvements
              </h3>
              <ul className="divide-y divide-ardoise-100">
                {historique.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-ardoise-600">
                      {format(new Date(m.fait_le), 'd MMM yyyy', { locale: fr })} —{' '}
                      {LIBELLES_MOTIF[m.motif] ?? m.motif}
                    </span>
                    <span
                      className={`chiffres font-semibold ${
                        m.sens === 'entree' ? 'text-emerald-700' : 'text-ardoise-800'
                      }`}
                    >
                      {m.sens === 'entree' ? '+' : '−'}
                      {m.quantite}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-ardoise-200 px-5 py-4">
          <button onClick={onFerme} disabled={enCours} className="bouton-discret">
            Annuler
          </button>
          <button onClick={valider} disabled={enCours} className="bouton-principal">
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
