import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Loader2, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { definirExceptionCure } from '../../services/clientes';
import type { Cliente } from '../../types/db';

/**
 * L'exception de cure d'une cliente : pathologie, contre-indication,
 * consigne impérative.
 *
 * Elle ne se range pas dans les notes. Une note se lit quand on pense à
 * ouvrir l'onglet ; une exception doit être vue sans avoir été cherchée.
 * D'où le rouge, la place en tête de fiche, et le fait qu'elle reste
 * affichée quel que soit l'onglet ouvert.
 */
export default function ExceptionCure({
  cliente,
  mode,
}: {
  cliente: Cliente;
  /**
   * « bouton » : le geste de création, dans l'en-tête, quand il n'y a rien
   * à signaler. « bandeau » : l'alerte rouge elle-même, sous l'en-tête.
   * Le même composant tient les deux, mais jamais les deux à la fois — un
   * avertissement affiché deux fois n'avertit plus.
   */
  mode: 'bouton' | 'bandeau';
}) {
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState(cliente.exception_cure ?? '');
  const [enCours, setEnCours] = useState(false);

  const exception = cliente.exception_cure?.trim() ?? '';

  async function enregistrer() {
    setEnCours(true);
    try {
      await definirExceptionCure(cliente.id, texte);
      qc.invalidateQueries({ queryKey: ['cliente', cliente.id] });
      qc.invalidateQueries({ queryKey: ['clientes'] });
      setOuvert(false);
      toast.success(texte.trim() ? 'Exception enregistrée' : 'Exception retirée');
    } catch {
      toast.error("L'exception n'a pas pu être enregistrée.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      {exception && mode === 'bandeau' && (
        <section className="flex items-start gap-3 rounded-2xl border-2 border-rose-500 bg-rose-50 px-4 py-3.5">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-rose-700">
              Exception cure
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-relaxed text-rose-900">
              {exception}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setTexte(exception);
              setOuvert(true);
            }}
            className="shrink-0 rounded-lg p-1.5 text-rose-600 hover:bg-rose-100"
            aria-label="Modifier l'exception"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </section>
      )}

      {!exception && mode === 'bouton' && (
        <button
          type="button"
          onClick={() => {
            setTexte('');
            setOuvert(true);
          }}
          className="bouton-discret border-rose-200 text-rose-700 hover:bg-rose-50"
        >
          <AlertOctagon className="h-4 w-4" />
          Exception cure
        </button>
      )}

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Exception de cure"
            className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-carte"
          >
            <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-ardoise-900">
                  Exception cure — {cliente.prenom} {cliente.nom}
                </h2>
                <p className="text-xs text-ardoise-500">
                  Pathologie, contre-indication, consigne impérative.
                </p>
              </div>
              <button
                onClick={() => setOuvert(false)}
                disabled={enCours}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5">
              <label className="etiquette" htmlFor="exception">
                Ce que toute l’équipe doit savoir
              </label>
              <textarea
                id="exception"
                rows={4}
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                placeholder="Pacemaker — pas d’électrostimulation. Prévenir avant toute séance."
                className="champ resize-y"
              />
              <p className="mt-2 text-xs text-ardoise-500">
                Ce texte s’affiche en rouge sur sa fiche et signale la cliente dans la liste. Il
                remplace l’exception précédente : c’est l’état actuel qui compte, pas l’historique.
                Videz le champ pour la retirer.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-ardoise-200 px-5 py-4">
              <button onClick={() => setOuvert(false)} disabled={enCours} className="bouton-discret">
                Annuler
              </button>
              <button onClick={enregistrer} disabled={enCours} className="bouton-fort">
                {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
                {texte.trim() ? 'Enregistrer' : "Retirer l'exception"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
