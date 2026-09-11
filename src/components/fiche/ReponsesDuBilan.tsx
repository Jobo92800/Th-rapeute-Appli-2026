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
 * qu'elle retrouve ce qui l'a produit, dans les mots de la cliente.
 *
 * La mise en page reprend celle du questionnaire : chaque thème porte sa
 * couleur, et la réponse choisie s'affiche en pastille de cette couleur,
 * juste sous sa question. Une première version alignait question à gauche
 * et réponse à droite, à quarante centimètres l'une de l'autre : l'œil
 * faisait l'aller-retour à chaque ligne et n'en gardait rien. Sur deux
 * colonnes, sept thèmes se lisent d'un regard.
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

  const couleurs = (cle: string): Couleurs => {
    const c = bareme?.CAT?.[cle];
    return c ? { fond: c[1], encre: c[2] } : { fond: '#EEF2F2', encre: '#3A5556' };
  };

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
        <CorpsDesReponses lues={lues} couleurs={couleurs} />
      )}
    </section>
  );
}

type Couleurs = { fond: string; encre: string };

/** Le rendu seul, sans réseau : sert aussi à l'aperçu hors application. */
export function CorpsDesReponses({
  lues,
  couleurs,
}: {
  lues: ReponseLue[];
  couleurs: (cle: string) => Couleurs;
}) {
  /* Groupées par thème, dans l'ordre d'apparition. */
  const parTheme: Array<{ cle: string; theme: string; lignes: ReponseLue[] }> = [];
  for (const r of lues) {
    const dernier = parTheme[parTheme.length - 1];
    if (dernier && dernier.cle === r.cle) dernier.lignes.push(r);
    else parTheme.push({ cle: r.cle, theme: r.theme, lignes: [r] });
  }

  return (
    <div className="p-4 sm:columns-2 sm:gap-4">
      {parTheme.map((groupe) => {
        const { fond, encre } = couleurs(groupe.cle);
        return (
          <div
            key={groupe.cle}
            className="mb-4 break-inside-avoid rounded-2xl border border-ardoise-100 bg-white p-4"
            style={{ borderTopColor: encre, borderTopWidth: 3 }}
          >
            <span
              className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ background: fond, color: encre }}
            >
              {groupe.theme}
            </span>

            <dl className="mt-3 space-y-3">
              {groupe.lignes.map((r, i) => (
                <div key={i}>
                  <dt className="text-[13px] leading-snug text-ardoise-600">{r.question}</dt>
                  <dd className="mt-1.5">
                    {r.curseur ? (
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-ardoise-500">{r.curseur.gauche}</span>
                        <span className="relative h-1.5 flex-1 rounded-full" style={{ background: fond }}>
                          <span
                            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                            style={{ left: `${r.curseur.valeur}%`, background: encre }}
                          />
                        </span>
                        <span className="text-xs text-ardoise-500">{r.curseur.droite}</span>
                      </span>
                    ) : r.reponses.length === 0 ? (
                      <span className="text-xs text-ardoise-400">Sans réponse</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {r.reponses.map((rep) => (
                          <span
                            key={rep}
                            className="inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold leading-tight"
                            style={{ background: fond, color: encre }}
                          >
                            {rep}
                          </span>
                        ))}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
