import type { EtapeBareme } from '../../domain/empreinte';

/**
 * Une question du diagnostic, telle que la cliente la voit sur la tablette.
 *
 * Trois formes : un choix unique, une case à cocher multiple, un oui/non.
 * La différence se voit à la pastille — ronde pour un choix, carrée pour
 * une case — parce qu'une personne qui ne peut cocher qu'une réponse et une
 * personne qui peut tout cocher ne lisent pas la même question.
 */
export default function QuestionEmpreinte({
  etape,
  theme,
  choisis,
  onChoisir,
}: {
  etape: EtapeBareme;
  /** [libellé du thème, fond, encre]. Absent pour la saisie thérapeute. */
  theme?: [string, string, string];
  choisis: number[];
  onChoisir: (index: number) => void;
}) {
  const multiple = etape.type === 'multi';

  return (
    <div>
      {theme ? (
        <span
          className="mb-3.5 inline-block rounded-full px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ background: theme[1], color: theme[2] }}
        >
          {theme[0]}
        </span>
      ) : (
        <span className="mb-3.5 inline-block rounded-full bg-rose-500 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
          Saisie thérapeute
        </span>
      )}

      <p className="text-xl font-medium leading-snug tracking-tight text-ardoise-900">{etape.t}</p>

      {etape.hint && <p className="mt-2 text-xs text-ardoise-500">{etape.hint}</p>}

      <div className="mt-5 flex flex-col gap-2.5">
        {(etape.o ?? []).map(([libelle], i) => {
          const actif = choisis.includes(i);

          return (
            <button
              key={i}
              type="button"
              onClick={() => onChoisir(i)}
              aria-pressed={actif}
              className={`flex items-center gap-3.5 rounded-2xl border-[1.5px] px-4 py-3.5 text-left text-[15px] transition-colors ${
                actif
                  ? 'border-marine-500 bg-marine-50'
                  : 'border-ardoise-200 bg-white hover:border-marine-300 hover:bg-marine-50/60'
              }`}
            >
              <span
                className={`relative h-5 w-5 shrink-0 border-2 ${
                  multiple ? 'rounded-md' : 'rounded-full'
                } ${actif ? 'border-marine-500' : 'border-ardoise-300'}`}
              >
                {actif && (
                  <span
                    className={`absolute inset-[3px] bg-marine-500 ${
                      multiple ? 'rounded-[2px]' : 'rounded-full'
                    }`}
                  />
                )}
              </span>
              <span className="text-ardoise-900">{libelle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
