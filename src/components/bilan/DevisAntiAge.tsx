import { useMemo, useState } from 'react';
import { Loader2, Mail, Minus, Plus } from 'lucide-react';
import {
  ECHEANCES_ALMA,
  ECHEANCES_CENTRE,
  construireEcheancierCure,
  formaterEuros,
  formaterEurosJuste,
  tauxFraisAlma,
  type GrilleTarifaire,
} from '../../domain/tarification';
import type { PrescriptionValidee } from './CureEtDevis';

/*
  Le devis d'une cure d'Advance Lift.

  Plus simple que celui de la perte de poids, et c'est voulu : le
  Bio-Portrait Anti-Âge ne prescrit rien — « le soin et le nombre de
  séances restent à la décision de la praticienne ». Il n'y a donc ni
  formules, ni prestations à écarter, ni guide, ni tenue : un soin, un
  nombre de séances que la thérapeute tape, et le règlement.

  Ce qui reste identique : chèques au centre de 1 à 4 fois, chaque chèque
  couvrant un nombre entier de séances — « des multiples de 85 € » —, ou
  Alma par carte avec ses frais. L'acompte vaut toujours une séance, 85 € :
  il n'y a pas de bilan à 129 €, la cliente règle directement sa première
  séance ou verse cet acompte.
*/

const SEANCES_PAR_DEFAUT = 6;

