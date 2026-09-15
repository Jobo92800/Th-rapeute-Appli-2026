import { Fragment, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Pencil, Plus, Ruler, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  ajouterMensuration,
  majMensuration,
  mensurationsDeLaCliente,
  supprimerMensuration,
} from '../../services/metier';
import { texteErreur } from '../../lib/erreurs';
import type { Mensuration } from '../../types/db';
import CourbeMensurations from './CourbeMensurations';

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

/**
 * Les trois mesures qui se prennent des deux côtés. La thérapeute mesure un
 * bras, puis l'autre : la saisie doit suivre le geste, un côté par colonne.
 * Rangées dans le désordre, on relève le bras droit et on l'écrit à gauche.
 */
const MESURES_PAIRES = [
  { partie: 'Bras', droite: 'bras_droit', gauche: 'bras_gauche' },
  { partie: 'Cuisse', droite: 'cuisse_droite', gauche: 'cuisse_gauche' },
  { partie: 'Mollet', droite: 'mollet_droit', gauche: 'mollet_gauche' },
] as const satisfies ReadonlyArray<{ partie: string; droite: CleMesure; gauche: CleMesure }>;

const CLES_PAIRES = new Set<string>(MESURES_PAIRES.flatMap((p) => [p.droite, p.gauche]));

/** Celles qui n'ont qu'une valeur : le tronc. */
const MESURES_CENTRALES = MESURES.filter((m) => !CLES_PAIRES.has(m.cle));

