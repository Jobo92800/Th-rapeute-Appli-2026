import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Sparkles, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { majEcheance, programmesDeLaCliente } from '../../services/metier';
import { LIBELLES_TECHNOLOGIE, formaterEuros } from '../../domain/tarification';
import { STATUT_SUIVANT, etatEcheance } from '../../domain/reglement';
import ModaleNouvelleCure from '../cure/ModaleNouvelleCure';
import type { Cliente, Echeance } from '../../types/db';

const LIBELLE_MODE: Record<string, string> = {
  comptant: 'Comptant',
  '4x_maison': '4 fois sans frais',
  '10x_alma': '10 fois Alma',
};

export default function OngletProgramme({
  cliente,
  centreId,
}: {
  cliente: Cliente;
  centreId: string;
}) {
  const clienteId = cliente.id;
  const qc = useQueryClient();
  const [nouvelleCure, setNouvelleCure] = useState(false);

  const { data: programmes = [], isLoading } = useQuery({
    queryKey: ['programmes', clienteId],
    queryFn: () => programmesDeLaCliente(clienteId),
  });

  async function basculerStatut(e: Echeance) {
    const suivant = STATUT_SUIVANT[e.statut];
    try {
      await majEcheance(e.id, {
        statut: suivant,
        date_reglement: suivant === 'paye' ? new Date().toISOString().slice(0, 10) : null,
      });
      qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
      qc.invalidateQueries({ queryKey: ['situations', centreId] });
    } catch {
      toast.error("Le statut n'a pas pu être modifié.");
    }
  }

  async function changerDate(e: Echeance, date: string) {
    try {
      await majEcheance(e.id, { date_prevue: date || null });
      qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
      qc.invalidateQueries({ queryKey: ['situations', centreId] });
    } catch {
      toast.error("La date n'a pas pu être modifiée.");
    }
  }

  async function changerMoyen(e: Echeance, moyen: string) {
    try {
      await majEcheance(e.id, { moyen: (moyen || null) as Echeance['moyen'] });
      qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
    } catch {
      toast.error("Le moyen de paiement n'a pas pu être modifié.");
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
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/bilan" className="bouton-fort">
            <Sparkles className="h-4 w-4" />
            Démarrer un bilan
          </Link>
          <button onClick={() => setNouvelleCure(true)} className="bouton-discret">
            <Plus className="h-4 w-4" />
            Créer une cure sans bilan
          </button>
        </div>

        {nouvelleCure && (
          <ModaleNouvelleCure
            cliente={cliente}
            centreId={centreId}
            numero={1}
            onFerme={() => setNouvelleCure(false)}
            onCreee={() => {
              setNouvelleCure(false);
              qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
              qc.invalidateQueries({ queryKey: ['situations', centreId] });
            }}
          />
        )}
      </div>
    );
  }

  const prochainNumero = Math.max(0, ...programmes.map((p) => p.programme.numero)) + 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ardoise-500">
          {programmes.length} cure{programmes.length > 1 ? 's' : ''} enregistrée
          {programmes.length > 1 ? 's' : ''}
        </p>
        <button onClick={() => setNouvelleCure(true)} className="bouton-fort">
          <Plus className="h-4 w-4" />
          Nouvelle cure
        </button>
      </div>

      {programmes.map(({ programme: p, lignes, echeances, suivi }) => {
        const totalPrevu = suivi.reduce((n, s) => n + s.seances_prevues, 0);
        const totalFait = suivi.reduce((n, s) => n + s.seances_faites, 0);
        const encaisse = echeances
          .filter((e) => e.statut === 'paye')
          .reduce((n, e) => n + Number(e.montant), 0);
        const reste = Number(p.montant_total) + Number(p.frais_financement) - encaisse;
        const enRetard = echeances
          .filter((e) => etatEcheance(e).etat === 'retard')
          .reduce((n, e) => n + Number(e.montant), 0);

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

            <div className="grid gap-px bg-ardoise-100 sm:grid-cols-2 lg:grid-cols-4">
              <Bloc libelle="Séances au programme" valeur={`${totalFait} / ${totalPrevu}`} />
              <Bloc libelle="Encaissé" valeur={formaterEuros(encaisse)} />
              <Bloc libelle="Reste à encaisser" valeur={formaterEuros(reste)} />
              <Bloc
                libelle="En retard"
                valeur={enRetard > 0 ? formaterEuros(enRetard, 2) : '—'}
                alerte={enRetard > 0}
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
                {Number(p.prix_guide) > 0 && (
                  <div className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-ardoise-700">Guide de rééquilibrage</span>
                    <span className="chiffres text-ardoise-500">
                      {formaterEuros(Number(p.prix_guide))}
                    </span>
                  </div>
                )}
                {Number(p.prix_tenue) > 0 && (
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
                Échéancier
              </h3>
              <p className="mt-1 text-xs text-ardoise-500">
                La première échéance tombe le jour de la cure, puis une par mois. Les dates
                restent modifiables. Cliquez sur la pastille pour changer le statut.
              </p>

              <div className="mt-3 space-y-1.5">
                {echeances.map((e) => {
                  const st = etatEcheance(e);
                  return (
                    <div
                      key={e.id}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 ${st.classe}`}
                    >
                      <span className="w-24 shrink-0 text-2xs font-semibold uppercase tracking-wide text-ardoise-500">
                        {e.type === 'acompte'
                          ? 'Acompte'
                          : `${e.rang}${e.rang === 1 ? 'ère' : 'ème'} éch.`}
                      </span>

                      <span className="chiffres w-24 shrink-0 text-base font-bold text-ardoise-900">
                        {formaterEuros(Number(e.montant), 2)}
                      </span>

                      <input
                        type="date"
                        value={e.date_prevue ?? ''}
                        onChange={(ev) => changerDate(e, ev.target.value)}
                        aria-label={`Date de l'échéance ${e.rang}`}
                        className="w-36 shrink-0 rounded-lg border border-ardoise-300 bg-white px-2 py-1 text-xs text-ardoise-800 focus:border-marine-500 focus:outline-none focus:ring-1 focus:ring-marine-500"
                      />

                      <select
                        value={e.moyen ?? ''}
                        onChange={(ev) => changerMoyen(e, ev.target.value)}
                        aria-label={`Moyen de paiement de l'échéance ${e.rang}`}
                        className="w-32 shrink-0 rounded-lg border border-ardoise-300 bg-white px-2 py-1 text-xs text-ardoise-800 focus:border-marine-500 focus:outline-none focus:ring-1 focus:ring-marine-500"
                      >
                        <option value="">Moyen…</option>
                        <option value="cb">Carte bancaire</option>
                        <option value="cheque">Chèque</option>
                        <option value="especes">Espèces</option>
                        <option value="virement">Virement</option>
                        <option value="alma">Alma</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => basculerStatut(e)}
                        className={`ml-auto rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wide transition-opacity hover:opacity-80 ${st.pastille}`}
                      >
                        {st.libelle}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      {nouvelleCure && (
        <ModaleNouvelleCure
          cliente={cliente}
          centreId={centreId}
          numero={prochainNumero}
          onFerme={() => setNouvelleCure(false)}
          onCreee={() => {
            setNouvelleCure(false);
            qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
            qc.invalidateQueries({ queryKey: ['situations', centreId] });
          }}
        />
      )}
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
