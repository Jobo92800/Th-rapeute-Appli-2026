import { ArrowRight, ChevronLeft } from 'lucide-react';
import {
  SEUIL_PRESENCE,
  type Axe,
  type Bareme,
  type Empreinte,
  type MesureInbody,
} from '../../domain/empreinte';

interface Props {
  bareme: Bareme;
  empreinte: Empreinte;
  prenom: string;
  synthese: string;
  mesures: MesureInbody[];
  onRetour: () => void;
  onSuite: () => void;
}

/**
 * L'écran de restitution ne montre ni cure, ni nombre de séances, ni prix.
 * C'est la règle de la méthode : la compréhension d'abord, l'offre ensuite.
 */
export default function Restitution({
  bareme,
  empreinte,
  prenom,
  synthese,
  mesures,
  onRetour,
  onSuite,
}: Props) {
  const { profilDominant: dp, terrainDominant: dt, pourcentages } = empreinte;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="carte px-6 py-8 text-center sm:px-10">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          La conclusion de votre bilan
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ardoise-900 sm:text-3xl">
          L'Empreinte de {prenom}
        </h1>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-3 text-lg font-semibold">
          <span className="text-marine-700">{bareme.AX[dp].name}</span>
          <span className="text-ardoise-300">×</span>
          <span className="text-rose-600">{bareme.AX[dt].name}</span>
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ardoise-600">{synthese}</p>
      </header>

      {mesures.length > 0 && (
        <section className="carte p-5">
          <h2 className="mb-3 text-sm font-semibold text-ardoise-900">
            Analyse de composition corporelle
          </h2>
          <div className="flex flex-wrap gap-2">
            {mesures.map((m) => (
              <span
                key={m.libelle}
                className="rounded-lg border border-ardoise-200 bg-ardoise-50 px-3 py-1.5 text-xs text-ardoise-700"
              >
                <span className="font-semibold text-ardoise-900">{m.libelle}</span> · {m.valeur}
              </span>
            ))}
          </div>
        </section>
      )}

      <CarteAxe
        bareme={bareme}
        code={dp}
        pct={pourcentages[dp]}
        titre="Profil comportemental"
        soustitre="Qui elle est aujourd'hui"
        badge="Profil dominant"
        accent="marine"
        secondaires={empreinte.profilsTries.slice(1)}
        pourcentages={pourcentages}
      />

      <CarteAxe
        bareme={bareme}
        code={dt}
        pct={pourcentages[dt]}
        titre="Terrain physiologique"
        soustitre="Ce que révèle son corps"
        badge="Terrain dominant"
        accent="rose"
        secondaires={empreinte.terrainsTries.slice(1)}
        pourcentages={pourcentages}
      />

      <div className="flex items-center justify-between">
        <button onClick={onRetour} className="bouton-discret">
          <ChevronLeft className="h-4 w-4" />
          Revenir au questionnaire
        </button>
        <button onClick={onSuite} className="bouton-fort">
          Voir la cure préconisée
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CarteAxe({
  bareme,
  code,
  pct,
  titre,
  soustitre,
  badge,
  accent,
  secondaires,
  pourcentages,
}: {
  bareme: Bareme;
  code: Axe;
  pct: number;
  titre: string;
  soustitre: string;
  badge: string;
  accent: 'marine' | 'rose';
  secondaires: Axe[];
  pourcentages: Record<Axe, number>;
}) {
  const a = bareme.AX[code];
  const couleurTexte = accent === 'marine' ? 'text-marine-700' : 'text-rose-600';
  const couleurFond = accent === 'marine' ? 'bg-marine-600' : 'bg-rose-600';
  const couleurBadge =
    accent === 'marine' ? 'bg-marine-50 text-marine-800' : 'bg-rose-50 text-rose-700';

  return (
    <section className="carte overflow-hidden">
      <div className="border-b border-ardoise-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-ardoise-900">{titre}</h2>
        <p className="text-xs text-ardoise-500">{soustitre}</p>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-widest ${couleurBadge}`}
            >
              {badge}
            </span>
            <div className={`mt-2 text-xl font-bold tracking-tight ${couleurTexte}`}>{a.name}</div>
            <div className="text-sm italic text-ardoise-500">{a.sig}</div>
          </div>
          <div className={`chiffres text-4xl font-bold ${couleurTexte}`}>
            {pct}
            <span className="text-xl">%</span>
          </div>
        </div>

        <Jauge pct={pct} couleur={couleurFond} />

        <div className="mt-5 rounded-xl bg-ardoise-50 p-4">
          <p
            className="text-sm leading-relaxed text-ardoise-700"
            dangerouslySetInnerHTML={{ __html: a.feel }}
          />
          <p className="mt-3 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
            Ce que cela change chez elle
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {a.imp.map((x) => (
              <span
                key={x}
                className="rounded-md border border-ardoise-200 bg-white px-2 py-1 text-xs text-ardoise-600"
              >
                {x}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-5 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Aussi présent chez elle
        </p>
        <div className="mt-2 space-y-2">
          {secondaires.map((c) => {
            const p = pourcentages[c];
            const present = p >= SEUIL_PRESENCE;
            return (
              <div
                key={c}
                className={`rounded-lg border px-3 py-2 ${
                  present ? 'border-ardoise-200 bg-white' : 'border-ardoise-100 bg-ardoise-50/60'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`text-sm font-semibold ${present ? 'text-ardoise-800' : 'text-ardoise-400'}`}
                  >
                    {bareme.AX[c].name}
                    {present && (
                      <span className="ml-2 rounded bg-ardoise-100 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-ardoise-500">
                        Présent
                      </span>
                    )}
                  </span>
                  <span
                    className={`chiffres text-sm font-semibold ${present ? 'text-ardoise-700' : 'text-ardoise-400'}`}
                  >
                    {p}%
                  </span>
                </div>
                <Jauge pct={p} couleur={present ? 'bg-ardoise-400' : 'bg-ardoise-300'} fine />
                <p className="mt-1.5 text-xs text-ardoise-500">{bareme.AX[c].note}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Jauge({ pct, couleur, fine = false }: { pct: number; couleur: string; fine?: boolean }) {
  return (
    <div className={`relative mt-3 overflow-hidden rounded-full bg-ardoise-200 ${fine ? 'h-1' : 'h-2'}`}>
      <div
        className={`h-full rounded-full ${couleur} transition-[width] duration-500`}
        style={{ width: `${pct}%` }}
      />
      {/* Repère du seuil de présence */}
      <span
        className="absolute top-0 h-full w-px bg-ardoise-400/70"
        style={{ left: `${SEUIL_PRESENCE}%` }}
        aria-hidden
      />
    </div>
  );
}
