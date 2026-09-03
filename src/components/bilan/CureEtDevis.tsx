import { useMemo, useState } from 'react';
import { AlertTriangle, Ban, Eye, Loader2, Mail, Minus, Pencil, Plus, Stethoscope } from 'lucide-react';
import type { Bareme, Prestation } from '../../domain/bioportrait';
import {
  LIBELLES_NIVEAU,
  appliquerFormule,
  lignesRetenues,
  prescrire,
  type Depouillement,
  type LignePrescrite,
} from '../../domain/prescription';
import {
  ECHEANCES_ALMA,
  ECHEANCES_CENTRE,
  dureeCureEnMois,
  echeancesCentrePossibles,
  FRAIS_ALMA,
  LIBELLES_TECHNOLOGIE,
  construireEcheancierCure,
  formaterEuros,
  type GrilleTarifaire,
  type ModeReglement,
  type Technologie,
} from '../../domain/tarification';

/** Ce qui remonte à l'enregistrement une fois la cure validée. */
export interface PrescriptionValidee {
  lignes: Array<{ technologie: Technologie; seances: number; prixUnitaire: number }>;
  electro: boolean;
  guide: boolean;
  tenue: boolean;
  montantTotal: number;
  modeReglement: ModeReglement;
  frais: number;
  echeances: Array<{ rang: number; montant: number }>;
}

const TECHNO: Record<Prestation, Technologie> = {
  LUXO: 'luxo',
  RELAX: 'relax',
  ISHAPE: 'ishape',
  PRESSO: 'presso',
};

const COULEUR_NIVEAU: Record<string, string> = {
  prop: 'bg-ardoise-100 text-ardoise-600',
  fort: 'bg-marine-100 text-marine-800',
  oblig: 'bg-rose-500 text-white',
};

interface Props {
  bareme: Bareme;
  depouillement: Depouillement;
  grille: GrilleTarifaire;
  prenom: string;
  enregistrement: boolean;
  onRetour: () => void;
  /** La cliente ne démarre pas : on garde le bilan, et ce qu'on lui a proposé. */
  onBilanSeul: (propose: PrescriptionValidee) => void;
  /** Elle veut réfléchir : même chose, plus le récapitulatif par mail. */
  onRecap: (propose: PrescriptionValidee) => void;
  onValider: (p: PrescriptionValidee) => void;
}

/**
 * La cure qui découle du bilan, et son devis.
 *
 * Trois principes tenus par cet écran :
 *
 *   — la cure n'est pas composée à la main : elle découle des réponses. La
 *     thérapeute ajuste, elle ne part pas d'une page blanche ;
 *   — un soin contre-indiqué ne se facture pas. Il reste affiché, barré,
 *     avec sa raison : la cliente doit comprendre pourquoi il n'y est pas ;
 *   — le prix ne s'affiche pas tout seul. Il se révèle d'un geste, après
 *     avoir présenté ce qui est inclus. C'est le moment du rendez-vous où
 *     l'on parle d'argent, et il se choisit.
 */
