import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, OctagonX, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { arreterCure } from '../../services/avoirs';
import { decompterArret, resteAEncaisser } from '../../domain/avoir';
import { LIBELLES_TECHNOLOGIE, formaterEuros } from '../../domain/tarification';
import type { Echeance, LigneProgramme, Programme, SuiviSeances } from '../../types/db';

/**
 * Arrêter une cure en cours de route.
 *
 * Le décompte est montré avant tout : ce qu'elle a payé, ce qu'elle a
 * réellement reçu, et la différence. C'est ce qui permet d'annoncer un
 * montant à la cliente sans le calculer de tête au comptoir.
 *
 * Le montant proposé reste modifiable. Un arrangement, un geste commercial,
 * une séance offerte pour finir en bons termes : rien de tout cela ne se
 * devine depuis une table, et c'est la thérapeute qui tranche.
 */
export default function ModaleArretCure({
  programme,
  lignes,
  suivi,
  echeances,
  clienteId,
  centreId,
  onFerme,
}: {
  programme: Programme;
  lignes: LigneProgramme[];
  suivi: SuiviSeances[];
  echeances: Echeance[];
  clienteId: string;
  centreId: string;
  onFerme: () => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);

  const decompte = useMemo(
    () =>
      decompterArret(
        programme,
        lignes,
        suivi,
        echeances,
        (t) => LIBELLES_TECHNOLOGIE[t as keyof typeof LIBELLES_TECHNOLOGIE] ?? t,
      ),
    [programme, lignes, suivi, echeances],
  );

  const [avoir, setAvoir] = useState(String(decompte.suggere));
  const montantAvoir = Number(avoir.replace(',', '.')) || 0;
  const abandonne = resteAEncaisser(echeances);

  async function valider() {
    if (montantAvoir < 0) {
      toast.error('Un avoir ne peut pas être négatif.');
      return;
    }
    setEnCours(true);
    try {
      await arreterCure(programme.id, motif.trim(), montantAvoir, date);
      qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
      qc.invalidateQueries({ queryKey: ['avoir', clienteId] });
      qc.invalidateQueries({ queryKey: ['situations', centreId] });
      toast.success(
        montantAvoir > 0
          ? `Cure arrêtée · avoir de ${formaterEuros(montantAvoir, 2)}`
          : 'Cure arrêtée',
      );
      onFerme();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La cure n'a pas pu être arrêtée.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Arrêter la cure"
        className="my-8 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-carte"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ardoise-200 px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
              <OctagonX className="h-4 w-4 text-rose-600" />
              Arrêter la cure {programme.numero}
            </h2>
            <p className="text-xs text-ardoise-500">
              Elle sortira des comptes. Rien n’est effacé, et le geste se défait.
            </p>
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

        <div className="space-y-5 p-5">
          <section>
            <h3 className="surtitre mb-2">Le décompte</h3>
            <div className="rounded-xl border border-ardoise-200">
              <div className="flex items-center justify-between border-b border-ardoise-100 px-4 py-2.5 text-sm">
                <span className="text-ardoise-700">Elle a réglé</span>
                <span className="chiffres font-semibold text-ardoise-900">
                  {formaterEuros(decompte.encaisse, 2)}
                </span>
              </div>

              {decompte.detail.length === 0 ? (
                <p className="px-4 py-2.5 text-sm text-ardoise-500">
                  Elle n’a rien consommé : aucune séance faite, rien d’emporté.
                </p>
              ) : (
                decompte.detail.map((d) => (
                  <div
                    key={d.libelle}
                    className="flex items-center justify-between px-4 py-1.5 text-sm"
                  >
                    <span className="text-ardoise-600">{d.libelle}</span>
                    <span className="chiffres text-ardoise-500">
                      − {formaterEuros(d.montant, 2)}
                    </span>
                  </div>
                ))
              )}

              <div className="flex items-center justify-between border-t border-ardoise-200 px-4 py-2.5 text-sm">
                <span className="font-semibold text-ardoise-800">
                  {decompte.duRestant > 0 ? 'Elle doit encore' : 'Différence en sa faveur'}
                </span>
                <span
                  className={`chiffres text-lg font-bold ${
                    decompte.duRestant > 0 ? 'text-rose-600' : 'text-marine-800'
                  }`}
                >
                  {formaterEuros(decompte.duRestant > 0 ? decompte.duRestant : decompte.suggere, 2)}
                </span>
              </div>
            </div>

            {decompte.duRestant > 0 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Elle a reçu plus qu’elle n’a payé. Il n’y a donc pas d’avoir à lui faire — à vous
                de voir si vous réclamez la différence ou si vous passez l’éponge.
              </p>
            )}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiquette" htmlFor="date-arret">
                Arrêtée le
              </label>
              <input
                id="date-arret"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="champ"
              />
            </div>
            <div>
              <label className="etiquette" htmlFor="montant-avoir">
                Avoir à lui faire
              </label>
              <div className="relative">
                <input
                  id="montant-avoir"
                  type="text"
                  inputMode="decimal"
                  value={avoir}
                  onChange={(e) => setAvoir(e.target.value)}
                  className="champ pr-7 chiffres"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ardoise-400">
                  €
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="etiquette" htmlFor="motif-arret">
              Pourquoi elle s’arrête
            </label>
            <textarea
              id="motif-arret"
              rows={2}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Déménagement à Toulouse. Souhaite reprendre plus tard."
              className="champ resize-y"
            />
            <p className="mt-1.5 text-xs text-ardoise-500">
              Écrivez-le pour la suivante : dans six mois, « cure abandonnée » sans autre
              explication ne se rattrape pas.
            </p>
          </div>

          <ul className="space-y-1 rounded-xl bg-ardoise-50 px-4 py-3 text-xs text-ardoise-600">
            <li>
              <strong className="font-semibold text-ardoise-800">
                {formaterEuros(abandonne, 2)}
              </strong>{' '}
              d’échéances non réglées seront annulées : on ne réclame plus rien.
            </li>
            <li>La cure disparaît de « à encaisser », des retards et du tableau de bord.</li>
            <li>Ses séances, son bilan et ses documents restent sur sa fiche.</li>
            {montantAvoir > 0 && (
              <li>
                Son avoir de{' '}
                <strong className="font-semibold text-ardoise-800">
                  {formaterEuros(montantAvoir, 2)}
                </strong>{' '}
                sera utilisable sur une prochaine cure, dans n’importe lequel des 5 centres, ou
                remboursable en argent.
              </li>
            )}
          </ul>
        </div>

        <div className="flex justify-end gap-3 border-t border-ardoise-200 px-5 py-4">
          <button onClick={onFerme} disabled={enCours} className="bouton-discret">
            Annuler
          </button>
          <button
            onClick={valider}
            disabled={enCours}
            className="bouton-fort bg-rose-600 hover:bg-rose-700"
          >
            {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
            Arrêter la cure
          </button>
        </div>
      </div>
    </div>
  );
}
