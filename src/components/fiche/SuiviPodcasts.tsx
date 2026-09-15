import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronLeft, ChevronRight, Headphones, Loader2, Target, Trophy } from 'lucide-react';
import { etatParcours } from '../../services/metier';
import { laCliente, majuscule, pronom } from '../../domain/civilite';
import { PARCOURS, libelleParcours, type CodeParcours } from '../../domain/parcoursAudio';
import {
  etatDuPodcast,
  podcastEnCours,
  sommaireDuParcours,
  sousTitrePodcast,
  type EtatPodcast,
} from '../../domain/sommairePodcasts';
import type { Cliente } from '../../types/db';

/**
 * Ce que la cliente écoute cette semaine, et le défi qu'elle est en train
 * de tenir.
 *
 * Le BioPortrait dit qui elle est ; ce bloc dit où elle en est dans le
 * programme audio, pour que la thérapeute puisse ouvrir le rendez-vous sur
 * « alors, ce défi de la semaine, vous l'avez tenu ? » sans avoir écouté
 * l'épisode elle-même. Les textes sont écrits pour elle, pas pour la
 * cliente (`sommairePodcasts.ts`) ; l'avancement vient de Mon Parcours.
 *
 * Le podcast en cours s'ouvre seul. Les flèches et la barre des étapes
 * permettent de revenir sur le précédent — c'est son défi qu'on reprend —
 * ou d'anticiper le suivant.
 */

const ETAT: Record<EtatPodcast, { libelle: string; pastille: string; point: string }> = {
  ecoute: {
    libelle: 'Écouté',
    pastille: 'bg-marine-100 text-marine-800',
    point: 'bg-marine-500 text-white',
  },
  en_cours: {
    libelle: 'En cours cette semaine',
    pastille: 'bg-rose-100 text-rose-800',
    point: 'bg-rose-600 text-white ring-2 ring-rose-200',
  },
  a_venir: {
    libelle: 'À venir',
    pastille: 'bg-ardoise-100 text-ardoise-600',
    point: 'bg-white text-ardoise-500 border border-ardoise-300',
  },
  pas_en_ligne: {
    libelle: 'Pas encore en ligne dans Mon Parcours',
    pastille: 'bg-amber-50 text-amber-800',
    point: 'bg-white text-ardoise-300 border border-dashed border-ardoise-300',
  },
};

