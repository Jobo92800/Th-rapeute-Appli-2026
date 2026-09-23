import { lazy, Suspense, useState } from 'react';
import { Eye, Sparkles } from 'lucide-react';
import {
  LIBELLES_COTATION,
  type BaremeSignature,
  type CarteDesZones,
  type Cotation,
  type PorteeZone,
} from '../../domain/profilSignature';

/*
  Le buste ne part du serveur que si quelqu'un ouvre cet écran : il porte
  la bibliothèque 3D, dix fois le poids du reste de la page.
*/
const Buste3D = lazy(() => import('./Buste3D'));

/**
 * L'observation : la thérapeute cote les sept zones, devant la cliente.
 *
 * C'est le temps du bilan qui n'existe dans aucun des deux autres. Les
 * réponses de la cliente ont déjà pré-coté chaque zone — elle a dit ce
 * qu'elle voit dans son miroir et ce qui la gêne — et la thérapeute
 * confirme ou corrige avec son œil. La moitié de chaque axe en dépend, et
 * la cure entière se lit là-dessus.
 *
 * Chaque zone dit aussi ce que la radiofréquence peut en faire : elle agit
 * sur l'ovale, le cou, le grain et le décolleté ; son effet est partiel
 * sur le contour des yeux et le front ; elle ne fait rien pour les sillons
 * nasogéniens, qui tiennent au volume. Seules les premières comptent dans
 * la cure — proposer des séances pour une zone que le soin ne traite pas
 * serait vendre du vent.
 */

const PORTEE: Record<PorteeZone, { libelle: string; teinte: string }> = {
  rf: { libelle: 'La radiofréquence agit', teinte: 'border-violet-200 bg-violet-50 text-violet-600' },
  pa: { libelle: 'Effet partiel', teinte: 'border-marine-200 bg-marine-50 text-marine-700' },
  ot: { libelle: 'Autre approche conseillée', teinte: 'border-ardoise-200 bg-ardoise-50 text-ardoise-600' },
};

export default function ObservationDesZones({
  bareme,
  carte,
  ajustees,
  onCoter,
}: {
  bareme: BaremeSignature;
  /** La carte en vigueur : pré-cotation du questionnaire, corrigée par la thérapeute. */
  carte: CarteDesZones;
  /** Les zones que la thérapeute a cotées elle-même. */
  ajustees: CarteDesZones;
  onCoter: (code: string, valeur: Cotation) => void;
}) {
  /* La zone qu'on regarde : le buste s'y tourne, les autres s'atténuent. */
  const [focus, setFocus] = useState<string | null>(null);
  /* Une machine sans 3D ne montre pas un carré vide : on revient à la liste seule. */
  const [sansTroisD, setSansTroisD] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <div className="surtitre">Votre observation</div>
        <h1 className="mt-1 text-3xl font-light tracking-tight text-ardoise-900">
          Ce que vous <b className="font-semibold">voyez</b>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ardoise-500">
          Ses réponses ont déjà coté les zones. Confirmez ou corrigez : c'est votre œil qui fait
          foi, et c'est cette carte qui décide de la cure.
        </p>
      </header>

      <div className={sansTroisD ? '' : 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]'}>
        {!sansTroisD && (
          <Suspense
            fallback={
              <div className="aspect-[4/5] w-full rounded-2xl border border-ardoise-200 bg-marine-50 sm:aspect-[5/4]" />
            }
          >
            <Buste3D
              zones={bareme.ZONES}
              carte={carte}
              focus={focus}
              onFocus={setFocus}
              onIndisponible={() => setSansTroisD(true)}
            />
          </Suspense>
        )}

      <section className="carte divide-y divide-ardoise-100">
        {bareme.ZONES.map((zone) => {
          const valeur = carte[zone.code] ?? 0;
          const parLaTherapeute = ajustees[zone.code] !== undefined;
          const portee = PORTEE[zone.portee];

          return (
            <div
              key={zone.code}
              onMouseEnter={() => !sansTroisD && setFocus(zone.code)}
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors ${
                focus === zone.code ? 'bg-violet-50/60' : ''
              }`}
            >
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ardoise-900">
                  {zone.nom}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${portee.teinte}`}
                  >
                    {portee.libelle}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-ardoise-500">{zone.detail}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-ardoise-400">
                  {parLaTherapeute ? (
                    <>
                      <Eye className="h-3 w-3" />
                      Ajustée par la thérapeute
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      Pré-cotée par le questionnaire
                    </>
                  )}
                </p>
              </div>

              <div
                className="flex shrink-0 flex-wrap gap-1.5"
                role="group"
                aria-label={`Intensité — ${zone.nom}`}
              >
                {([0, 1, 2, 3] as Cotation[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onCoter(zone.code, n)}
                    aria-pressed={valeur === n}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      valeur === n
                        ? 'border-violet-500 bg-violet-500 text-white'
                        : 'border-ardoise-200 bg-white text-ardoise-600 hover:border-violet-200 hover:bg-violet-50'
                    }`}
                  >
                    {LIBELLES_COTATION[n]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>
      </div>
    </div>
  );
}
