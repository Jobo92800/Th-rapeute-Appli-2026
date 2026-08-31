import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Ruler } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { ajouterMensuration, mensurationsDeLaCliente } from '../../services/metier';
import type { Mensuration } from '../../types/db';

const MESURES = [
  { cle: 'poitrine', libelle: 'Poitrine' },
  { cle: 'sous_poitrine', libelle: 'Sous-poitrine' },
  { cle: 'taille', libelle: 'Taille' },
  { cle: 'ventre', libelle: 'Ventre' },
  { cle: 'hanches', libelle: 'Hanches' },
  { cle: 'bras_droit', libelle: 'Bras droit' },
  { cle: 'bras_gauche', libelle: 'Bras gauche' },
  { cle: 'cuisse_droite', libelle: 'Cuisse droite' },
  { cle: 'cuisse_gauche', libelle: 'Cuisse gauche' },
  { cle: 'mollet_droit', libelle: 'Mollet droit' },
  { cle: 'mollet_gauche', libelle: 'Mollet gauche' },
] as const;

type CleMesure = (typeof MESURES)[number]['cle'];

export default function OngletMensurations({
  clienteId,
  centreId,
}: {
  clienteId: string;
  centreId: string;
}) {
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [valeurs, setValeurs] = useState<Record<string, string>>({});

  const { data: mesures = [], isLoading } = useQuery({
    queryKey: ['mensurations', clienteId],
    queryFn: () => mensurationsDeLaCliente(clienteId),
  });

  const ajouter = useMutation({
    mutationFn: async () => {
      const ligne: Record<string, unknown> = {
        cliente_id: clienteId,
        centre_id: centreId,
        date_mesure: date,
      };
      for (const m of MESURES) {
        const v = valeurs[m.cle];
        ligne[m.cle] = v ? Number(v) : null;
      }
      await ajouterMensuration(ligne as Partial<Mensuration>);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mensurations', clienteId] });
      setValeurs({});
      setOuvert(false);
      toast.success('Mensurations enregistrées');
    },
    onError: () => toast.error("Les mensurations n'ont pas pu être enregistrées."),
  });

  function soumettre(e: FormEvent) {
    e.preventDefault();
    ajouter.mutate();
  }

  /** Écart avec le tout premier relevé, pour montrer le chemin parcouru. */
  function ecart(cle: CleMesure, valeur: number | null): string | null {
    if (valeur == null || mesures.length < 2) return null;
    const premier = mesures[mesures.length - 1][cle];
    if (premier == null) return null;
    const d = Number(valeur) - Number(premier);
    if (Math.abs(d) < 0.05) return null;
    return `${d > 0 ? '+' : ''}${d.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}`;
  }

  return (
    <div className="space-y-5">
      <section className="carte">
        <div className="flex items-center justify-between border-b border-ardoise-100 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
            <Ruler className="h-4 w-4 text-ardoise-400" />
            Mensurations
          </h2>
          <button onClick={() => setOuvert((o) => !o)} className="bouton-discret">
            <Plus className="h-4 w-4" />
            Nouveau relevé
          </button>
        </div>

        {ouvert && (
          <form onSubmit={soumettre} className="border-b border-ardoise-100 bg-ardoise-50/60 p-5">
            <div className="mb-4 max-w-xs">
              <label htmlFor="date-mesure" className="etiquette">
                Date du relevé
              </label>
              <input
                id="date-mesure"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="champ"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {MESURES.map((m) => (
                <div key={m.cle}>
                  <label htmlFor={m.cle} className="etiquette">
                    {m.libelle}
                  </label>
                  <input
                    id={m.cle}
                    type="number"
                    step="0.5"
                    value={valeurs[m.cle] ?? ''}
                    onChange={(e) => setValeurs((v) => ({ ...v, [m.cle]: e.target.value }))}
                    className="champ"
                    placeholder="cm"
                  />
                </div>
              ))}
            </div>
            <button type="submit" disabled={ajouter.isPending} className="bouton-principal mt-4">
              {ajouter.isPending ? 'Enregistrement…' : 'Enregistrer le relevé'}
            </button>
          </form>
        )}

        {isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-ardoise-400">Chargement…</p>
        ) : mesures.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ardoise-500">
            Aucun relevé pour l'instant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ardoise-200 bg-ardoise-50">
                  <th className="px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-widest text-ardoise-500">
                    Mesure
                  </th>
                  {mesures.map((m) => (
                    <th
                      key={m.id}
                      className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-widest text-ardoise-500"
                    >
                      {format(new Date(m.date_mesure), 'd MMM yy', { locale: fr })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ardoise-100">
                {MESURES.map((mes) => {
                  if (mesures.every((m) => m[mes.cle] == null)) return null;
                  return (
                    <tr key={mes.cle} className="hover:bg-ardoise-50">
                      <td className="px-4 py-2 font-medium text-ardoise-700">{mes.libelle}</td>
                      {mesures.map((m, i) => {
                        const v = m[mes.cle];
                        const e = i === 0 ? ecart(mes.cle, v) : null;
                        return (
                          <td key={m.id} className="px-4 py-2 text-right text-ardoise-800">
                            {v == null
                              ? '—'
                              : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                            {e && (
                              <span
                                className={`ml-1.5 text-2xs font-semibold ${
                                  e.startsWith('-') ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {e}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
