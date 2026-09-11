import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { lireBareme } from '../../services/metier';
import { relireLesReponses, type ReponseLue } from '../../domain/bioportrait';
import { texteErreur } from '../../lib/erreurs';
import type { Bilan } from '../../types/db';

/**
 * Ce que la cliente a répondu au questionnaire, question par question.
 *
 * Le BioPortrait est une synthèse : deux mots et dix jauges. Quand une
 * thérapeute s'étonne d'un terrain — « Hormonal, vraiment ? » — c'est ici
 * qu'elle retrouve ce qui l'a produit, dans les mots de la cliente. Les
 * réponses sont rangées par thème, dans l'ordre où elles ont été posées.
 *
 * Le questionnaire se relit dans SA version : un bilan de la v2 avec le
 * barème 3 décalerait les questions d'un cran.
 */
export default function ReponsesDuBilan({ bilan, onFermer }: { bilan: Bilan; onFermer: () => void }) {
  const { data: bareme, isLoading, error } = useQuery({
    queryKey: ['bareme', bilan.bareme_version],
    queryFn: () => lireBareme(bilan.bareme_version),
    staleTime: Infinity,
  });

  const lues = bareme ? relireLesReponses(bareme, bilan.reponses ?? {}, bilan.curseur ?? null) : [];

  /* Groupées par thème, dans l'ordre d'apparition. */
  const parTheme: Array<{ theme: string; lignes: ReponseLue[] }> = [];
  for (const r of lues) {
    const dernier = parTheme[parTheme.length - 1];
    if (dernier && dernier.theme === r.theme) dernier.lignes.push(r);
    else parTheme.push({ theme: r.theme, lignes: [r] });
  }

  return (
    <section className="carte">
      <div className="flex items-start justify-between gap-3 border-b border-ardoise-100 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-ardoise-900">Ses réponses au questionnaire</h2>
          <p className="text-xs text-ardoise-500">
            Bilan du {format(new Date(bilan.date_bilan), 'd MMMM yyyy', { locale: fr })} · telles
            qu{'’'}elles ont été données ce jour-là
          </p>
        </div>
        <button type="button" onClick={onFermer} className="bouton-discret text-xs" aria-label="Fermer">
          <X className="h-4 w-4" />
          Fermer
        </button>
      </div>

      {isLoading ? (
        <p className="px-5 py-8 text-center text-sm text-ardoise-400">Chargement…</p>
      ) : error ? (
        <p className="px-5 py-6 text-sm text-rose-700">
          Les réponses n{'’'}ont pas pu être relues : {texteErreur(error)}
        </p>
      ) : lues.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ardoise-500">
          Aucune réponse enregistrée sur ce bilan.
        </p>
      ) : (
        <div className="divide-y divide-ardoise-100">
          {parTheme.map((groupe) => (
            <div key={groupe.theme} className="px-5 py-4">
              <h3 className="mb-2 text-2xs font-semibold uppercase tracking-widest text-marine-700">
                {groupe.theme}
              </h3>
              <dl className="space-y-2.5">
                {groupe.lignes.map((r, i) => (
                  <div key={i} className="grid gap-0.5 sm:grid-cols-[1fr_minmax(0,18rem)] sm:gap-4">
                    <dt className="text-sm text-ardoise-600">{r.question}</dt>
                    <dd className="text-sm font-semibold text-ardoise-900">
                      {r.curseur ? (
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-normal text-ardoise-500">{r.curseur.gauche}</span>
                          <span className="relative h-1.5 flex-1 rounded-full bg-ardoise-200">
                            <span
                              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-marine-600"
                              style={{ left: `${r.curseur.valeur}%` }}
                            />
                          </span>
                          <span className="text-xs font-normal text-ardoise-500">{r.curseur.droite}</span>
                        </span>
                      ) : r.reponses.length === 0 ? (
                        <span className="font-normal text-ardoise-400">—</span>
                      ) : (
                        r.reponses.join(' · ')
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
