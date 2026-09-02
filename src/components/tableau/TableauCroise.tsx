import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formaterEuros } from '../../domain/tarification';

/** Le mois « 2026-04 » écrit « avr. 26 ». */
function moisCourt(iso: string): string {
  const [a, m] = iso.split('-');
  return format(new Date(Number(a), Number(m) - 1, 1), 'MMM yy', { locale: fr });
}

/**
 * Centre × mois, six mois. Le tableau que l'ancien tableau de bord affichait,
 * et qu'on lit d'un coup d'œil quand on cherche quel centre décroche.
 */
export default function TableauCroise({
  croise,
}: {
  croise: {
    mois: string[];
    lignes: Array<{ centre_id: string; centre: string; valeurs: Record<string, number>; total: number }>;
  };
}) {
  if (croise.lignes.length === 0) return null;

  const totaux = croise.mois.map((m) =>
    croise.lignes.reduce((n, l) => n + Number(l.valeurs[m] ?? 0), 0),
  );
  const totalGeneral = croise.lignes.reduce((n, l) => n + Number(l.total), 0);

  return (
    <section className="carte overflow-hidden">
      <div className="border-b border-ardoise-200 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-ardoise-900">
          Signé par centre et par mois — six derniers mois
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-ardoise-100 bg-ardoise-50/60 text-2xs uppercase tracking-widest text-ardoise-400">
              <th className="px-4 py-2 text-left font-semibold">Centre</th>
              {croise.mois.map((m) => (
                <th key={m} className="px-4 py-2 text-right font-semibold">
                  {moisCourt(m)}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-ardoise-100">
            {croise.lignes.map((l) => (
              <tr key={l.centre_id}>
                <td className="px-4 py-2.5 font-medium text-ardoise-900">{l.centre}</td>
                {croise.mois.map((m) => {
                  const v = Number(l.valeurs[m] ?? 0);
                  return (
                    <td
                      key={m}
                      className={`chiffres px-4 py-2.5 text-right ${
                        v === 0 ? 'text-ardoise-300' : 'text-ardoise-700'
                      }`}
                    >
                      {v === 0 ? '—' : formaterEuros(v)}
                    </td>
                  );
                })}
                <td className="chiffres px-4 py-2.5 text-right font-semibold text-ardoise-900">
                  {formaterEuros(Number(l.total))}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t border-ardoise-200 bg-ardoise-50/60">
              <td className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                Total
              </td>
              {totaux.map((t, i) => (
                <td key={i} className="chiffres px-4 py-2.5 text-right font-semibold text-ardoise-900">
                  {t === 0 ? '—' : formaterEuros(t)}
                </td>
              ))}
              <td className="chiffres px-4 py-2.5 text-right font-bold text-marine-800">
                {formaterEuros(totalGeneral)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