export default function DevisAntiAge({
  grille,
  prenom,
  enregistrement,
  onRetour,
  onBilanSeul,
  onValider,
}: {
  grille: GrilleTarifaire;
  prenom: string;
  enregistrement: boolean;
  onRetour: () => void;
  onBilanSeul: () => void;
  onValider: (p: PrescriptionValidee) => void;
}) {
  const prix = grille.advance_lift;
  const [seances, setSeances] = useState(SEANCES_PAR_DEFAUT);
  const [methode, setMethode] = useState<'centre' | 'alma'>('centre');
  const [n, setN] = useState(4);
  const [acompte, setAcompte] = useState(false);

  /* Au centre, jamais plus de chèques que de séances : un chèque vide n'est pas un chèque. */
  const choixCentre = ECHEANCES_CENTRE.filter((k) => k <= Math.max(1, seances));
  const nRetenu = methode === 'centre' ? Math.min(n, choixCentre[choixCentre.length - 1]) : n;

  const echeancier = useMemo(
    () =>
      construireEcheancierCure({
        seances,
        prixSeance: prix,
        options: 0,
        methode,
        n: nRetenu,
        acompte: methode === 'centre' && acompte ? prix : 0,
      }),
    [seances, prix, methode, nRetenu, acompte],
  );

  const montantTotal = seances * prix;
  const premier = echeancier.echeances[0];
  const suite = echeancier.echeances.slice(1);
  const mensualitesEgales = methode === 'alma' && (echeancier.n === 10 || echeancier.n === 12);

  function proposition(): PrescriptionValidee {
    return {
      lignes: [{ technologie: 'advance_lift', seances, prixUnitaire: prix }],
      electro: false,
      guide: false,
      tenue: false,
      montantTotal,
      bilanDejaRegle: 0,
      modeReglement: echeancier.mode,
      frais: echeancier.frais,
      echeances: echeancier.echeances,
    };
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="surtitre">Votre cure</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ardoise-900">
          Ce que nous proposons à {prenom}
        </h1>
        <p className="mt-1 text-sm text-ardoise-500">
          Le nombre de séances d’Advance Lift se décide avec elle : le Bio-Portrait éclaire, il ne
          prescrit pas.
        </p>
      </div>

      {/* Le nombre de séances, à la main de la thérapeute. */}
      <section className="carte flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-semibold text-ardoise-900">Advance Lift</p>
          <p className="text-xs text-ardoise-500">{formaterEuros(prix)} la séance</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSeances((s) => Math.max(1, s - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ardoise-300 text-ardoise-700 hover:border-marine-400"
            aria-label="Une séance de moins"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            min={1}
            max={60}
            value={seances}
            onChange={(e) => setSeances(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            className="chiffres w-20 rounded-xl border border-ardoise-300 px-2 py-2 text-center text-lg font-bold text-ardoise-900"
            aria-label="Nombre de séances"
          />
          <button
            type="button"
            onClick={() => setSeances((s) => Math.min(60, s + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ardoise-300 text-ardoise-700 hover:border-marine-400"
            aria-label="Une séance de plus"
          >
            <Plus className="h-4 w-4" />
          </button>
          <span className="text-sm text-ardoise-600">séances</span>
        </div>
      </section>

      {/* Le règlement, dans le bloc sombre du devis. */}
      <section className="overflow-hidden rounded-2xl bg-marine-900 px-6 py-6 text-center text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-marine-300">
          Votre cure Advance Lift
        </p>

        <div className="mt-4 flex justify-center gap-2">
          {(['centre', 'alma'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethode(m);
                setN(4);
              }}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                methode === m
                  ? 'border-white bg-white text-marine-900'
                  : 'border-white/25 bg-white/10 text-marine-100 hover:bg-white/20'
              }`}
            >
              {m === 'centre' ? 'Au centre · chèques' : 'Alma · carte'}
            </button>
          ))}
        </div>

        {methode === 'centre' && echeancier.n === 1 && !acompte ? (
          <>
            <div className="chiffres mt-5 text-5xl font-bold">{formaterEurosJuste(montantTotal)}</div>
            <div className="mt-1.5 text-sm text-marine-200">en une fois · sans frais</div>
          </>
        ) : (
          <>
            <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-marine-300">
              {methode === 'centre'
                ? acompte
                  ? 'Acompte · aujourd’hui'
                  : '1re échéance · sans frais'
                : mensualitesEgales
                  ? `${echeancier.n} mensualités égales · via Alma`
                  : `1er versement · ${echeancier.n} fois via Alma`}
            </div>
            <div className="chiffres mt-1 text-5xl font-bold">
              {formaterEurosJuste(premier?.montant ?? 0)}
              {mensualitesEgales && <span className="text-xl font-semibold"> /mois</span>}
            </div>

            <div className="mx-auto mt-4 max-w-xs">
              {suite.map((e) => (
                <div
                  key={`${e.type ?? 'echeance'}-${e.rang}`}
                  className="flex justify-between border-b border-white/15 py-1 text-[13px] text-marine-100"
                >
                  <span>{e.type === 'acompte' ? 'Acompte' : `Échéance ${e.rang}`}</span>
                  <span className="chiffres font-semibold text-white">{formaterEurosJuste(e.montant)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {methode === 'alma' ? (
          <div className="mx-auto mt-4 max-w-xs space-y-2">
            <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-left">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-marine-300">
                À saisir sur Alma
              </div>
              <div className="chiffres mt-0.5 text-xl font-bold">{formaterEuros(montantTotal, 2)}</div>
              <div className="text-[11px] text-marine-200">
                le montant de la cure, sans les frais — Alma les ajoute lui-même
              </div>
            </div>
            <div className="px-3 text-[13px] text-marine-100">
              <div className="flex justify-between gap-3">
                <span>La cliente réglera en tout</span>
                <span className="chiffres font-semibold text-white">
                  {formaterEuros(echeancier.montantARegler, 2)}
                </span>
              </div>
              <div className="mt-0.5 flex justify-between gap-3 text-marine-300">
                <span>dont frais Alma</span>
                <span className="chiffres">{formaterEuros(echeancier.frais, 2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-marine-200">
            Montant total : <span className="chiffres font-semibold text-white">{formaterEurosJuste(montantTotal)}</span>
            <span className="block text-xs text-marine-300">
              {seances} séance{seances > 1 ? 's' : ''} · {formaterEuros(prix)} la séance
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {(methode === 'centre' ? choixCentre : ECHEANCES_ALMA).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setN(k)}
              className={`chiffres rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                nRetenu === k
                  ? 'border-white bg-white text-marine-900'
                  : 'border-white/25 bg-white/10 text-marine-100 hover:bg-white/20'
              }`}
            >
              {k}×
            </button>
          ))}
        </div>

        <p className="mx-auto mt-3 max-w-sm text-[11px] text-marine-300">
          {methode === 'centre'
            ? 'Par chèques au centre. Chaque chèque couvre un nombre entier de séances.'
            : `Frais Alma de ${String(tauxFraisAlma(echeancier.n, montantTotal)).replace('.', ',')} %, à sa charge${
                mensualitesEgales ? ', répartis sur les mensualités.' : ', pris en totalité sur le premier versement.'
              }`}
        </p>

        {/*
          L'acompte : une séance, toujours. Pas de bilan à 129 € ici — la
          cliente qui ne peut pas tout régler aujourd'hui laisse le prix
          d'une séance, et le reste suit sur les chèques.
        */}
        {methode === 'centre' && (
          <div className="mx-auto mt-4 max-w-sm border-t border-white/15 pt-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-left">
              <input
                type="checkbox"
                checked={acompte}
                onChange={(e) => setAcompte(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/40 bg-white/10 accent-rose-500"
              />
              <span className="text-[11px] leading-snug text-marine-200">
                <span className="font-semibold text-white">
                  Acompte aujourd’hui ({formaterEuros(prix)}, une séance)
                </span>
                <span className="block">
                  {acompte
                    ? 'Il se déduit du total ; la première échéance tombe dans quinze jours.'
                    : 'À cocher si elle ne peut pas régler la première échéance aujourd’hui.'}
                </span>
              </span>
            </label>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ardoise-200 pt-5">
        <button onClick={onRetour} disabled={enregistrement} className="bouton-discret">
          Revenir au Bio-Portrait
        </button>

        <div className="flex flex-wrap gap-3">
          {/*
            La cliente qui ne démarre pas repart avec sa première séance —
            85 €, le prix d'une séance d'Advance Lift — et son Bio-Portrait
            par mail. Pas de bilan à part : c'est la séance qui se règle.
          */}
          <button
            onClick={onBilanSeul}
            disabled={enregistrement}
            className="bouton-discret"
            title="Le prix d'une séance est facturé, aucune cure n'est ouverte, et son Bio-Portrait part par mail."
          >
            <Mail className="h-4 w-4" />
            Bilan seul · {formaterEuros(prix)}
          </button>
          <button onClick={() => onValider(proposition())} disabled={enregistrement} className="bouton-fort">
            {enregistrement && <Loader2 className="h-4 w-4 animate-spin" />}
            Valider la cure
          </button>
        </div>
      </div>
    </div>
  );
}
