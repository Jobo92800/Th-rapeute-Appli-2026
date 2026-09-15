import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { texteErreur } from '../../lib/erreurs';
import { effacerLesFichesDeTest, listerLesFichesDeTest } from '../../services/clientes';

/**
 * Effacer toutes les fiches de test d'un coup.
 *
 * Le geste du script, avec le même garde-fou : on montre d'abord la liste
 * exacte de ce qui va partir — LISEZ-LA — et on fait retaper un mot. La
 * règle ne change pas : les fiches nées dans la V2 dont le nom ou le
 * prénom contient « test », rien d'autre. Une vraie cliente qui
 * s'appellerait Testard n'existe pas encore ; le jour où c'est le cas, la
 * liste le montrera avant qu'on clique.
 */
export default function ModaleFichesDeTest({ onFerme }: { onFerme: () => void }) {
  const qc = useQueryClient();
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);

  const { data: fiches = [], isLoading, error } = useQuery({
    queryKey: ['fiches-de-test'],
    queryFn: listerLesFichesDeTest,
  });

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !enCours && onFerme();
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [onFerme, enCours]);

  const confirme = saisie.trim().toLowerCase() === 'effacer';

  async function effacer() {
    setEnCours(true);
    try {
      const { effacees, airtableRestees } = await effacerLesFichesDeTest();
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['situations'] });
      qc.invalidateQueries({ queryKey: ['tableau-de-bord'] });
      qc.invalidateQueries({ queryKey: ['fiches-de-test'] });
      toast.success(`${effacees} fiche${effacees > 1 ? 's' : ''} de test effacée${effacees > 1 ? 's' : ''}`);
      if (airtableRestees.length > 0) {
        toast(
          `Copies restées dans Airtable, à supprimer à la main : ${airtableRestees.join(', ')}`,
          { duration: 12000, icon: '⚠️' },
        );
      }
      onFerme();
    } catch (e) {
      toast.error(texteErreur(e) || "Les fiches n'ont pas pu être effacées.");
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Effacer les fiches de test"
        className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-carte"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ardoise-200 px-5 py-3.5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <h2 className="text-sm font-semibold text-ardoise-900">Effacer les fiches de test</h2>
              <p className="text-xs text-ardoise-500">
                Les fiches nées ici dont le nom ou le prénom contient « test ». Définitif, avec tout
                leur dossier, et leur copie dans Airtable.
              </p>
            </div>
          </div>
          <button
            onClick={onFerme}
            disabled={enCours}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-ardoise-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Recherche des fiches de test…
            </p>
          ) : error ? (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {texteErreur(error)}
            </p>
          ) : fiches.length === 0 ? (
            <p className="rounded-lg bg-ardoise-50 px-3 py-2 text-sm text-ardoise-600">
              Aucune fiche de test : rien à effacer.
            </p>
          ) : (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-900">
                {fiches.length} fiche{fiches.length > 1 ? 's' : ''} vont partir — lisez la liste
              </p>
              <ul className="mt-1.5 max-h-64 space-y-0.5 overflow-y-auto text-sm text-rose-800">
                {fiches.map((f) => (
                  <li key={f.id} className="flex justify-between gap-3">
                    <span>
                      {f.fiche}
                      {f.cures > 0 && (
                        <span className="text-rose-700/70"> · {f.cures} cure{f.cures > 1 ? 's' : ''}</span>
                      )}
                      {f.airtable_record_id && <span className="text-rose-700/70"> · dans Airtable</span>}
                    </span>
                    <span className="chiffres shrink-0 text-rose-700/70">
                      {format(new Date(f.cree_le), 'd MMM', { locale: fr })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fiches.length > 0 && (
            <div>
              <label htmlFor="confirmation-test" className="etiquette">
                Tapez « effacer » pour confirmer
              </label>
              <input
                id="confirmation-test"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                autoComplete="off"
                className="champ"
                placeholder="effacer"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ardoise-200 px-5 py-4">
          <button onClick={onFerme} disabled={enCours} className="bouton-discret">
            {fiches.length === 0 ? 'Fermer' : 'Annuler'}
          </button>
          {fiches.length > 0 && (
            <button
              onClick={effacer}
              disabled={!confirme || enCours}
              className="bouton bg-rose-600 text-white hover:bg-rose-700"
            >
              {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {enCours ? 'Effacement…' : `Effacer ${fiches.length} fiche${fiches.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
