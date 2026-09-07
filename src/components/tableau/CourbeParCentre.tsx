import { useMemo, useRef, useState } from 'react';
import BulleGraphe from './BulleGraphe';
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

  const { series, max, points, pasX } = useMemo(() => {
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

    return { series, max, pasX, points: donnees.mois.map((m, i) => ({ m, x: x(i) })) };
  }, [donnees]);

  /*
    On vise un mois, pas un point. Cinq courbes se croisent ici : demander de
    survoler un disque de trois pixels serait demander de viser la bonne
    ligne au bon endroit. La bulle donne donc les cinq centres du mois, du
    plus fort au plus faible — c'est la question qu'on se pose devant cette
    courbe.
  */
  const cadre = useRef<HTMLDivElement>(null);
  const [survol, setSurvol] = useState<{ index: number; x: number; y: number } | null>(null);

  function suivreLaSouris(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget.getBoundingClientRect();
    const boite = cadre.current?.getBoundingClientRect();
    if (!boite || svg.width === 0 || donnees.mois.length === 0) return;

    const xDessin = ((e.clientX - svg.left) / svg.width) * L;
    const index = pasX > 0 ? Math.round((xDessin - M.gauche) / pasX) : 0;
    if (index < 0 || index >= donnees.mois.length) return setSurvol(null);

    setSurvol({
      index,
      x: e.clientX - boite.left + (cadre.current?.scrollLeft ?? 0),
      y: e.clientY - boite.top,
    });
  }

  const moisVise = survol ? donnees.mois[survol.index] : null;
  const releve = moisVise
    ? series
        .map((s) => ({ nom: s.nom, teinte: s.teinte, valeur: Number(s.points[survol!.index]?.valeur ?? 0) }))
        .sort((a, b) => b.valeur - a.valeur)
    : [];

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

      <div className="relative mt-3 overflow-x-auto" ref={cadre}>
        <svg
          viewBox={`0 0 ${L} ${H}`}
          className="h-64 w-full min-w-[640px]"
          role="img"
          aria-label="Chiffre d'affaires signé par centre sur douze mois"
          onMouseMove={suivreLaSouris}
          onMouseLeave={() => setSurvol(null)}
        >
          {survol && (
            <line
              x1={M.gauche + pasX * survol.index}
              y1={M.haut - 4}
              x2={M.gauche + pasX * survol.index}
              y2={H - M.bas}
              stroke="currentColor"
              className="text-ardoise-300"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}
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
                <circle
                  key={i}
                  cx={p.cx}
                  cy={p.cy}
                  r={survol?.index === i ? 5 : 3}
                  fill={s.teinte}
                  stroke={survol?.index === i ? 'white' : undefined}
                  strokeWidth={survol?.index === i ? 1.5 : undefined}
                />
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

        {moisVise && survol && (
          <BulleGraphe x={survol.x} y={survol.y} largeur={cadre.current?.clientWidth ?? 0}>
            <p className="font-semibold text-ardoise-900">{moisCourt(moisVise)}</p>
            <ul className="mt-1.5 space-y-0.5">
              {releve.map((r) => (
                <li key={r.nom} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-ardoise-600">
                    <span
                      className="h-0.5 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: r.teinte }}
                    />
                    <span className="truncate">{r.nom}</span>
                  </span>
                  <span className="chiffres shrink-0 font-semibold text-ardoise-900">
                    {formaterEuros(r.valeur)}
                  </span>
                </li>
              ))}
            </ul>
          </BulleGraphe>
        )}
      </div>
    </section>
  );
}
