import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { HeartPulse, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { enregistrerSante } from '../../services/clientes';
import { estFeminin } from '../../domain/civilite';
import {
  LIBRES,
  questionsOuiNon,
  reponseLibre,
  reponseOuiNon,
  type Sante,
} from '../../domain/sante';
import type { Cliente } from '../../types/db';

/**
 * Le bilan santé, sous le BioPortrait.
 *
 * Il n'entre dans aucun calcul — le BioPortrait, la prescription et le prix
 * l'ignorent. Il sert à la thérapeute avant une séance : savoir qu'une
 * cliente est enceinte, sous anticoagulant ou opérée depuis trois mois
 * change la façon de la recevoir, sans rien changer à sa cure.
 *
 * Ce qui doit BLOQUER un soin ne se met pas ici mais en exception cure, où
 * c'est rouge et impossible à manquer. La carte le rappelle, parce que la
 * confusion serait dangereuse.
 */
export default function BilanSante({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [saisie, setSaisie] = useState<Sante>(cliente.sante ?? {});

  /*
    On ne se recale que sur ce qui est vraiment enregistré, jamais sur la
    simple arrivée d'une réponse du serveur : la fiche est rechargée par
    quantité de gestes voisins — une note écrite, une séance clôturée — et
    chacun rendrait un nouvel objet `sante`. Se recaler dessus effacerait
    sous les doigts ce que la thérapeute est en train de taper.
  */
  useEffect(() => {
    setSaisie(cliente.sante ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id, cliente.sante_maj_le]);

  const femme = estFeminin(cliente.civilite);
  const questions = questionsOuiNon(femme);
  const modifie = JSON.stringify(saisie) !== JSON.stringify(cliente.sante ?? {});

  const enregistrer = useMutation({
    mutationFn: () => enregistrerSante(cliente.id, saisie),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente', cliente.id] });
      toast.success('Bilan santé enregistré');
    },
    onError: () => toast.error("Le bilan santé n'a pas pu être enregistré."),
  });

  function repondre(cle: string, valeur: boolean | string) {
    setSaisie((s) => ({ ...s, [cle]: valeur }));
  }

  return (
    <section className="carte">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ardoise-100 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
            <HeartPulse className="h-4 w-4 text-marine-700" />
            Bilan santé
          </h2>
          <p className="mt-0.5 text-xs text-ardoise-500">
            Le contexte à connaître avant une séance. Il n’entre dans aucun calcul.
          </p>
        </div>
        {cliente.sante_maj_le && (
          <span className="text-xs text-ardoise-400">
            Mis à jour le {format(new Date(cliente.sante_maj_le), 'd MMMM yyyy', { locale: fr })}
          </span>
        )}
      </div>

      <div className="grid gap-x-10 gap-y-5 px-5 py-5 lg:grid-cols-2">
        <div className="space-y-1">
          {questions.map((q) => {
            const valeur = reponseOuiNon(saisie, q.cle);
            return (
              <div
                key={q.cle}
                className="flex items-center justify-between gap-4 border-b border-ardoise-50 py-1.5 last:border-0"
              >
                <span className="text-sm text-ardoise-700">{q.libelle}</span>
                <div className="flex shrink-0 gap-1.5">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => repondre(q.cle, v)}
                      aria-pressed={valeur === v}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        valeur === v
                          ? v
                            ? 'border-rose-500 bg-rose-500 text-white'
                            : 'border-marine-600 bg-marine-600 text-white'
                          : 'border-ardoise-200 bg-white text-ardoise-500 hover:border-marine-400'
                      }`}
                    >
                      {v ? 'Oui' : 'Non'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          {LIBRES.map((q) => (
            <div key={q.cle}>
              <label className="etiquette" htmlFor={`sante-${q.cle}`}>
                {q.libelle}
              </label>
              <input
                id={`sante-${q.cle}`}
                value={reponseLibre(saisie, q.cle)}
                onChange={(e) => repondre(q.cle, e.target.value)}
                placeholder={q.exemple}
                className="champ"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ardoise-100 px-5 py-3.5">
        <p className="max-w-xl text-xs text-ardoise-500">
          Ce qui doit <strong>empêcher</strong> un soin ne se note pas ici : mettez-le en{' '}
          <strong>exception cure</strong>, en haut de la fiche, où c’est rouge et impossible à
          manquer.
        </p>
        <button
          onClick={() => enregistrer.mutate()}
          disabled={!modifie || enregistrer.isPending}
          className="bouton-principal"
        >
          {enregistrer.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {modifie ? 'Enregistrer' : 'Enregistré'}
        </button>
      </div>
    </section>
  );
}
