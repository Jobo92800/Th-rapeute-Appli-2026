import { useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formaterEuros } from '../../domain/tarification';

/*
  Cinq centres, cinq teintes fixes : la couleur d'un centre ne change pas
  d'un chargement à l'autre, sinon la lecture se refait à chaque fois.
  Le rose de l'identité est gardé pour le premier, les autres s'en écartent
  assez pour rester distinguables.
*/
const TEINTES = ['#1f7fa3', '#d10e9c', '#2f9e7e', '#e8a33d', '#7c5cd6'];

function moisCourt(iso: string): string {
  const [a, m] = iso.split('-');
  return format(new Date(Number(a), Number(m) - 1, 1), 'MMM yy', { locale: fr });
}

/**
 * Le chiffre d'affaires signé, centre par centre, sur douze mois. Une ligne
 * par centre : c'est la courbe de l'ancien tableau de bord, celle qui montre
 * lequel décroche et lequel tient.
 */
export default function CourbeParCentre({
  donnees,
}: {
  donnees: {
    mois: string[];
    lignes: Array<{ centre_id: string; centre: string; valeurs: Record<string, number>; total: number }>;
  };
}) {
  const L = 760;
  const H = 260;
  const M = { haut: 16, bas: 28, gauche: 58, droite: 12 };

  const { series, max, points } = useMemo(() => {
    const max = Math.max(
      1,
      ...donnees.lignes.flatMap((l) => donnees.mois.map((m) => Number(l.valeurs[m] ?? 0))),
    );

    const pasX =
      donnees.mois.length > 1
        ? (L - M.gauche - M.droite) / (donnees.mois.length - 1)
        : 0;

    const x = (i: number) => M.gauche + pasX * i;
    const y = (v: number) => H - M.bas - ((H - M.haut - M.bas) * v) / max;

    const series = donnees.lignes.map((l, index) => ({
      cle: l.centre_id,
      nom: l.centre,
      teinte: TEINTES[index % TEINTES.length],
      total: Number(l.total),
      chemin: donnees.mois
        .map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(Number(l.valeurs[m] ?? 0)).toFixed(1)}`)
        .join(' '),
      points: donnees.mois.map((m, i) => ({
        cx: x(i),
        cy: y(Number(l.valeurs[m] ?? 0)),
        valeur: Number(l.valeurs[m] ?? 0),
        mois: m,
      })),
    }));

    return { series, max, points: donnees.mois.map((m, i) => ({ m, x: x(i) })) };
  }, [donnees]);

  if (donnees.lignes.length === 0) return null;

  const graduations = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    valeur: max * f,
    y: H - M.bas - (H - M.haut - M.bas) * f,
  }));

  return (
    <section className="carte p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Signé par centre — douze derniers mois
        </h2>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {series.map((s) => (
            <span key={s.cle} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.teinte }} />
              <span className="text-ardoise-600">{s.nom}</span>
            </span>
          ))}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${L} ${H}`}
          className="h-64 w-full min-w-[640px]"
          role="img"
          aria-label="Chiffre d'affaires signé par centre sur douze mois"
        >
          {graduations.map((g, i) => (
            <g key={i}>
              <line
                x1={M.gauche}
                y1={g.y}
                x2={L - M.droite}
                y2={g.y}
                stroke="currentColor"
                className="text-ardoise-200"
                strokeWidth="1"
                strokeDasharray={i === 0 ? undefined : '3 4'}
              />
              <text x={M.gauche - 8} y={g.y + 3} textAnchor="end" className="fill-ardoise-400 text-[10px]">
                {g.valeur >= 1000 ? `${Math.round(g.valeur / 1000)}k€` : Math.round(g.valeur) + ' €'}
              </text>
            </g>
          ))}

          {series.map((s) => (
            <g key={s.cle}>
              <path d={s.chemin} fill="none" stroke={s.teinte} strokeWidth="2" strokeLinejoin="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={p.cx} cy={p.cy} r="3" fill={s.teinte}>
                  <title>{`${s.nom} — ${moisCourt(p.mois)} : ${formaterEuros(p.valeur)}`}</title>
                </circle>
              ))}
            </g>
          ))}

          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={H - 8}
              textAnchor="middle"
              className="fill-ardoise-400 text-[10px]"
            >
              {moisCourt(p.m)}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}