export default function SuiviPodcasts({ cliente }: { cliente: Cliente }) {
  const aAcces = Boolean(cliente.acces_audio_le);

  const { data: compte, isLoading } = useQuery({
    queryKey: ['parcours-audio', cliente.id],
    queryFn: () => etatParcours(cliente.id),
    enabled: aAcces,
    staleTime: 60_000,
  });

  /*
    Le parcours : celui du compte quand Mon Parcours répond, sinon celui
    noté sur la fiche, sinon un choix à la main — le sommaire se lit aussi
    sans cliente, comme une fiche de référence.
  */
  const codeDuCompte = compte?.parcoursCode as CodeParcours | undefined;
  const codeDeLaFiche = cliente.parcours_audio as CodeParcours | null;
  const [codeChoisi, setCodeChoisi] = useState<CodeParcours>(
    PARCOURS.some((p) => p.code === codeDeLaFiche) ? (codeDeLaFiche as CodeParcours) : 'B',
  );
  const code: CodeParcours = PARCOURS.some((p) => p.code === codeDuCompte)
    ? (codeDuCompte as CodeParcours)
    : codeChoisi;
  const parcoursConnu = PARCOURS.some((p) => p.code === code);

  const sommaire = sommaireDuParcours(code);
  const avancement = compte && compte.total > 0 ? { terminees: compte.terminees, total: compte.total } : null;

  const [numero, setNumero] = useState<number | null>(null);
  const courant = avancement ? podcastEnCours(avancement) : 0;

  // Le podcast en cours s'ouvre seul, et se recale quand Mon Parcours répond.
  useEffect(() => {
    setNumero(courant);
  }, [courant, code]);

  const n = Math.max(0, Math.min(numero ?? courant, sommaire.length - 1));
  const fiche = sommaire[n];
  const precedente = n > 0 ? sommaire[n - 1] : null;
  const etat = (p: number): EtatPodcast | null => (avancement ? etatDuPodcast(p, avancement) : null);
  const etatFiche = etat(n);

  return (
    <section className="carte">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ardoise-100 px-5 py-3.5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
            <Headphones className="h-4 w-4 text-ardoise-400" />
            Ce qu’{pronom(cliente.civilite)} écoute cette semaine
          </h2>
          <p className="text-xs text-ardoise-500">
            {!aAcces
              ? `${majuscule(laCliente(cliente.civilite))} n’a pas encore d’accès au parcours — donnez-le dans le bloc ci-dessous. Le sommaire se lit quand même.`
              : isLoading
                ? 'Mon Parcours répond…'
                : avancement
                  ? `Parcours ${libelleParcours(code)} · ${avancement.terminees} étape${avancement.terminees > 1 ? 's' : ''} écoutée${avancement.terminees > 1 ? 's' : ''} sur ${avancement.total}`
                  : 'Mon Parcours ne répond pas : le sommaire se lit, mais sans son avancement.'}
          </p>
        </div>

        {/* Sans compte, on choisit la cure à la main pour lire le sommaire. */}
        {!avancement && !isLoading && (
          <div className="flex gap-1.5">
            {PARCOURS.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setCodeChoisi(p.code)}
                aria-pressed={code === p.code}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                  code === p.code
                    ? 'border-marine-600 bg-marine-600 text-white'
                    : 'border-ardoise-300 bg-white text-ardoise-700 hover:border-marine-400'
                }`}
              >
                {p.libelle}
              </button>
            ))}
          </div>
        )}
      </div>

      {!parcoursConnu ? (
        <p className="px-5 py-4 text-sm text-ardoise-500">
          Ce compte est sur un ancien parcours ({compte?.parcoursCode}) qui n’a pas de sommaire.
        </p>
      ) : isLoading && aAcces ? (
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-ardoise-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lecture de l’avancement…
        </p>
      ) : (
        <div className="p-5">
          {/* La barre des étapes : un point par podcast, l'état en couleur. */}
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Podcasts du parcours">
            {sommaire.map((p) => {
              const e = etat(p.numero);
              const style = e ? ETAT[e].point : 'bg-white text-ardoise-600 border border-ardoise-300';
              const actif = p.numero === n;
              return (
                <button
                  key={p.numero}
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  onClick={() => setNumero(p.numero)}
                  title={`Podcast ${p.numero} — ${p.titre}${e ? ` · ${ETAT[e].libelle}` : ''}`}
                  className={`chiffres flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-transform ${style} ${
                    actif ? 'scale-110 outline outline-2 outline-offset-2 outline-ardoise-800' : 'hover:scale-105'
                  }`}
                >
                  {p.numero}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-3">
            <button
              type="button"
              onClick={() => setNumero(n - 1)}
              disabled={n === 0}
              aria-label="Podcast précédent"
              className="mt-1 shrink-0 rounded-lg border border-ardoise-200 p-1.5 text-ardoise-600 hover:bg-ardoise-50 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="surtitre">
                  Podcast {fiche.numero} · {sousTitrePodcast(fiche.numero)}
                </p>
                {etatFiche && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ETAT[etatFiche].pastille}`}>
                    {ETAT[etatFiche].libelle}
                  </span>
                )}
              </div>
              <h3 className="mt-0.5 text-lg font-semibold text-ardoise-900">{fiche.titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ardoise-700">{fiche.resume}</p>

              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-800">
                  <Target className="h-3.5 w-3.5" />
                  {fiche.numero === 0 ? 'Ce qu’on attend après l’écoute' : 'Le défi de la semaine'}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-rose-950">{fiche.defi}</p>
              </div>

              {(fiche.pages || fiche.trophee) && (
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ardoise-500">
                  {fiche.pages && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      Livre ma beautyplus : {fiche.pages}
                    </span>
                  )}
                  {fiche.trophee && (
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      Trophée à la fin de l’épisode : « {fiche.trophee} »
                    </span>
                  )}
                </div>
              )}

              {/*
                Le podcast suivant revient toujours sur le défi précédent :
                c'est la porte d'entrée du rendez-vous.
              */}
              {precedente && etatFiche === 'en_cours' && (
                <p className="mt-3 rounded-lg bg-ardoise-50 px-3 py-2 text-xs text-ardoise-600">
                  <b className="text-ardoise-800">À reprendre en rendez-vous</b> — le défi de la semaine
                  passée (podcast {precedente.numero}) : {precedente.defiCourt}. « Alors, ce défi, vous
                  l’avez tenu ? »
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setNumero(n + 1)}
              disabled={n >= sommaire.length - 1}
              aria-label="Podcast suivant"
              className="mt-1 shrink-0 rounded-lg border border-ardoise-200 p-1.5 text-ardoise-600 hover:bg-ardoise-50 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
