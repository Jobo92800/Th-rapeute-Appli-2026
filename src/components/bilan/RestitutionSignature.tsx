import { useState } from 'react';
import { AlertTriangle, ArrowRight, ChevronLeft, ListChecks } from 'lucide-react';
import {
  AXES_SIGNATURE,
  COULEUR_COTATION,
  LIBELLES_COTATION,
  contreIndications,
  nomDuTerrainSignature,
  soinRecent,
  type BaremeSignature,
  type CarteDesZones,
  type Cotation,
  type ProfilSignatureCalcule,
  type ReponsesSignature,
} from '../../domain/profilSignature';
import { relireLesReponsesSignature } from '../../domain/profilSignature';

/**
 * Le Profil Signature, tel qu'on le présente à la cliente.
 *
 * Un profil, un terrain, quatre axes en pourcentage, et les zones à
 * travailler. La ligne « ce que la radiofréquence peut apporter » n'est
 * pas une précaution d'usage : elle dit ce que le soin fait et ce qu'il ne
 * fait pas, et c'est elle qui évite la promesse qu'on ne tiendra pas.
 */

const LIBELLES_AXES: Record<(typeof AXES_SIGNATURE)[number], string> = {
  fermete: 'Fermeté',
  rides: 'Rides',
  hydratation: 'Hydratation / Qualité',
  densite: 'Densité',
};

/* Chaque axe sa teinte, prise dans la palette : jamais le rose, qui engage. */
const TEINTES: Record<(typeof AXES_SIGNATURE)[number], string> = {
  fermete: 'bg-violet-500',
  rides: 'bg-marine-500',
  hydratation: 'bg-marine-300',
  densite: 'bg-violet-200',
};

export default function RestitutionSignature({
  bareme,
  resultat,
  carte,
  reponses,
  prenom,
  onRetour,
  onSuite,
}: {
  bareme: BaremeSignature;
  resultat: ProfilSignatureCalcule;
  carte: CarteDesZones;
  reponses: ReponsesSignature;
  prenom: string;
  onRetour: () => void;
  onSuite: () => void;
}) {
  const [reponsesOuvertes, setReponsesOuvertes] = useState(false);
  const p = bareme.PROFILS[resultat.profil];
  const interdits = contreIndications(bareme, reponses);
  const recent = soinRecent(reponses);

  /* Les zones à travailler, des plus marquées aux plus discrètes. */
  const prioritaires = bareme.ZONES.filter((z) => (carte[z.code] ?? 0) >= 2).sort(
    (a, b) => (carte[b.code] ?? 0) - (carte[a.code] ?? 0),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="surtitre">Votre Profil Signature</div>
        <h1 className="mt-1 text-3xl font-light tracking-tight text-ardoise-900">
          Ce que dit la peau {prenom ? <b className="font-semibold">de {prenom}</b> : null}
        </h1>
      </header>

      {interdits.length > 0 && (
        <p className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b className="font-semibold">Contre-indication signalée</b> —{' '}
            {interdits.join(', ').toLowerCase()}. Ne réalisez pas la séance et orientez vers un
            avis médical. Le Profil Signature peut être enregistré, pas la cure.
          </span>
        </p>
      )}

      {recent && interdits.length === 0 && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Peeling, laser ou injection il y a moins d'un mois : pas de séance aujourd'hui. Le
            Profil Signature se fait, et la cure démarre au plus tôt un mois après ce soin.
          </span>
        </p>
      )}

      {/* Le profil ---------------------------------------------------- */}
      <section className="overflow-hidden rounded-2xl bg-marine-900 text-white">
        <div className="px-6 py-7">
          <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-marine-300">
            Profil
          </p>
          <p className="mt-1 text-3xl font-light">
            <b className="font-semibold">{p.nom}</b>
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-marine-100">{p.texte}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {p.besoins.map((b) => (
              <span
                key={b}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold"
              >
                {b}
              </span>
            ))}
          </div>

          <p className="mt-4 border-t border-white/15 pt-3 text-[13px] text-marine-200">
            {p.radiofrequence}
          </p>
        </div>
      </section>

      {/* Les quatre axes ---------------------------------------------- */}
      <section className="carte p-5">
        <h2 className="surtitre">Votre signature</h2>
        <div className="mt-3 space-y-2.5">
          {AXES_SIGNATURE.map((a) => (
            <div key={a} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-sm text-ardoise-700">{LIBELLES_AXES[a]}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ardoise-100">
                <span
                  className={`block h-full rounded-full ${TEINTES[a]}`}
                  style={{ width: `${Math.min(100, resultat.axes[a])}%` }}
                />
              </span>
              <span className="chiffres w-12 shrink-0 text-right text-sm font-bold text-ardoise-900">
                {Math.min(100, resultat.axes[a])} %
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Terrain et zones --------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="carte p-5">
          <h2 className="surtitre">Votre terrain cutané</h2>
          <p className="mt-1 text-lg font-semibold text-ardoise-900">
            {resultat.terrains.length > 1 ? 'Terrain mixte : ' : ''}
            {nomDuTerrainSignature(bareme, resultat.terrains)}
          </p>
          {resultat.terrains.map((t) => (
            <p key={t} className="mt-2 text-sm leading-relaxed text-ardoise-600">
              {bareme.TERRAINS[t].texte}
              {bareme.TERRAINS[t].consigne ? ` ${bareme.TERRAINS[t].consigne}` : ''}
            </p>
          ))}
        </section>

        <section className="carte p-5">
          <h2 className="surtitre">Vos zones prioritaires</h2>
          {prioritaires.length === 0 ? (
            <p className="mt-2 text-sm text-ardoise-500">
              Aucune zone marquée ou modérée : la peau ne signale rien de prioritaire.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {prioritaires.map((z) => (
                <li key={z.code} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ardoise-800">{z.nom}</span>
                  <span
                    style={{
                      background: COULEUR_COTATION[(carte[z.code] ?? 0) as Cotation].fond,
                      color: COULEUR_COTATION[(carte[z.code] ?? 0) as Cotation].texte,
                    }}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
                  >
                    {LIBELLES_COTATION[(carte[z.code] ?? 0) as Cotation]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Ses réponses, à rouvrir devant elle --------------------------- */}
      <section className="carte">
        <button
          type="button"
          onClick={() => setReponsesOuvertes((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
            <ListChecks className="h-4 w-4 text-marine-700" />
            Ses réponses
          </span>
          <span className="text-xs text-ardoise-500">
            {reponsesOuvertes ? 'Fermer' : 'Voir ce qui a produit ce profil'}
          </span>
        </button>

        {reponsesOuvertes && (
          <div className="border-t border-ardoise-100 px-5 py-4 sm:columns-2 sm:gap-6">
            {relireLesReponsesSignature(bareme, reponses)
              .filter((r) => r.reponses.length > 0)
              .map((r) => (
                <div key={r.code} className="mb-3 break-inside-avoid">
                  <p className="text-xs text-ardoise-500">{r.question}</p>
                  <p className="mt-0.5 text-sm font-semibold text-ardoise-900">
                    {r.reponses.join(' · ')}
                  </p>
                </div>
              ))}
          </div>
        )}
      </section>

      <p className="text-xs text-ardoise-400">{bareme.MENTION}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ardoise-200 pt-5">
        <button onClick={onRetour} className="bouton-discret">
          <ChevronLeft className="h-4 w-4" />
          Revenir à l'observation
        </button>
        <button onClick={onSuite} className="bouton-fort">
          Voir la cure
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
