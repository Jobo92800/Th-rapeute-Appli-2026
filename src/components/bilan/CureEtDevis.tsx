import { useMemo, useState } from 'react';
import { AlertTriangle, Ban, Eye, Loader2, Mail, Minus, Pencil, Plus, Stethoscope } from 'lucide-react';
import type { Bareme, Prestation } from '../../domain/bioportrait';
import { detailInclus, type DetailInclus } from '../../domain/inclus';
import BulleInclus from './BulleInclus';
import {
  FORMULES,
  LIBELLES_NIVEAU,
  appliquerFormule,
  ligneAjoutee,
  lignesRetenues,
  prescrire,
  prestationsAjoutables,
  type CodeFormule,
  type Depouillement,
  type LignePrescrite,
} from '../../domain/prescription';
import {
  ECHEANCES_ALMA,
  ECHEANCES_CENTRE,
  creneauxParDefaut,
  dureeCureEnMois,
  echeancesCentrePossibles,
  montantAcompte,
  tauxFraisAlma,
  LIBELLES_TECHNOLOGIE,
  construireEcheancierCure,
  formaterEuros,
  formaterEurosJuste,
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
  /** Ce que la cliente a déjà réglé en ligne. Zéro le plus souvent. */
  bilanDejaRegle: number;
  modeReglement: ModeReglement;
  frais: number;
  echeances: Array<{ rang: number; montant: number; type?: 'acompte' | 'echeance' | 'bilan' }>;
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
  /**
   * La cliente ne démarre pas : on garde le bilan et ce qu'on lui a
   * proposé, et son BioPortrait part par mail avec la proposition.
   */
  onBilanSeul: (propose: PrescriptionValidee) => void;
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
  onValider,
}: Props) {
  /*
    Les formules ne viennent plus du barème.

    Elles y étaient décrites par un simple facteur — 1, 0,8, 0,5 — et ça
    suffisait tant qu'une formule n'était qu'une multiplication. Ce n'est
    plus vrai : Équilibre retombe sur des paliers réels, et Découverte ne
    réduit pas, elle choisit une prestation. Une règle pareille ne tient pas
    dans une donnée, elle vit dans le domaine avec le reste du calcul.
  */
  const formules = FORMULES;
  const [formule, setFormule] = useState<CodeFormule>('integrale');
  const [ajusts, setAjusts] = useState<Partial<Record<Prestation, number>>>({});
  /*
    Les soins ajoutés à la main, que le bilan ne proposait pas. Ils vivent à
    part de la prescription : changer de formule ne doit pas les rogner —
    ils ne viennent pas du barème, ils viennent d'une décision.
  */
  const [ajoutes, setAjoutes] = useState<Prestation[]>([]);
  const [methode, setMethode] = useState<'centre' | 'alma'>('centre');
  const [nEcheances, setNEcheances] = useState(4);
  /*
    L'acompte : pour la cliente qui dit oui mais ne peut pas tout régler
    aujourd'hui. Il couvre le bilan et les créneaux déjà bloqués pour elle.
    Rangé par défaut — le cas courant est de ne pas en demander.
  */
  const [acompteOuvert, setAcompteOuvert] = useState(false);
  const [creneaux, setCreneaux] = useState<number | null>(null);
  /*
    Le bilan réglé en ligne, à la prise de rendez-vous. Rien à voir avec
    l'acompte : là, l'argent est déjà entré, ailleurs, avant qu'on la voie.
    La cure garde son prix ; c'est ce qu'il reste à régler au centre qui
    baisse d'autant.
  */
  const [bilanRegleEnLigne, setBilanRegleEnLigne] = useState(false);
  const [devisRevele, setDevisRevele] = useState(false);
  const [bulle, setBulle] = useState<DetailInclus | null>(null);
  /*
    Les réglages restent rangés. L'écran se présente à la cliente : des
    boutons plus et moins à côté de chaque soin invitent à négocier le
    nombre de séances, alors que c'est le bilan qui l'a déterminé. La
    thérapeute les fait apparaître quand elle en a besoin.
  */
  const [edition, setEdition] = useState(false);

  const base = useMemo(() => prescrire(bareme, depouillement), [bareme, depouillement]);

  /** La cure telle qu'elle est à cet instant : formule, puis ajustements. */
  const cure: LignePrescrite[] = useMemo(() => {
    const prescrites = appliquerFormule(base, formule);
    const supplementaires = ajoutes
      .filter((p) => !prescrites.some((l) => l.presta === p))
      .map((p) => ligneAjoutee(depouillement, p));

    return [...prescrites, ...supplementaires].map((l) =>
      ajusts[l.presta] != null ? { ...l, seances: ajusts[l.presta]! } : l,
    );
  }, [base, formule, ajusts, ajoutes, depouillement]);

  const ajoutables = useMemo(() => prestationsAjoutables(depouillement, cure), [depouillement, cure]);

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
  const creneauxRetenus = creneaux ?? creneauxParDefaut(retenues.length);
  const dejaRegle = bilanRegleEnLigne ? grille.bilan : 0;
  const acompte =
    acompteOuvert && methode === 'centre'
      ? montantAcompte({
          // Le bilan déjà payé ne se redemande pas : l'acompte se réduit
          // alors aux créneaux bloqués pour elle.
          prixBilan: bilanRegleEnLigne ? 0 : grille.bilan,
          creneauxReserves: creneauxRetenus,
          prixSeance: grille.seance,
        })
      : 0;

  const nRetenu = choixEcheances.includes(nEcheances)
    ? nEcheances
    : (choixEcheances[choixEcheances.length - 1] ?? 1);

  /*
    Ce qu'elle sort aujourd'hui : la première ligne qui n'est pas déjà
    encaissée. Sans ça, le grand chiffre de l'écran annonçait « 129 € » à
    une cliente qui doit en réalité poser le premier chèque de la cure.
  */
  const echeancier = construireEcheancierCure({
    seances: totalSeances,
    prixSeance: grille.seance,
    options,
    methode,
    n: nRetenu,
    acompte,
    bilanDejaRegle: dejaRegle,
  });

  const premierARegler = echeancier.echeances.find((e) => e.type !== 'bilan');

  /*
    Alma ne s'y prend pas de la même façon selon la formule : en 10× et 12×
    les mensualités sont égales, en 2×, 3× et 4× tous les frais tombent sur
    le premier versement. L'écran doit dire laquelle des deux, sinon la
    cliente attend un montant et en voit un autre.
  */
  const mensualitesEgales = methode === 'alma' && echeancier.n >= 10;

  /*
    Ce que la thérapeute tape sur le site d'Alma : le prix de la cure, sans
    les frais — Alma les calcule lui-même — et sans le bilan déjà réglé en
    ligne, qu'il n'a pas à financer.
  */
  const montantAFinancer = echeancier.montantARegler - echeancier.frais - dejaRegle;

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
      // Le prix de la cure ne bouge pas : le bilan déjà réglé en fait
      // partie, il est simplement encaissé avant les autres.
      montantTotal: totalSeances * grille.seance + options,
      bilanDejaRegle: dejaRegle,
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
          /*
            Écarté par la formule, pas par la santé : la Découverte n'en
            garde qu'un. À distinguer d'un soin contre-indiqué — celui-là est
            impossible, celui-ci est seulement hors budget.
          */
          const ecarte = !retire && l.seances === 0;

          return (
            <div
              key={l.presta}
              className={`flex flex-wrap items-center gap-3.5 rounded-2xl border px-4 py-3.5 ${
                retire
                  ? 'border-ardoise-200 bg-ardoise-50 opacity-60'
                  : ecarte
                    ? 'border-dashed border-ardoise-200 bg-ardoise-50/50 opacity-70'
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
                  ) : ecarte ? (
                    /*
                      Découverte ne garde qu'une prestation. Les autres ne
                      sont pas contre-indiquées — elles restent utiles, et
                      c'est le budget qui les écarte. On les montre donc,
                      pâlies : la cliente voit ce qu'elle laisse, et ce
                      qu'elle retrouvera en montant d'une formule.
                    */
                    <span className="rounded-full bg-ardoise-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ardoise-500">
                      Pas dans cette formule
                    </span>
                  ) : surveille ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                      <Stethoscope className="h-3 w-3" />
                      Avis médical
                    </span>
                  ) : l.ajoute ? (
                    /*
                      « Proposé » serait un mensonge : le bilan ne l'a pas
                      proposé, la thérapeute l'a ajouté. La cliente doit
                      pouvoir savoir d'où vient chaque ligne de sa cure.
                    */
                    <span className="rounded-full bg-marine-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-marine-800">
                      Ajouté
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
                    : ecarte
                      ? 'Recommandé par votre bilan, mais pas compris dans cette formule.'
                      : surveille
                        ? 'Possible après avis médical. Le soin reste au programme.'
                        : (bareme.PRESTA?.[l.presta]?.d ?? '')}
                </p>
              </div>

              {!retire && !ecarte && (
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

        {/*
          Ajouter un soin que le bilan n'a pas proposé.

          Le barème ne voit que les réponses : une cliente peut dire en
          s'asseyant quelque chose qu'aucune question n'a posé. Ces boutons
          n'apparaissent qu'en modification — l'écran présenté à la cliente
          ne doit pas ressembler à une carte de restaurant.

          Un soin retiré par une réponse de santé n'y figure jamais : celui-là
          n'est pas « non proposé », il est contre-indiqué.
        */}
        {edition && ajoutables.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-ardoise-300 px-4 py-3">
            <span className="text-xs text-ardoise-500">Ajouter un soin non proposé :</span>
            {ajoutables.map((presta) => (
              <button
                key={presta}
                type="button"
                onClick={() => setAjoutes((a) => [...a, presta])}
                className="inline-flex items-center gap-1.5 rounded-full border border-marine-300 bg-white px-3 py-1 text-xs font-semibold text-marine-700 hover:bg-marine-50"
              >
                <Plus className="h-3 w-3" />
                {bareme.PRESTA?.[presta]?.n ?? LIBELLES_TECHNOLOGIE[TECHNO[presta]]}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Les formules --------------------------------------------------- */}
      {formules.length > 0 && (
        <section>
          <h2 className="surtitre mb-2">Le rythme de la cure</h2>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            {formules.map((f) => (
              <button
                key={f.code}
                type="button"
                onClick={() => {
                  setFormule(f.code);
                  setAjusts({});
                }}
                className={`flex-1 rounded-2xl border-[1.5px] px-3 py-3 text-center transition-colors ${
                  formule === f.code
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
            {bareme.INCLUS.map((x) => {
              const detail = detailInclus(x.i);
              return (
                <div key={x.t} className="carte flex items-start gap-3.5 p-4">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-marine-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ardoise-900">{x.t}</div>
                    <div className="mt-0.5 text-[13px] leading-relaxed text-ardoise-600">{x.d}</div>
                  </div>
                  {/*
                    Deux lignes seulement portent ce bouton : le guide et
                    l'application audio, les deux choses que la cliente ne peut
                    pas voir au comptoir.
                  */}
                  {detail && (
                    <button
                      type="button"
                      onClick={() => setBulle(detail)}
                      aria-label={`En savoir plus : ${x.t}`}
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-marine-400 text-xs font-bold text-marine-700 transition-colors hover:bg-marine-50"
                    >
                      i
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {bulle && <BulleInclus detail={bulle} onFerme={() => setBulle(null)} />}

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
                  {formaterEuros(echeancier.montantARegler - dejaRegle)}
                </div>
                <div className="mt-1.5 text-sm text-marine-200">
                  en une fois · sans frais
                  {dejaRegle > 0 && (
                    <span className="mt-0.5 block text-xs text-marine-300">
                      cure {formaterEuros(echeancier.montantARegler)}, dont{' '}
                      {formaterEuros(dejaRegle)} déjà réglés en ligne
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-marine-300">
                  {methode === 'centre'
                    ? acompte > 0
                      ? 'Acompte · avant la prochaine séance'
                      : '1re échéance · sans frais'
                    : /*
                        « Fois égales » n'est vrai qu'en 10× et 12×. En 2×, 3×
                        et 4×, Alma prend la totalité de ses frais sur le
                        premier versement : annoncer l'égalité, c'est
                        promettre à la cliente un prélèvement qu'elle ne
                        verra pas sur son relevé.
                      */
                      mensualitesEgales
                      ? `${echeancier.n} mensualités égales · via Alma`
                      : `1er versement · ${echeancier.n} fois via Alma`}
                </div>
                <div className="chiffres mt-1 text-5xl font-bold">
                  {/*
                    Le bilan déjà réglé n'est pas ce qu'elle va sortir
                    aujourd'hui : le gros chiffre montre le premier versement
                    qui reste à faire.
                  */}
                  {formaterEurosJuste(premierARegler?.montant ?? 0)}
                  {/* « /mois » ne vaut que quand les mensualités le sont vraiment. */}
                  {mensualitesEgales && <span className="text-xl font-semibold"> /mois</span>}
                </div>

                <div className="mx-auto mt-4 max-w-xs">
                    {echeancier.echeances
                      .filter((e) => e !== premierARegler)
                      .map((e) => (
                      <div
                        key={`${e.type ?? 'echeance'}-${e.rang}`}
                        className="flex justify-between border-b border-white/15 py-1 text-[13px] text-marine-100"
                      >
                        <span>
                          {e.type === 'bilan'
                            ? 'Bilan déjà réglé'
                            : e.type === 'acompte'
                              ? 'Acompte'
                              : `Échéance ${e.rang}`}
                        </span>
                        <span className="chiffres font-semibold text-white">
                          {e.type === 'bilan' ? '− ' : ''}
                          {formaterEurosJuste(e.montant)}
                        </span>
                      </div>
                      ))}
                </div>

                {methode === 'alma' ? (
                  /*
                    DEUX MONTANTS, ET ILS NE SERVENT PAS À LA MÊME PERSONNE.

                    Celui du haut est pour la thérapeute : c'est ce qu'elle
                    tape sur le site d'Alma pour créer le paiement. Alma
                    calcule ses frais dessus — saisir le total les ferait
                    payer deux fois.

                    Celui du bas est pour la cliente : ce qu'elle règlera en
                    tout, frais compris.

                    Les deux sont écrits au centime. « 2 114 € » arrondi
                    cachait trente-huit centimes, et une cure saisie à un
                    montant faux fait dériver toutes les mensualités.
                  */
                  <div className="mx-auto mt-4 max-w-xs space-y-2">
                    <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-left">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-marine-300">
                        À saisir sur Alma
                      </div>
                      <div className="chiffres mt-0.5 text-xl font-bold">
                        {formaterEuros(montantAFinancer, 2)}
                      </div>
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
                      {dejaRegle > 0 && (
                        <div className="mt-0.5 flex justify-between gap-3 text-marine-300">
                          <span>dont bilan déjà réglé en ligne</span>
                          <span className="chiffres">{formaterEuros(dejaRegle, 2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-marine-200">
                    Montant total : {formaterEuros(echeancier.montantARegler)}
                    {dejaRegle > 0 && (
                      <span className="mt-0.5 block text-marine-300">
                        dont {formaterEuros(dejaRegle)} déjà réglés en ligne · reste{' '}
                        <b className="text-white">
                          {formaterEuros(echeancier.montantARegler - dejaRegle)}
                        </b>{' '}
                        au centre
                      </span>
                    )}
                  </div>
                )}
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
                ? acompte > 0
                  ? 'Par chèques au centre. L’acompte se déduit du total ; le reste, guide et tenue compris, se répartit sur les échéances.'
                  : 'Par chèques au centre. Le guide et la tenue sont sur la première échéance.'
                : `Frais Alma de ${String(tauxFraisAlma(echeancier.n, totalSeances * grille.seance + options)).replace('.', ',')} %, à sa charge${
                    mensualitesEgales
                      ? ', répartis sur les mensualités.'
                      : ', pris en totalité sur le premier versement.'
                  }`}
            </p>

            {/*
              Le bilan réglé en ligne. Toujours visible, contrairement à
              l'acompte : la thérapeute doit se poser la question à chaque
              cure, sinon on réclame à une cliente ce qu'elle a déjà payé.
            */}
            <div className="mx-auto mt-4 max-w-sm border-t border-white/15 pt-3">
              <label className="flex cursor-pointer items-start gap-2.5 text-left">
                <input
                  type="checkbox"
                  checked={bilanRegleEnLigne}
                  onChange={(e) => setBilanRegleEnLigne(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/40 bg-white/10 accent-rose-500"
                />
                <span className="text-[11px] leading-snug text-marine-200">
                  <span className="font-semibold text-white">
                    Bilan déjà réglé en ligne ({formaterEuros(grille.bilan)})
                  </span>
                  <span className="block">
                    {bilanRegleEnLigne
                      ? 'Déduit de ce qu’elle règle au centre. La cure garde son prix.'
                      : 'À cocher si elle a payé son bilan en prenant rendez-vous.'}
                  </span>
                </span>
              </label>
            </div>

            {/* L'acompte, rangé tant qu'on n'en a pas besoin. */}
            {methode === 'centre' && (
              <div className="mx-auto mt-4 max-w-sm border-t border-white/15 pt-3">
                {!acompteOuvert ? (
                  <button
                    type="button"
                    onClick={() => setAcompteOuvert(true)}
                    className="text-[11px] font-semibold text-marine-200 underline underline-offset-2 hover:text-white"
                  >
                    Impossible de tout régler aujourd’hui ?
                  </button>
                ) : (
                  <div className="text-[11px] text-marine-200">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <span>Acompte avant la prochaine séance ·</span>
                      <button
                        type="button"
                        onClick={() => setCreneaux(Math.max(0, creneauxRetenus - 1))}
                        className="h-5 w-5 rounded-md border border-white/25 leading-none text-white hover:bg-white/15"
                        aria-label="Un créneau de moins"
                      >
                        −
                      </button>
                      <span className="chiffres font-semibold text-white">
                        {creneauxRetenus} créneau{creneauxRetenus > 1 ? 'x' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCreneaux(creneauxRetenus + 1)}
                        className="h-5 w-5 rounded-md border border-white/25 leading-none text-white hover:bg-white/15"
                        aria-label="Un créneau de plus"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAcompteOuvert(false);
                          setCreneaux(null);
                        }}
                        className="underline underline-offset-2 hover:text-white"
                      >
                        retirer
                      </button>
                    </div>
                    <p className="mt-1.5">
                      Le bilan ({formaterEuros(grille.bilan)}) et {creneauxRetenus} créneau
                      {creneauxRetenus > 1 ? 'x' : ''} de 30 minutes bloqué
                      {creneauxRetenus > 1 ? 's' : ''} dans le planning. Il se déduit du total.
                    </p>
                  </div>
                )}
              </div>
            )}

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

          {/*
            Ce que la cure contient, sans le prix de chaque ligne. La cliente
            achète un accompagnement, pas un panier : détailler « 15 séances à
            59 € » l'invite à retirer des séances pour faire baisser la note,
            et c'est exactement la conversation qu'on ne veut pas avoir. Le
            montant à régler reste en grand juste au-dessus.
          */}
          <div className="bg-white px-6 py-4 text-[13px] text-ardoise-600">
            {retenues.map((l) => (
              <div
                key={l.presta}
                className="border-b border-dashed border-ardoise-200 py-1.5 last:border-0"
              >
                {bareme.PRESTA?.[l.presta]?.n} — {l.seances} séances
              </div>
            ))}
            {luxo && (
              <div className="border-b border-dashed border-ardoise-200 py-1.5">
                Guide de rééquilibrage alimentaire
              </div>
            )}
            {electro && <div className="py-1.5">Tenue I-Shape</div>}
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
          {/*
            Un seul bouton pour la cliente qui ne démarre pas.

            Il y en avait deux — « Bilan seul » et « Envoyer le récap » —
            et la différence ne se voyait pas : les deux facturaient le
            bilan et n'ouvraient pas de cure, seul le mail les séparait. On
            ne choisit plus : elle repart avec son BioPortrait et la
            proposition qu'on vient de lui présenter, toujours. Ne pas les
            lui envoyer n'a jamais rien fait gagner à personne.
          */}
          <button
            onClick={() => onBilanSeul(propositionCourante())}
            disabled={enregistrement || totalSeances === 0}
            className="bouton-discret"
            title="Le bilan est facturé, la cure n'est pas ouverte, et son BioPortrait part par mail avec cette proposition."
          >
            <Mail className="h-4 w-4" />
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
