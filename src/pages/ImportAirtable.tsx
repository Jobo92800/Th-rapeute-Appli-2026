import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSession } from '../lib/session';
import { reprendreFichesAirtable, type RapportImport } from '../services/importAirtable';
import { formaterEuros } from '../domain/tarification';

/**
 * La reprise des fiches du CRM dans la V2. Un geste qu'on ne fait qu'une
 * fois, et qu'on ne fait jamais à l'aveugle : on compte d'abord, on écrit
 * ensuite, et seulement après avoir lu le décompte.
 */
export default function ImportAirtable() {
  const { role } = useSession();
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [lu, setLu] = useState(false);

  if (role !== 'direction') {
    return (
      <div className="carte px-5 py-12 text-center">
        <h1 className="text-lg font-semibold text-ardoise-900">Reprise des fiches</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ardoise-500">
          Cette opération est réservée à la direction.
        </p>
      </div>
    );
  }

  async function lancer(ecrire: boolean) {
    setEnCours(true);
    try {
      const r = await reprendreFichesAirtable(ecrire);
      setRapport(r);
      setLu(false);

      if (ecrire) {
        toast.success(
          `${r.creees.fiches} fiche${r.creees.fiches > 1 ? 's' : ''} et ${r.creees.cures} cure${r.creees.cures > 1 ? 's' : ''} reprises`,
          { duration: 8000 },
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'La reprise a échoué.', { duration: 8000 });
    } finally {
      setEnCours(false);
    }
  }

  const fait = rapport && !rapport.simulation;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/tableau-de-bord"
          className="inline-flex items-center gap-1.5 text-sm text-ardoise-500 hover:text-marine-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Tableau de bord
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ardoise-900">
          Reprise des fiches du CRM
        </h1>
        <p className="mt-0.5 text-sm text-ardoise-500">
          Les clientes d’Airtable entrent dans la V2, avec leurs cures.
        </p>
      </div>

      <section className="carte p-5 text-sm leading-relaxed text-ardoise-700">
        <h2 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Ce qui va être créé
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Une <strong>fiche cliente</strong> par enregistrement Airtable <strong>ayant au
            moins une cure</strong> : identité, coordonnées, date de naissance, centre, source,
            date de création. Les prospects qui n’ont jamais signé restent dans le CRM.
          </li>
          <li>
            Une <strong>cure</strong> par montant renseigné (« Montant Cure », « Montant cure 2 »
            …), datée à la création de la fiche — Airtable ne date que celle-là.
          </li>
        </ul>

        <h2 className="mt-4 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Ce qui ne peut pas l’être
        </h2>
        <p className="mt-2">
          Le détail des séances, les échéanciers, les bilans Empreinte, les mensurations et les
          notes ne sont pas dans Airtable : ils vivent dans l’ancienne base Firebase. Les cures
          reprises portent donc un montant, et rien d’autre — l’application les signale comme
          telles.
        </p>

        <p className="mt-3 rounded-lg bg-ardoise-50 px-3 py-2 text-xs text-ardoise-600">
          L’opération peut être relancée sans risque : une fiche déjà reprise est reconnue par son
          identifiant Airtable et laissée telle quelle. Et rien ne repart vers le CRM — ces fiches
          en viennent.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => lancer(false)} disabled={enCours} className="bouton-discret">
          {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Compter sans rien écrire
        </button>

        {rapport?.simulation && rapport.fiches.a_creer > 0 && (
          <button
            onClick={() => lancer(true)}
            disabled={enCours || !lu}
            className="bouton-fort"
            title={lu ? undefined : 'Cochez la case après avoir lu le décompte'}
          >
            Créer les {rapport.fiches.a_creer} fiches et {rapport.cures.a_creer} cures
          </button>
        )}
      </div>

      {rapport?.simulation && rapport.fiches.a_creer > 0 && (
        <label className="flex items-center gap-2 text-sm text-ardoise-700">
          <input
            type="checkbox"
            checked={lu}
            onChange={(e) => setLu(e.target.checked)}
            className="h-4 w-4 rounded border-ardoise-300 text-marine-600 focus:ring-marine-500"
          />
          J’ai lu le décompte ci-dessous.
        </label>
      )}

      {rapport && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Chiffre libelle="Fiches lues dans le CRM" valeur={rapport.fiches.lues} />
            <Chiffre
              libelle={fait ? 'Fiches créées' : 'Fiches à créer'}
              valeur={fait ? rapport.creees.fiches : rapport.fiches.a_creer}
              accent
            />
            <Chiffre
              libelle={fait ? 'Cures créées' : 'Cures à créer'}
              valeur={fait ? rapport.creees.cures : rapport.cures.a_creer}
              accent
            />
            <Chiffre
              libelle="Chiffre d’affaires repris"
              valeur={formaterEuros(rapport.cures.montant_total)}
            />
          </section>

          <section className="carte p-5">
            <h2 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
              Ce que j’ai trouvé dans les données
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-ardoise-700">
              <Ligne
                libelle="Déjà dans la V2, laissées telles quelles"
                valeur={rapport.anomalies.deja_presentes}
              />
              <Ligne libelle="Écartées, sans nom ni prénom" valeur={rapport.anomalies.sans_nom} />
              <Ligne libelle="Écartées, sans centre" valeur={rapport.anomalies.sans_centre} />
              <Ligne
                libelle="Prospects sans aucune cure — laissés dans le CRM"
                valeur={rapport.anomalies.sans_cure}
              />
              <Ligne
                libelle="Sans thérapeute — la fiche est créée, la case reste vide"
                valeur={rapport.anomalies.sans_therapeute}
              />
              <Ligne
                libelle="Sans téléphone"
                valeur={rapport.anomalies.sans_telephone}
              />
              <Ligne
                libelle="Âges corrigés depuis la date de naissance"
                valeur={rapport.anomalies.age_recalcule}
              />
            </ul>

            {rapport.anomalies.centre_inconnu.length > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Centres inconnus, dont les fiches sont écartées :{' '}
                {rapport.anomalies.centre_inconnu.join(', ')}. Le nom doit correspondre exactement
                à celui du centre dans la V2.
              </p>
            )}
          </section>

          {rapport.erreurs.length > 0 && (
            <section className="carte border-rose-200 bg-rose-50 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                <AlertTriangle className="h-4 w-4" />
                {rapport.erreurs.length} lot{rapport.erreurs.length > 1 ? 's' : ''} en échec
              </h2>
              <ul className="mt-2 space-y-1 text-xs text-rose-900">
                {rapport.erreurs.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </section>
          )}

          {fait && rapport.erreurs.length === 0 && (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Reprise terminée. Les fiches sont dans la liste des clientes, et les chiffres dans le
              tableau de bord.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Chiffre({
  libelle,
  valeur,
  accent = false,
}: {
  libelle: string;
  valeur: number | string;
  accent?: boolean;
}) {
  return (
    <div className={`carte px-5 py-4 ${accent ? 'border-marine-300 bg-marine-50' : ''}`}>
      <div
        className={`text-2xs font-semibold uppercase tracking-widest ${
          accent ? 'text-marine-700' : 'text-ardoise-400'
        }`}
      >
        {libelle}
      </div>
      <div
        className={`chiffres mt-1 text-3xl font-bold tracking-tight ${
          accent ? 'text-marine-900' : 'text-ardoise-900'
        }`}
      >
        {valeur}
      </div>
    </div>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-ardoise-100 pb-1.5 last:border-0">
      <span className={valeur === 0 ? 'text-ardoise-400' : ''}>{libelle}</span>
      <span
        className={`chiffres shrink-0 font-semibold ${
          valeur === 0 ? 'text-ardoise-300' : 'text-ardoise-900'
        }`}
      >
        {valeur}
      </span>
    </li>
  );
}
