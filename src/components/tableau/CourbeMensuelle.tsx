import { useMemo } from 'react';
import { formaterEuros } from '../../domain/tarification';

/**
 * Douze mois d'argent, deux séries qu'il ne faut jamais confondre :
 * l'encaissé (ce qui est rentré) et le signé (ce qui a été vendu, et qui
 * rentrera parfois sur dix mois).
 *
 * En SVG, comme la courbe des mensurations : le projet n'embarque pas de
 * bibliothèque de graphiques et n'en a pas besoin.
 */
export default function CourbeMensuelle({
  mois,
}: {
  mois: Array<{ mois: string; encaisse: number; signe: number }>;
}) {
  const L = 720;
  const H = 200;
  const MARGE = { haut: 14, bas: 26, gauche: 8, droite: 8 };

  const { barres, max } = useMemo(() => {
    const max = Math.max(1, ...mois.flatMap((m) => [Number(m.encaisse), Number(m.signe)]));
    const largeurMois = (L - MARGE.gauche - MARGE.droite) / Math.max(1, mois.length);
    const largeurBarre = Math.min(14, largeurMois / 3);

    const barres = mois.map((m, i) => {
      const centre = MARGE.gauche + largeurMois * (i + 0.5);
      const hauteur = (v: number) => ((H - MARGE.haut - MARGE.bas) * Number(v)) / max;
      return {
        cle: m.mois,
        libelle: m.mois.slice(5) + '/' + m.mois.slice(2, 4),
        centre,
        largeurBarre,
        encaisse: Number(m.encaisse),
        signe: Number(m.signe),
        hEncaisse: hauteur(m.encaisse),
        hSigne: hauteur(m.signe),
      };
    });

    return { barres, max };
  }, [mois]);

  const base = H - MARGE.bas;

  return (
    <section className="carte p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Douze derniers mois
        </h2>
        <span className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-marine-600" />
            <span className="text-ardoise-600">Encaissé</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />
            <span className="text-ardoise-600">Signé</span>
          </span>
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${L} ${H}`} className="h-52 w-full min-w-[600px]" role="img"
             aria-label="Encaissé et signé, mois par mois">
          <line x1={MARGE.gauche} y1={base} x2={L - MARGE.droite} y2={base}
                stroke="currentColor" className="text-ardoise-200" strokeWidth="1" />

          {barres.map((b) => (
            <g key={b.cle}>
              <rect
                x={b.centre - b.largeurBarre - 1}
                y={base - b.hEncaisse}
                width={b.largeurBarre}
                height={Math.max(0, b.hEncaisse)}
                rx="2"
                className="fill-marine-600"
              >
                <title>{`${b.libelle} — encaissé ${formaterEuros(b.encaisse)}`}</title>
              </rect>
              <rect
                x={b.centre + 1}
                y={base - b.hSigne}
                width={b.largeurBarre}
                height={Math.max(0, b.hSigne)}
                rx="2"
                className="fill-rose-400"
              >
                <title>{`${b.libelle} — signé ${formaterEuros(b.signe)}`}</title>
              </rect>
              <text
                x={b.centre}
                y={H - 8}
                textAnchor="middle"
                className="fill-ardoise-400 text-[10px]"
              >
                {b.libelle}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <p className="mt-1 text-xs text-ardoise-400">
        Plus haute barre : {formaterEuros(max)}. Un mois peut afficher beaucoup de signé et peu
        d’encaissé — les cures se règlent en quatre ou dix fois.
      </p>
    </section>
  );
}
