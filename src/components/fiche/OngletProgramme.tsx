import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { majEcheance, programmesDeLaCliente } from '../../services/metier';
import { LIBELLES_TECHNOLOGIE, formaterEuros } from '../../domain/tarification';
import type { Echeance, StatutEcheance } from '../../types/db';

const LIBELLE_MODE: Record<string, string> = {
  comptant: 'Comptant',
  '4x_maison': '4 fois sans frais',
  '10x_alma': '10 fois Alma',
};

/** Le code couleur des règlements, repris de l'ancienne application. */
const STYLE_STATUT: Record<StatutEcheance, { classe: string; libelle: string }> = {
  paye: { classe: 'border-emerald-300 bg-emerald-50 text-emerald-800', libelle: 'Payé' },
  donne: { classe: 'border-ardoise-300 bg-ardoise-100 text-ardoise-600', libelle: 'Donné' },
  impaye: { classe: 'border-rose-300 bg-rose-50 text-rose-800', libelle: 'Impayé' },
  a_venir: { classe: 'border-ardoise-200 bg-white text-ardoise-700', libelle: 'À venir' },
};

const SUITE_STATUT: Record<StatutEcheance, StatutEcheance> = {
  a_venir: 'paye',
  paye: 'donne',
  donne: 'impaye',
  impaye: 'a_venir',
};

export default function OngletProgramme({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();

  const { data: programmes = [], isLoading } = useQuery({
    queryKey: ['programmes', clienteId],
    queryFn: () => programmesDeLaCliente(clienteId),
  });

  async function basculerStatut(e: Echeance) {
    const suivant = SUITE_STATUT[e.statut];
    try {
      await majEcheance(e.id, {
        statut: suivant,
        date_reglement: suivant === 'paye' ? new Date().toISOString().slice(0, 10) : null,
      });
      qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
    } catch {
      toast.error("Le statut n'a pas pu être modifié.");
    }
  }

  if (isLoading) {
    return <p className="carte px-5 py-10 text-center text-sm text-ardoise-400">Chargement…</p>;
  }

  if (programmes.length === 0) {
    return (
      <div className="carte px-5 py-12 text-center">
        <p className="text-sm text-ardoise-600">Aucune cure enregistrée pour cette cliente.</p>
        <p className="mt-1 text-xs text-ardoise-400">
          Une cure se crée à la fin d'un Bilan Empreinte.
        </p>
        <Link to="/bilan" className="bouton-fort mt-5">
          <Sparkles className="h-4 w-4" />
          Démarrer un bilan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {programmes.map(({ programme: p, lignes, echeances, suivi }) => {
        const totalPrevu = suivi.reduce((n, s) => n + s.seances_prevues, 0);
        const totalFait = suivi.reduce((n, s) => n + s.seances_faites, 0);
        const encaisse = echeances
          .filter((e) => e.statut === 'paye')
          .reduce((n, e) => n + Number(e.montant), 0);
        const reste = Number(p.montant_total) + Number(p.frais_financement) - encaisse;

        return (
          <section key={p.id} className="carte overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ardoise-100 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-ardoise-900">
                  Cure {p.numero}
                  {p.date_validation && (
                    <span className="ml-2 font-normal text-ardoise-400">
                      validée le {format(new Date(p.date_validation), 'd MMM yyyy', { locale: fr })}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-ardoise-500">
                  {LIBELLE_MODE[p.mode_reglement]}
                  {Number(p.frais_financement) > 0 &&
                    ` · frais ${formaterEuros(Number(p.frais_financement), 2)}`}
                </p>
              </div>
              <span className="chiffres text-2xl font-bold text-marine-800">
                {formaterEuros(Number(p.montant_total))}
              </span>
            </div>

            <div className="grid gap-px bg-ardoise-100 sm:grid-cols-3">
              <Bloc libelle="Séances au programme" valeur={`${totalFait} / ${totalPrevu}`} />
              <Bloc libelle="Encaissé" valeur={formaterEuros(encaisse)} />
              <Bloc
                libelle="Reste à encaisser"
                valeur={formaterEuros(reste)}
                alerte={reste > 0}
              />
            </div>

            <div className="px-5 py-4">
              <h3 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                Prescription
              </h3>
              <div className="mt-2 space-y-1.5">
                {lignes.map((l) => {
                  const s = suivi.find((x) => x.technologie === l.technologie);
                  return (
                    <div
                      key={l.id}
                      className="flex items-center justify-between border-b border-ardoise-50 py-1.5 text-sm last:border-0"
                    >
                      <span className="text-ardoise-700">
                        {LIBELLES_TECHNOLOGIE[l.technologie]}
                      </span>
                      <span className="chiffres text-ardoise-500">
                        {s?.seances_faites ?? 0} / {l.seances_prevues} séances
                      </span>
                    </div>
                  );
                })}
                {p.guide && (
                  <div className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-ardoise-700">Guide de rééquilibrage</span>
                    <span className="chiffres text-ardoise-500">
                      {formaterEuros(Number(p.prix_guide))}
                    </span>
                  </div>
                )}
                {p.electro && (
                  <div className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-ardoise-700">Tenue I-Shape</span>
                    <span className="chiffres text-ardoise-500">
                      {formaterEuros(Number(p.prix_tenue))}
                    </span>
                  </div>
                )}
              </div>

              {p.complement_recommande && (
                <p className="mt-3 rounded-lg bg-ardoise-50 px-3 py-2 text-xs text-ardoise-600">
                  Complément orienté par le terrain :{' '}
                  <strong className="font-semibold text-ardoise-800">
                    {p.complement_recommande}
                  </strong>
                </p>
              )}
            </div>

            <div className="border-t border-ardoise-100 px-5 py-4">
              <h3 className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                <Wallet className="h-3.5 w-3.5" />
                Échéances — cliquez pour changer le statut
              </h3>
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {echeances.map((e) => {
                  const st = STYLE_STATUT[e.statut];
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => basculerStatut(e)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors hover:brightness-95 ${st.classe}`}
                    >
                      <span className="block text-2xs font-semibold uppercase tracking-wide">
                        {e.type === 'acompte'
                          ? 'Acompte'
                          : `${e.rang}${e.rang === 1 ? 'ère' : 'ème'} échéance`}
                      </span>
                      <span className="chiffres block text-base font-bold">
                        {formaterEuros(Number(e.montant), 2)}
                      </span>
                      <span className="block text-2xs font-medium opacity-80">{st.libelle}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Bloc({
  libelle,
  valeur,
  alerte = false,
}: {
  libelle: string;
  valeur: string;
  alerte?: boolean;
}) {
  return (
    <div className="bg-white px-5 py-3.5">
      <div className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
        {libelle}
      </div>
      <div
        className={`chiffres mt-0.5 text-lg font-bold ${alerte ? 'text-rose-700' : 'text-ardoise-900'}`}
      >
        {valeur}
      </div>
    </div>
  );
}
