import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Mensuration } from '../../types/db';

export interface MesureDefinition {
  cle: keyof Mensuration;
  libelle: string;
}

/*
  Trois séries au maximum, et les trois teintes sont fixes : bleu, orange,
  aqua. Cette palette a été validée sur toutes les paires — séparation
  suffisante en vision normale comme en deutéranopie, protanopie et
  tritanopie. Ne pas y ajouter de quatrième teinte sans revalider.

  L'aqua passe juste sous le contraste de 3:1 sur fond blanc : c'est
  acceptable ici parce que chaque courbe porte son nom en bout de tracé et
  que le tableau au-dessus donne tous les chiffres.
*/
const TEINTES = ['#2a78d6', '#eb6834', '#1baf7a'] as const;
const MAX_SERIES = 3;

const L = 46; // marge gauche, pour les valeurs de l'axe
const R = 74; // marge droite, pour les étiquettes en bout de courbe
const H_HAUT = 18;
const H_BAS = 30;
const LARGEUR = 720;
const HAUTEUR = 260;

interface Props {
  mesures: Mensuration[];
  definitions: readonly MesureDefinition[];
  /** Séries affichées par défaut. */
  parDefaut: Array<keyof Mensuration>;
}

export default function CourbeMensurations({ mesures, definitions, parDefaut }: Props) {
  const [choisies, setChoisies] = useState<Array<keyof Mensuration>>(parDefaut);
  const [survol, setSurvol] = useState<number | null>(null);

  // Les relevés arrivent du plus récent au plus ancien : on remet dans l'ordre.
  const points = useMemo(
    () =>
      [...mesures].sort(
        (a, b) => new Date(a.date_mesure).getTime() - new Date(b.date_mesure).getTime(),
      ),
    [mesures],
  );

  /** Une mesure n'est proposée que si elle a été relevée au moins une fois. */
  const disponibles = useMemo(
    () => definitions.filter((d) => points.some((p) => p[d.cle] != null)),
    [definitions, points],
  );

  const series = useMemo(
    () =>
      choisies
        .map((cle, i) => {
          const def = definitions.find((d) => d.cle === cle);
          if (!def) return null;
          return {
            cle,
            libelle: def.libelle,
            teinte: TEINTES[i % TEINTES.length],
            valeurs: points.map((p) => (p[cle] == null ? null : Number(p[cle]))),
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null),
    [choisies, definitions, points],
  );

  const bornes = useMemo(() => {
    const toutes = series.flatMap((s) => s.valeurs).filter((v): v is number => v != null);
    if (toutes.length === 0) return null;
    const min = Math.min(...toutes);
    const max = Math.max(...toutes);
    // Un peu d'air, et un plancher pour ne pas exagérer une variation d'1 cm.
    const marge = Math.max((max - min) * 0.15, 2);
    return { bas: Math.floor(min - marge), haut: Math.ceil(max + marge) };
  }, [series]);

  function basculer(cle: keyof Mensuration) {
    setChoisies((c) => {
      if (c.includes(cle)) return c.filter((x) => x !== cle);
      if (c.length >= MAX_SERIES) return [...c.slice(1), cle];
      return [...c, cle];
    });
  }

  if (points.length < 2) {
    return (
      <p className="px-5 py-8 text-center text-sm text-ardoise-400">
        La courbe apparaîtra dès le deuxième relevé.
      </p>
    );
  }

  const x = (i: number) =>
    points.length === 1
      ? L + (LARGEUR - L - R) / 2
      : L + (i / (points.length - 1)) * (LARGEUR - L - R);

  const y = (v: number) => {
    if (!bornes || bornes.haut === bornes.bas) return HAUTEUR / 2;
    const t = (v - bornes.bas) / (bornes.haut - bornes.bas);
    return HAUTEUR - H_BAS - t * (HAUTEUR - H_BAS - H_HAUT);
  };

  const graduations = bornes
    ? Array.from({ length: 4 }, (_, i) =>
        Math.round(bornes.bas + ((bornes.haut - bornes.bas) * i) / 3),
      )
    : [];

  return (
    <div className="px-5 py-5">
      {/* Sélection des séries — au-dessus du graphique, sur une seule ligne */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {disponibles.map((d) => {
          const rang = choisies.indexOf(d.cle);
          const active = rang >= 0;
          return (
            <button
              key={String(d.cle)}
              type="button"
              onClick={() => basculer(d.cle)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'border-ardoise-400 bg-white text-ardoise-900'
                  : 'border-ardoise-200 bg-ardoise-50 text-ardoise-500 hover:border-ardoise-300'
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: active ? TEINTES[rang % TEINTES.length] : '#c2d0d7' }}
                aria-hidden
              />
              {d.libelle}
            </button>
          );
        })}
        <span className="ml-1 text-2xs text-ardoise-400">3 courbes au maximum</span>
      </div>

      {series.length === 0 || !bornes ? (
        <p className="py-10 text-center text-sm text-ardoise-400">
          Choisissez au moins une mesure à afficher.
        </p>
      ) : (
        <div className="relative overflow-x-auto">
          <svg
            viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
            className="h-auto w-full min-w-[560px]"
            role="img"
            aria-label={`Évolution de ${series.map((s) => s.libelle).join(', ')} en centimètres`}
            onMouseLeave={() => setSurvol(null)}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * LARGEUR;
              const pas = (LARGEUR - L - R) / Math.max(1, points.length - 1);
              const i = Math.round((px - L) / pas);
              setSurvol(i >= 0 && i < points.length ? i : null);
            }}
          >
            {/* Grille — volontairement discrète */}
            {graduations.map((g) => (
              <g key={g}>
                <line
                  x1={L}
                  x2={LARGEUR - R}
                  y1={y(g)}
                  y2={y(g)}
                  stroke="#e3ecef"
                  strokeWidth={1}
                />
                <text
                  x={L - 8}
                  y={y(g) + 3.5}
                  textAnchor="end"
                  fontSize={10}
                  fill="#94a9b4"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {g}
                </text>
              </g>
            ))}

            {/* Dates */}
            {points.map((p, i) => {
              const espace = (LARGEUR - L - R) / Math.max(1, points.length - 1);
              const pas = Math.max(1, Math.ceil(56 / Math.max(espace, 1)));
              if (i % pas !== 0 && i !== points.length - 1) return null;
              return (
                <text
                  key={p.id}
                  x={x(i)}
                  y={HAUTEUR - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#94a9b4"
                >
                  {format(new Date(p.date_mesure), 'd MMM', { locale: fr })}
                </text>
              );
            })}

            {/* Repère de survol */}
            {survol != null && (
              <line
                x1={x(survol)}
                x2={x(survol)}
                y1={H_HAUT - 6}
                y2={HAUTEUR - H_BAS}
                stroke="#94a9b4"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {/* Courbes */}
            {series.map((s) => {
              const definis = s.valeurs
                .map((v, i) => ({ v, i }))
                .filter((d): d is { v: number; i: number } => d.v != null);
              if (definis.length === 0) return null;

              const trace = definis
                .map((d, k) => `${k === 0 ? 'M' : 'L'} ${x(d.i)} ${y(d.v)}`)
                .join(' ');
              const dernier = definis[definis.length - 1];

              return (
                <g key={String(s.cle)}>
                  {definis.length > 1 && (
                    <path
                      d={trace}
                      fill="none"
                      stroke={s.teinte}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {definis.map((d) => (
                    <circle
                      key={d.i}
                      cx={x(d.i)}
                      cy={y(d.v)}
                      r={survol === d.i ? 5 : 4}
                      fill={s.teinte}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  ))}
                  {/* Étiquette en bout de courbe : l'identité ne repose jamais
                      sur la seule couleur. */}
                  <text
                    x={x(dernier.i) + 10}
                    y={y(dernier.v) + 3.5}
                    fontSize={11}
                    fontWeight={600}
                    fill={s.teinte}
                  >
                    {s.libelle}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Infobulle */}
          {survol != null && (
            <div
              className="pointer-events-none absolute top-2 rounded-lg border border-ardoise-200 bg-white px-3 py-2 shadow-carte"
              style={{
                left: `${(x(survol) / LARGEUR) * 100}%`,
                transform:
                  x(survol) > LARGEUR * 0.6 ? 'translateX(-104%)' : 'translateX(4%)',
              }}
            >
              <p className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                {format(new Date(points[survol].date_mesure), 'd MMMM yyyy', { locale: fr })}
              </p>
              <ul className="mt-1 space-y-0.5">
                {series.map((s) => (
                  <li key={String(s.cle)} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: s.teinte }}
                      aria-hidden
                    />
                    <span className="text-ardoise-600">{s.libelle}</span>
                    <span className="chiffres ml-auto font-semibold text-ardoise-900">
                      {s.valeurs[survol] == null
                        ? '—'
                        : `${s.valeurs[survol]!.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} cm`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Légende — toujours présente dès deux séries */}
      {series.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ardoise-100 pt-3">
          {series.map((s) => {
            const definis = s.valeurs.filter((v): v is number => v != null);
            const ecart =
              definis.length > 1 ? definis[definis.length - 1] - definis[0] : null;
            return (
              <span key={String(s.cle)} className="flex items-center gap-1.5 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: s.teinte }}
                  aria-hidden
                />
                <span className="font-medium text-ardoise-700">{s.libelle}</span>
                {ecart != null && Math.abs(ecart) >= 0.05 && (
                  <span
                    className={`chiffres font-semibold ${
                      ecart < 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {ecart > 0 ? '+' : ''}
                    {ecart.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} cm
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
