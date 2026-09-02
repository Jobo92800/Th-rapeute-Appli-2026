import { useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Seance } from '../../types/db';

/** Un point de la courbe : une séance où le poids a été relevé. */
interface Point {
  date: string;
  poids: number;
  /** Écart avec la séance précédente. Null pour la première. */
  delta: number | null;
}

const kg = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** « −1,4 kg », « +0,3 kg ». Le signe compte plus que le chiffre. */
export function libelleDelta(d: number): string {
  return `${d > 0 ? '+' : '−'}${kg(Math.abs(d))} kg`;
}

/**
 * L'évolution du poids, séance après séance.
 *
 * Une courbe seule ne dit pas grand-chose ; ce qui parle, c'est l'écart
 * depuis le départ et l'écart depuis la dernière fois. C'est ce qu'on
 * annonce en grand, la courbe venant seulement le montrer.
 *
 * En SVG, comme la courbe des mensurations : le projet n'embarque pas de
 * bibliothèque de graphiques et n'en a pas besoin.
 */
export default function CourbePoids({ seances }: { seances: Seance[] }) {
  const points: Point[] = useMemo(() => {
    const releves = seances
      .filter((s) => s.poids != null)
      .map((s) => ({ date: s.date_seance, poids: Number(s.poids) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return releves.map((r, i) => ({
      ...r,
      delta: i === 0 ? null : Math.round((r.poids - releves[i - 1].poids) * 10) / 10,
    }));
  }, [seances]);

  if (points.length < 2) return null;

  const premier = points[0].poids;
  const dernier = points[points.length - 1].poids;
  const total = Math.round((dernier - premier) * 10) / 10;
  const derniereVariation = points[points.length - 1].delta ?? 0;

  const L = 720;
  const H = 190;
  const M = { haut: 16, bas: 30, gauche: 44, droite: 14 };

  const min = Math.min(...points.map((p) => p.poids));
  const max = Math.max(...points.map((p) => p.poids));
  const marge = Math.max(0.5, (max - min) * 0.15);
  const bas = min - marge;
  const haut = max + marge;

  const x = (i: number) =>
    M.gauche + ((L - M.gauche - M.droite) * i) / Math.max(1, points.length - 1);
  const y = (v: number) =>
    H - M.bas - ((H - M.haut - M.bas) * (v - bas)) / Math.max(0.1, haut - bas);

  const chemin = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.poids).toFixed(1)}`)
    .join(' ');

  const aire = `${chemin} L ${x(points.length - 1).toFixed(1)} ${H - M.bas} L ${x(0).toFixed(1)} ${H - M.bas} Z`;

  return (
    <section className="carte p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ardoise-900">Évolution du poids</h2>
        <span className="text-xs text-ardoise-500">
          {points.length} pesées · de {kg(premier)} à {kg(dernier)} kg
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div
          className={`rounded-2xl border px-4 py-3 ${
            total < 0 ? 'border-marine-200 bg-marine-50' : 'border-ardoise-200 bg-ardoise-50'
          }`}
        >
          <div className="surtitre">Depuis la première pesée</div>
          <div
            className={`chiffres mt-1 text-2xl font-bold ${
              total < 0 ? 'text-marine-800' : 'text-ardoise-800'
            }`}
          >
            {total === 0 ? 'stable' : libelleDelta(total)}
          </div>
        </div>

        <div className="rounded-2xl border border-ardoise-200 bg-white px-4 py-3">
          <div className="surtitre">Depuis la séance précédente</div>
          <div
            className={`chiffres mt-1 text-2xl font-bold ${
              derniereVariation < 0
                ? 'text-marine-800'
                : derniereVariation > 0
                  ? 'text-rose-700'
                  : 'text-ardoise-700'
            }`}
          >
            {derniereVariation === 0 ? 'stable' : libelleDelta(derniereVariation)}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${L} ${H}`}
          className="h-48 w-full min-w-[520px]"
          role="img"
          aria-label="Courbe du poids, séance après séance"
        >
          {[haut, (haut + bas) / 2, bas].map((v, i) => (
            <g key={i}>
              <line
                x1={M.gauche}
                y1={y(v)}
                x2={L - M.droite}
                y2={y(v)}
                stroke="currentColor"
                className="text-ardoise-200"
                strokeDasharray={i === 1 ? '3 4' : undefined}
              />
              <text
                x={M.gauche - 8}
                y={y(v) + 3}
                textAnchor="end"
                className="fill-ardoise-400 text-[10px]"
              >
                {kg(v)}
              </text>
            </g>
          ))}

          <path d={aire} className="fill-marine-500/10" />
          <path d={chemin} fill="none" className="stroke-marine-600" strokeWidth="2.5" strokeLinejoin="round" />

          {points.map((p, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.poids)} r="4" className="fill-marine-600">
                <title>
                  {`${format(new Date(p.date), 'd MMM yyyy', { locale: fr })} — ${kg(p.poids)} kg${
                    p.delta != null ? ` (${libelleDelta(p.delta)})` : ''
                  }`}
                </title>
              </circle>
              {(i === 0 || i === points.length - 1) && (
                <text
                  x={x(i)}
                  y={H - 10}
                  textAnchor={i === 0 ? 'start' : 'end'}
                  className="fill-ardoise-400 text-[10px]"
                >
                  {format(new Date(p.date), 'd MMM', { locale: fr })}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