export default function CureEtDevis({
  bareme,
  depouillement,
  grille,
  prenom,
  enregistrement,
  onRetour,
  onBilanSeul,
  onRecap,
  onValider,
}: Props) {
  const formules = bareme.FORMULAS ?? [];
  const [formule, setFormule] = useState(1);
  const [ajusts, setAjusts] = useState<Partial<Record<Prestation, number>>>({});
  const [methode, setMethode] = useState<'centre' | 'alma'>('centre');
  const [nEcheances, setNEcheances] = useState(4);
  const [devisRevele, setDevisRevele] = useState(false);
  /*
    Les réglages restent rangés. L'écran se présente à la cliente : des
    boutons plus et moins à côté de chaque soin invitent à négocier le
    nombre de séances, alors que c'est le bilan qui l'a déterminé. La
    thérapeute les fait apparaître quand elle en a besoin.
  */
  const [edition, setEdition] = useState(false);

  const base = useMemo(() => prescrire(bareme, depouillement), [bareme, depouillement]);

  /** La cure telle qu'elle est à cet instant : formule, puis ajustements. */
  const cure: LignePrescrite[] = useMemo(
    () =>
      appliquerFormule(base, formule).map((l) =>
        ajusts[l.presta] != null ? { ...l, seances: ajusts[l.presta]! } : l,
      ),
    [base, formule, ajusts],
  );

  const retenues = lignesRetenues(cure);
  const totalSeances = retenues.reduce((n, l) => n + l.seances, 0);
  const luxo = retenues.some((l) => l.presta === 'LUXO' || l.presta === 'RELAX');
  const electro = retenues.some((l) => l.presta === 'ISHAPE');
  const options = (luxo ? grille.guide : 0) + (electro ? grille.tenue : 0);

  /*
    La durée de la cure plafonne le nombre de chèques : on n'encaisse pas un
    règlement après la dernière séance. Elle se recalcule à chaque
    changement de formule ou d'ajustement, donc le choix se resserre tout
    seul quand la thérapeute réduit l'offre.
  */
  const soinsPrincipaux = retenues.filter((l) => l.presta !== 'RELAX').length;
  const seancesDuPlusLong = retenues.reduce((n, l) => Math.max(n, l.seances), 0);
  const dureeMois = dureeCureEnMois(seancesDuPlusLong, soinsPrincipaux);

  const choixEcheances =
    methode === 'centre' ? echeancesCentrePossibles(dureeMois) : ECHEANCES_ALMA;

  /*
    Le nombre retenu, et non celui qui traîne dans l'état : la thérapeute a
    pu choisir 4 chèques puis raccourcir la cure. Sans ce garde-fou, l'écran
    afficherait un échéancier que le plafond n'autorise plus.
  */
  const nRetenu = choixEcheances.includes(nEcheances)
    ? nEcheances
    : (choixEcheances[choixEcheances.length - 1] ?? 1);

  const echeancier = construireEcheancierCure({
    seances: totalSeances,
    prixSeance: grille.seance,
    options,
    methode,
    n: nRetenu,
  });

  function ajuster(presta: Prestation, delta: number) {
    const actuelle = cure.find((l) => l.presta === presta)?.seances ?? 0;
    setAjusts((a) => ({ ...a, [presta]: Math.max(0, actuelle + delta) }));
  }

  /*
    Ce qui est à l'écran à cet instant : c'est ce que la cliente a sous les
    yeux et ce qu'on lui a annoncé. Les trois boutons du bas en partent, pour
    qu'aucun ne puisse raconter autre chose que les deux autres.
  */
  function propositionCourante(): PrescriptionValidee {
    return {
      lignes: retenues.map((l) => ({
        technologie: TECHNO[l.presta],
        seances: l.seances,
        prixUnitaire: grille.seance,
      })),
      electro,
      guide: luxo,
      tenue: electro,
      montantTotal: totalSeances * grille.seance + options,
      modeReglement: echeancier.mode,
      frais: echeancier.frais,
      echeances: echeancier.echeances,
    };
  }

  function valider() {
    onValider(propositionCourante());
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="surtitre">Votre programme sur mesure</div>
        <h1 className="mt-1 text-3xl font-light tracking-tight text-ardoise-900">
          La cure {prenom ? <b className="font-semibold">de {prenom}</b> : null}
        </h1>
      </header>

      {/* Les soins ------------------------------------------------------ */}
      <section className="space-y-2.5">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEdition((v) => !v)}
            aria-pressed={edition}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              edition
                ? 'border-marine-600 bg-marine-600 text-white'
                : 'border-ardoise-200 bg-white text-marine-700 hover:bg-marine-50'
            }`}
          >
            <Pencil className="mr-1.5 inline h-3 w-3" />
            {edition ? 'Terminer' : 'Modifier'}
          </button>
        </div>

        {cure.map((l) => {
          const retire = l.contreIndication === 'rem';
          const surveille = l.contreIndication === 'med';

          return (
            <div
              key={l.presta}
              className={`flex flex-wrap items-center gap-3.5 rounded-2xl border px-4 py-3.5 ${
                retire
                  ? 'border-ardoise-200 bg-ardoise-50 opacity-60'
                  : surveille
                    ? 'border-amber-200 bg-amber-50/60'
                    : 'border-ardoise-200 bg-white'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-semibold text-ardoise-900 ${retire ? 'line-through' : ''}`}
                  >
                    {bareme.PRESTA?.[l.presta]?.n ?? LIBELLES_TECHNOLOGIE[TECHNO[l.presta]]}
                  </span>

                  {retire ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ardoise-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ardoise-600">
                      <Ban className="h-3 w-3" />
                      Retiré
                    </span>
                  ) : surveille ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                      <Stethoscope className="h-3 w-3" />
                      Avis médical
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${COULEUR_NIVEAU[l.niveau]}`}
                    >
                      {LIBELLES_NIVEAU[l.niveau]}
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-xs text-ardoise-500">
                  {retire
                    ? 'Contre-indiqué par une réponse de santé — ce soin n’est pas facturé.'
                    : surveille
                      ? 'Possible après avis médical. Le soin reste au programme.'
                      : (bareme.PRESTA?.[l.presta]?.d ?? '')}
                </p>
              </div>

              {!retire && (
                <div className="flex shrink-0 items-center gap-2">
                  {edition && (
                    <button
                      type="button"
                      onClick={() => ajuster(l.presta, -1)}
                      disabled={l.seances <= 0}
                      aria-label="Une séance de moins"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-ardoise-200 text-marine-700 hover:bg-marine-50 disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <span className="chiffres min-w-6 text-center text-lg font-bold text-ardoise-900">
                    {l.seances}
                  </span>

                  {edition && (
                    <button
                      type="button"
                      onClick={() => ajuster(l.presta, 1)}
                      aria-label="Une séance de plus"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-ardoise-200 text-marine-700 hover:bg-marine-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <span className="text-[11px] text-ardoise-400">séances</span>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Les formules --------------------------------------------------- */}
      {formules.length > 0 && (
        <section>
          <h2 className="surtitre mb-2">Le rythme de la cure</h2>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            {formules.map((f) => (
              <button
                key={f.n}
                type="button"
                onClick={() => {
                  setFormule(f.f);
                  setAjusts({});
                }}
                className={`flex-1 rounded-2xl border-[1.5px] px-3 py-3 text-center transition-colors ${
                  formule === f.f
                    ? 'border-marine-500 bg-marine-50'
                    : 'border-ardoise-200 bg-white hover:border-marine-300'
                }`}
              >
                <div className="text-sm font-semibold text-ardoise-900">{f.n}</div>
                <div className="mt-0.5 text-[11px] leading-tight text-ardoise-500">{f.d}</div>
                {f.rec && (
                  <div className="mt-1.5 text-[9px] font-bold uppercase tracking-wide text-marine-700">
                    Recommandée
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Ce qui est inclus ---------------------------------------------- */}
      {bareme.INCLUS && bareme.INCLUS.length > 0 && (
        <section>
          <h2 className="surtitre mb-2">Ce qui est compris, quoi qu'il arrive</h2>
          <div className="space-y-2">
            {bareme.INCLUS.map((x) => (
              <div key={x.t} className="carte flex gap-3.5 p-4">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-marine-500" />
                <div>
                  <div className="text-sm font-semibold text-ardoise-900">{x.t}</div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-ardoise-600">{x.d}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Le devis -------------------------------------------------------- */}
      <section className="relative overflow-hidden rounded-3xl">
        <div className={devisRevele ? '' : 'pointer-events-none select-none blur-[11px]'}>
          <div className="bg-marine-900 px-6 py-8 text-center text-white">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-marine-300">
              Votre accompagnement personnalisé
            </div>

            <div className="mt-4 flex justify-center gap-2">
              {(['centre', 'alma'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethode(m);
                    setNEcheances(m === 'centre' ? 4 : 4);
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

            {methode === 'centre' && echeancier.n === 1 ? (
              <>
                <div className="chiffres mt-5 text-5xl font-bold">
                  {formaterEuros(echeancier.montantARegler)}
                </div>
                <div className="mt-1.5 text-sm text-marine-200">en une fois · sans frais</div>
              </>
            ) : (
              <>
                <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-marine-300">
                  {methode === 'centre'
                    ? '1re échéance · sans frais'
                    : `${echeancier.n} fois égales · via Alma`}
                </div>
                <div className="chiffres mt-1 text-5xl font-bold">
                  {formaterEuros(echeancier.echeances[0]?.montant ?? 0, 2)}
                  {methode === 'alma' && <span className="text-xl font-semibold"> /mois</span>}
                </div>

                {methode === 'centre' && (
                  <div className="mx-auto mt-4 max-w-xs">
                    {echeancier.echeances.slice(1).map((e) => (
                      <div
                        key={e.rang}
                        className="flex justify-between border-b border-white/15 py-1 text-[13px] text-marine-100"
                      >
                        <span>Échéance {e.rang}</span>
                        <span className="chiffres font-semibold text-white">
                          {formaterEuros(e.montant, 2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 text-xs text-marine-200">
                  Montant total : {formaterEuros(echeancier.montantARegler)}
                  {echeancier.frais > 0 && (
                    <> · dont {formaterEuros(echeancier.frais, 2)} de frais Alma</>
                  )}
                </div>
              </>
            )}

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {choixEcheances.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNEcheances(n)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                    echeancier.n === n
                      ? 'border-white bg-white text-marine-900'
                      : 'border-white/25 bg-white/10 text-marine-100 hover:bg-white/20'
                  }`}
                >
                  {n}×
                </button>
              ))}
            </div>

            <p className="mx-auto mt-3 max-w-sm text-[11px] text-marine-300">
              {methode === 'centre'
                ? `Par chèques au centre. Le guide et la tenue (${formaterEuros(options)}) sont sur la première échéance.`
                : `Frais Alma de ${String(FRAIS_ALMA[echeancier.n] ?? 0).replace('.', ',')} %, à la charge de la cliente, compris dans la mensualité.`}
            </p>

            {/*
              La thérapeute doit comprendre pourquoi le 4× a disparu, sinon
              elle croit à une panne et cherche le bouton manquant.
            */}
            {methode === 'centre' && choixEcheances.length < ECHEANCES_CENTRE.length && (
              <p className="mx-auto mt-1.5 max-w-sm text-[11px] text-marine-300">
                Cette cure dure {dureeMois} mois : au-delà de {choixEcheances.length} chèques, le
                dernier serait encaissé après la dernière séance.
              </p>
            )}
          </div>

          <div className="bg-white px-6 py-4 text-[13px] text-ardoise-600">
            {retenues.map((l) => (
              <div
                key={l.presta}
                className="flex justify-between border-b border-dashed border-ardoise-200 py-1.5 last:border-0"
              >
                <span>
                  {bareme.PRESTA?.[l.presta]?.n} — {l.seances} séances
                </span>
                <span className="chiffres">{formaterEuros(l.seances * grille.seance)}</span>
              </div>
            ))}
            {luxo && (
              <div className="flex justify-between border-b border-dashed border-ardoise-200 py-1.5">
                <span>Guide de rééquilibrage alimentaire</span>
                <span className="chiffres">{formaterEuros(grille.guide)}</span>
              </div>
            )}
            {electro && (
              <div className="flex justify-between py-1.5">
                <span>Tenue I-Shape</span>
                <span className="chiffres">{formaterEuros(grille.tenue)}</span>
              </div>
            )}
          </div>
        </div>

        {!devisRevele && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-marine-50/60">
            <p className="text-sm font-semibold text-ardoise-600">
              Le récapitulatif de votre cure
            </p>
            <button type="button" onClick={() => setDevisRevele(true)} className="bouton-fort">
              <Eye className="h-4 w-4" />
              Afficher la cure
            </button>
          </div>
        )}
      </section>

      {totalSeances === 0 && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Aucune séance au programme : la cure ne peut pas être validée. Ajustez les soins, ou
          enregistrez le bilan seul.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ardoise-200 pt-5">
        <button onClick={onRetour} disabled={enregistrement} className="bouton-discret">
          Revenir au BioPortrait
        </button>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onRecap(propositionCourante())}
            disabled={enregistrement || totalSeances === 0}
            className="bouton-discret"
            title="Le bilan est facturé, la cure n'est pas ouverte, et la cliente reçoit par mail son BioPortrait avec cette proposition."
          >
            <Mail className="h-4 w-4" />
            Envoyer le récap · {formaterEuros(grille.bilan)}
          </button>
          <button
            onClick={() => onBilanSeul(propositionCourante())}
            disabled={enregistrement}
            className="bouton-discret"
          >
            Bilan seul · {formaterEuros(grille.bilan)}
          </button>
          <button
            onClick={valider}
            disabled={enregistrement || totalSeances === 0}
            className="bouton-fort"
          >
            {enregistrement && <Loader2 className="h-4 w-4 animate-spin" />}
            Valider la cure
          </button>
        </div>
      </div>
    </div>
  );
}
