import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formaterEuros } from '../../domain/tarification';
import type { Vente } from '../../services/tableauDeBord';

/** Les vingt dernières cures validées, cliquables jusqu'à la fiche. */
export default function DernieresVentes({ ventes }: { ventes: Vente[] }) {
  return (
    <section className="carte overflow-hidden">
      <div className="border-b border-ardoise-200 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-ardoise-900">Vingt dernières cures signées</h2>
      </div>

      {ventes.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ardoise-500">
          Aucune cure signée sur ce périmètre.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ardoise-100 bg-ardoise-50/60 text-2xs uppercase tracking-widest text-ardoise-400">
                <th className="px-4 py-2 text-left font-semibold">Date</th>
                <th className="px-4 py-2 text-left font-semibold">Cliente</th>
                <th className="px-4 py-2 text-left font-semibold">Centre</th>
                <th className="px-4 py-2 text-left font-semibold">Thérapeute</th>
                <th className="px-4 py-2 text-right font-semibold">Montant</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-ardoise-100">
              {ventes.map((v, i) => (
                <tr key={`${v.cliente_id}-${v.numero}-${i}`} className="hover:bg-ardoise-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ardoise-600">
                    {v.date ? format(new Date(v.date), 'd MMM yyyy', { locale: fr }) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/clientes/${v.cliente_id}`}
                      className="font-medium text-ardoise-900 hover:text-marine-700"
                    >
                      {v.cliente}
                    </Link>
                    {v.numero > 1 && (
                      <span className="ml-1.5 text-xs text-ardoise-400">cure {v.numero}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ardoise-600">{v.centre}</td>
                  <td className="px-4 py-2.5 text-ardoise-600">{v.therapeute}</td>
                  <td className="chiffres px-4 py-2.5 text-right font-semibold text-ardoise-900">
                    {formaterEuros(Number(v.montant))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