function libelle(cle: CleMesure): string {
  return MESURES.find((m) => m.cle === cle)?.libelle ?? cle;
}

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
  /*
    Le relevé qu'on corrige, s'il y en a un. Le même formulaire sert à
    saisir et à corriger : une valeur mal lue sur le mètre se voit dans le
    tableau, et il faut pouvoir la reprendre là, sans refaire le relevé.
  */
  const [corrige, setCorrige] = useState<Mensuration | null>(null);

  function ouvrirVierge() {
    setCorrige(null);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setValeurs({});
    setOuvert(true);
  }

  function ouvrirPourCorriger(m: Mensuration) {
    setCorrige(m);
    setDate(m.date_mesure);
    const v: Record<string, string> = {};
    for (const mes of MESURES) {
      const x = m[mes.cle];
      if (x != null) v[mes.cle] = String(x);
    }
    setValeurs(v);
    setOuvert(true);
  }

  function fermer() {
    setOuvert(false);
    setCorrige(null);
    setValeurs({});
  }

  const { data: mesures = [], isLoading } = useQuery({
    queryKey: ['mensurations', clienteId],
    queryFn: () => mensurationsDeLaCliente(clienteId),
  });

  const ajouter = useMutation({
    mutationFn: async () => {
      const ligne: Record<string, unknown> = { date_mesure: date };
      for (const m of MESURES) {
        const v = valeurs[m.cle];
        ligne[m.cle] = v ? Number(v) : null;
      }
      if (corrige) {
        await majMensuration(corrige.id, ligne as Partial<Mensuration>);
      } else {
        await ajouterMensuration({
          ...ligne,
          cliente_id: clienteId,
          centre_id: centreId,
        } as Partial<Mensuration>);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mensurations', clienteId] });
      toast.success(corrige ? 'Relevé corrigé' : 'Mensurations enregistrées');
      fermer();
    },
    onError: (e) => toast.error(texteErreur(e) || "Les mensurations n'ont pas pu être enregistrées."),
  });

  const supprimer = useMutation({
    mutationFn: (id: string) => supprimerMensuration(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mensurations', clienteId] });
      toast.success('Relevé supprimé');
      if (corrige) fermer();
    },
    onError: (e) => toast.error(texteErreur(e) || "Le relevé n'a pas pu être supprimé."),
  });

  function demanderSuppression(m: Mensuration) {
    const jour = format(new Date(m.date_mesure), 'd MMMM yyyy', { locale: fr });
    if (!confirm(`Supprimer le relevé du ${jour} ? Ses onze mesures disparaissent, la courbe se redessine.`)) return;
    supprimer.mutate(m.id);
  }

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
          <button onClick={() => (ouvert && !corrige ? fermer() : ouvrirVierge())} className="bouton-discret">
            <Plus className="h-4 w-4" />
            Nouveau relevé
          </button>
        </div>

        {ouvert && (
          <form onSubmit={soumettre} className="border-b border-ardoise-100 bg-ardoise-50/60 p-5">
            {corrige && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-marine-200 bg-marine-50 px-3 py-2 text-sm text-marine-900">
                <span>
                  <b>Correction du relevé du{' '}
                  {format(new Date(corrige.date_mesure), 'd MMMM yyyy', { locale: fr })}</b> — les
                  valeurs ci-dessous remplacent les anciennes.
                </span>
                <button type="button" onClick={fermer} className="bouton-discret text-xs">
                  <X className="h-3.5 w-3.5" />
                  Annuler
                </button>
              </div>
            )}
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
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {MESURES_CENTRALES.map((m) => (
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

            <div className="mt-5 grid max-w-2xl grid-cols-[4.5rem_1fr_1fr] items-center gap-x-3 gap-y-2">
              <span />
              <span className="etiquette mb-0">Côté droit</span>
              <span className="etiquette mb-0">Côté gauche</span>
              {MESURES_PAIRES.map((p) => (
                <Fragment key={p.partie}>
                  <span className="text-sm font-medium text-ardoise-700">{p.partie}</span>
                  {[p.droite, p.gauche].map((cle) => (
                    <input
                      key={cle}
                      id={cle}
                      type="number"
                      step="0.5"
                      aria-label={libelle(cle)}
                      value={valeurs[cle] ?? ''}
                      onChange={(e) => setValeurs((v) => ({ ...v, [cle]: e.target.value }))}
                      className="champ"
                      placeholder="cm"
                    />
                  ))}
                </Fragment>
              ))}
            </div>
            <button type="submit" disabled={ajouter.isPending} className="bouton-principal mt-4">
              {ajouter.isPending
                ? 'Enregistrement…'
                : corrige
                  ? 'Enregistrer la correction'
                  : 'Enregistrer le relevé'}
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
                      className="px-4 py-2 text-right text-2xs font-semibold uppercase tracking-widest text-ardoise-500"
                    >
                      {/*
                        Corriger ou supprimer un relevé se fait depuis sa
                        colonne : c'est là qu'on voit la valeur fausse.
                      */}
                      <span className="inline-flex items-center gap-1">
                        {format(new Date(m.date_mesure), 'd MMM yy', { locale: fr })}
                        <button
                          type="button"
                          onClick={() => ouvrirPourCorriger(m)}
                          aria-label={`Corriger le relevé du ${format(new Date(m.date_mesure), 'd MMMM yyyy', { locale: fr })}`}
                          title="Corriger ce relevé"
                          className="rounded p-1 text-ardoise-400 hover:bg-ardoise-200 hover:text-marine-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => demanderSuppression(m)}
                          disabled={supprimer.isPending}
                          aria-label={`Supprimer le relevé du ${format(new Date(m.date_mesure), 'd MMMM yyyy', { locale: fr })}`}
                          title="Supprimer ce relevé"
                          className="rounded p-1 text-ardoise-400 hover:bg-rose-100 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
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

      {mesures.length > 0 && (
        <section className="carte">
          <div className="border-b border-ardoise-100 px-5 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
              <LineChart className="h-4 w-4 text-ardoise-400" />
              Évolution
            </h2>
            <p className="text-xs text-ardoise-500">
              En centimètres. Une baisse s'affiche en vert.
            </p>
          </div>
          <CourbeMensurations
            mesures={mesures}
            definitions={MESURES}
            parDefaut={['taille', 'ventre', 'hanches']}
          />
        </section>
      )}
    </div>
  );
}
