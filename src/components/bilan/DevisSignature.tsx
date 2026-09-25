import { useMemo, useState } from 'react';
import { Camera, Check, ChevronLeft, Loader2, Mail } from 'lucide-react';
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
import ChoixComplements from '../cure/ChoixComplements';
import { complementsChoisis, montantComplements } from '../../domain/complements';
import type { EtatStock } from '../../types/db';
import {
  GROUPE_SECURITE,
  preconiserLaCure,
  relireLesReponsesSignature,
  type BaremeSignature,
  type CarteDesZones,
  type CureSignature,
  type ReponsesSignature,
} from '../../domain/profilSignature';
import { BoutonMesReponses, CarteMesReponses, ListeDesReponses } from './MesReponses';

/*
  La cure du Profil Signature.

  Trois cures, et une seule préconisée : le bilan l'a déduite des zones où
  la radiofréquence agit. Les deux autres restent accessibles — la cliente
  décide, et la thérapeute peut proposer plus court. LE DÉTAIL DU CALCUL NE
  S'AFFICHE PAS : elle voit sa cure, pas le compte de points qui l'a
  produite.

  Deux formats, deux prix, et c'est la thérapeute qui choisit : visage et
  cou, trente minutes ; le décolleté en plus, une heure. Le décolleté ne
  s'impose jamais tout seul, c'est une option qui se propose.

  LE PREMIER RENDEZ-VOUS SE RÈGLE DANS TOUS LES CAS (Jonathan, 24
  septembre 2026) : 89 €, le Profil Signature et le premier soin. Il ne
  fait pas partie de la cure et ne s'en déduit pas — la cliente repart
  avec quelque chose le jour même, et décide ensuite, sans que ce choix
  change ce qu'elle a déjà payé. Une cure de six séances vaut donc ses
  six séances, en plus des 89 € du jour.
*/

export default function DevisSignature({
  bareme,
  carte,
  reponses,
  grille,
  prenom,
  catalogue = [],
  bloque,
  differee,
  enregistrement,
  onRetour,
  onBilanSeul,
  onValider,
}: {
  bareme: BaremeSignature;
  carte: CarteDesZones;
  /** Ce qu'elle vient de répondre : la carte « Mes réponses » se rouvre ici aussi. */
  reponses: ReponsesSignature;
  grille: GrilleTarifaire;
  prenom: string;
  catalogue?: EtatStock[];
  /** Une contre-indication a été cochée : aucune cure ne se vend aujourd'hui. */
  bloque: boolean;
  /** Peeling, laser ou injection de moins d'un mois : la cure démarre plus tard. */
  differee: boolean;
  enregistrement: boolean;
  onRetour: () => void;
  onBilanSeul: (p: PrescriptionValidee) => void;
  onValider: (p: PrescriptionValidee) => void;
}) {
  const preconisation = useMemo(() => preconiserLaCure(bareme, carte), [bareme, carte]);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [avecDecollete, setAvecDecollete] = useState(false);
  const [methode, setMethode] = useState<'centre' | 'alma'>('centre');
  const [n, setN] = useState(1);
  const [boites, setBoites] = useState<Record<string, number>>({});
  const [reponsesOuvertes, setReponsesOuvertes] = useState(false);

  const cure: CureSignature =
    bareme.CURES.find((c) => c.code === choisie) ?? preconisation.cure;
  const estPreconisee = cure.code === preconisation.cure.code;

  const prixSeance = avecDecollete ? grille.radiofrequence_decollete : grille.radiofrequence;
  const complements = useMemo(
    () => complementsChoisis(boites, catalogue, grille.complement),
    [boites, catalogue, grille.complement],
  );
  const montantBoites = montantComplements(complements);
  const montantTotal = cure.seances * prixSeance + montantBoites;

  /*
    Les chèques ne dépassent pas la durée de la cure : on n'encaisse pas un
    règlement après la dernière séance. Une Découverte d'un mois se règle
    donc comptant, une Intégrale de trois mois jusqu'en trois fois.
  */
  const choixCentre = ECHEANCES_CENTRE.filter((k) => k <= Math.min(4, cure.mois));
  const nRetenu = methode === 'centre' ? Math.min(n, choixCentre[choixCentre.length - 1] ?? 1) : n;

  const echeancier = useMemo(
    () =>
      construireEcheancierCure({
        seances: cure.seances,
        prixSeance,
        options: montantBoites,
        methode,
        n: nRetenu,
      }),
    [cure.seances, prixSeance, montantBoites, methode, nRetenu],
  );

  const premier = echeancier.echeances[0];
  const suite = echeancier.echeances.slice(1);
  const mensualitesEgales = methode === 'alma' && echeancier.n >= 10;

  function proposition(): PrescriptionValidee {
    return {
      lignes: [{ technologie: 'radiofrequence', seances: cure.seances, prixUnitaire: prixSeance }],
      electro: false,
      guide: false,
      tenue: false,
      complements,
      montantTotal,
      bilanDejaRegle: 0,
      modeReglement: echeancier.mode,
      frais: echeancier.frais,
      echeances: echeancier.echeances,
    };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="surtitre">Votre cure</div>
          <h1 className="mt-1 text-3xl font-light tracking-tight text-ardoise-900">
            Ce que nous proposons {prenom ? <b className="font-semibold">à {prenom}</b> : null}
          </h1>
        </div>
        <BoutonMesReponses
          ouvert={reponsesOuvertes}
          onBascule={() => setReponsesOuvertes((o) => !o)}
        />
      </header>

      {reponsesOuvertes && (
        <CarteMesReponses
          sousTitre="Ce qui a produit ce Profil Signature, et cette cure"
          onFermer={() => setReponsesOuvertes(false)}
        >
          <ListeDesReponses
            lignes={relireLesReponsesSignature(bareme, reponses).filter(
              (r) => r.groupe !== GROUPE_SECURITE,
            )}
            groupes={bareme.GROUPES}
          />
        </CarteMesReponses>
      )}

      {/* La cure retenue ---------------------------------------------- */}
      <section className="carte overflow-hidden">
        <div className="border-b border-rose-200 bg-rose-50 px-5 py-4">
          <p className="text-2xs font-semibold uppercase tracking-widest text-rose-600">
            {estPreconisee ? 'Votre cure préconisée' : 'Autre cure possible'}
          </p>
          <p className="mt-0.5 text-2xl font-light text-ardoise-900">
            Cure <b className="font-semibold">{cure.nom}</b>
          </p>
          <p className="mt-1 text-sm text-ardoise-600">
            {cure.seances} séances sur {cure.mois} mois. {cure.rythme}.
          </p>
        </div>

        {/*
          Le calendrier, de la première séance à la dernière.

          LES SEMAINES SANS SÉANCE COMPTENT : c'est le rythme de la cure —
          quatre venues hebdomadaires, puis une semaine sur deux — et elles
          se voient comme des ronds vides entre les séances. Ce qu'on a
          retiré (Jonathan, 23 septembre 2026), ce sont les semaines
          VIDES DE FIN : dessiner huit ronds entre la dernière séance d'une
          cure d'un mois et le bilan photos éloignait celui-ci sans rien
          apprendre. Le calendrier s'arrête donc à la dernière séance, et le
          bilan photos vient juste après, séparé par un simple intervalle.
        */}
        <div className="flex flex-wrap items-start gap-2 px-5 py-4">
          {Array.from({ length: cure.semaines[cure.semaines.length - 1] }, (_, i) => i + 1).map(
            (semaine) => {
              const rang = cure.semaines.indexOf(semaine);
              return rang >= 0 ? (
                <span key={semaine} className="flex w-12 flex-col items-center gap-1">
                  <span className="chiffres flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-base font-bold text-white">
                    {rang + 1}
                  </span>
                  <span className="text-[10px] leading-tight text-ardoise-500">sem. {semaine}</span>
                </span>
              ) : (
                <span
                  key={semaine}
                  title={`Semaine ${semaine} — pas de séance`}
                  className="flex w-12 flex-col items-center gap-1"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-ardoise-300 bg-white">
                    <span className="h-2 w-2 rounded-full bg-ardoise-200" />
                  </span>
                  <span className="text-[10px] leading-tight text-ardoise-400">repos</span>
                </span>
              );
            },
          )}

          {/*
            L'intervalle et le repère photos ne se séparent jamais : à
            l'étroit, le premier restait en fin de ligne et le second
            passait tout seul à la suivante, sans rien pour l'expliquer.
          */}
          <span className="flex shrink-0 items-center gap-2">
            <span className="flex h-10 items-center text-lg text-ardoise-300">⋯</span>
            {/* La ligne sous le calendrier dit déjà à quoi sert ce repère. */}
            <span
              title="Bilan photos à 3 mois"
              className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-marine-400 bg-marine-50 text-marine-700"
            >
              <Camera className="h-5 w-5" />
            </span>
          </span>
        </div>

        <p className="border-t border-ardoise-100 px-5 py-2.5 text-xs text-ardoise-500">
          {cure.note} Le premier rendez-vous d’aujourd’hui se règle à part : cette cure vient à la
          suite.
        </p>

        {/*
          Les deux autres cures, en cartes et non en petits boutons : la
          thérapeute propose parfois plus court, et ce choix se fait devant
          la cliente — il mérite d'être lisible à un mètre.
        */}
        <div className="border-t border-ardoise-100 px-5 py-4">
          <p className="surtitre mb-2.5">Les autres cures</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {bareme.CURES.filter((c) => c.code !== cure.code).map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setChoisie(c.code)}
                className="rounded-2xl border border-ardoise-200 bg-white px-4 py-3 text-left transition-colors hover:border-rose-300 hover:bg-rose-50"
              >
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-base font-semibold text-ardoise-900">Cure {c.nom}</span>
                  {c.code === preconisation.cure.code && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Préconisée
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-ardoise-600">
                  {c.seances} séances sur {c.mois} mois
                </span>
                <span className="chiffres mt-1 block text-sm font-bold text-rose-600">
                  {formaterEuros(c.seances * prixSeance)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Le format ----------------------------------------------------- */}
      <section className="carte p-5">
        <h2 className="surtitre mb-3">Les zones travaillées</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { avec: false, titre: 'Visage et cou', detail: '30 minutes', prix: grille.radiofrequence },
            {
              avec: true,
              titre: 'Visage, cou et décolleté',
              detail: '1 heure',
              prix: grille.radiofrequence_decollete,
            },
          ].map((f) => {
            const actif = avecDecollete === f.avec;
            return (
              <button
                key={f.titre}
                type="button"
                onClick={() => setAvecDecollete(f.avec)}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  actif
                    ? 'border-rose-500 bg-rose-50'
                    : 'border-ardoise-200 bg-white hover:border-rose-200'
                }`}
              >
                <span className="block text-sm font-semibold text-ardoise-900">{f.titre}</span>
                <span className="block text-xs text-ardoise-500">
                  {f.detail} · {formaterEuros(f.prix)} la séance
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <ChoixComplements
        catalogue={catalogue}
        prix={grille.complement}
        quantites={boites}
        onChange={setBoites}
      />

      {/* Le règlement --------------------------------------------------- */}
      <section className="overflow-hidden rounded-2xl bg-marine-900 px-6 py-6 text-center text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-marine-300">
          Sa cure {cure.nom}
        </p>

        <div className="mt-4 flex justify-center gap-2">
          {(['centre', 'alma'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethode(m);
                setN(m === 'centre' ? 1 : 4);
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
              {formaterEurosJuste(montantTotal)}
            </div>
            <div className="mt-1.5 text-sm text-marine-200">en une fois · sans frais</div>
          </>
        ) : (
          <>
            <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-marine-300">
              {methode === 'centre'
                ? '1re échéance · sans frais'
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
                  key={e.rang}
                  className="flex justify-between border-b border-white/15 py-1 text-[13px] text-marine-100"
                >
                  <span>Échéance {e.rang}</span>
                  <span className="chiffres font-semibold text-white">
                    {formaterEurosJuste(e.montant)}
                  </span>
                </div>
              ))}
            </div>
          </>
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
              {k === 1 ? 'Comptant' : `${k}×`}
            </button>
          ))}
        </div>

        <p className="mx-auto mt-3 max-w-sm text-[11px] text-marine-300">
          {methode === 'centre'
            ? `Par chèques au centre. Chaque chèque couvre un nombre entier de séances, et la cure dure ${cure.mois} mois : on n’encaisse pas après la dernière séance.`
            : `Frais Alma de ${String(tauxFraisAlma(echeancier.n, montantTotal)).replace('.', ',')} %, à sa charge${
                mensualitesEgales
                  ? ', répartis sur les mensualités.'
                  : ', pris en totalité sur le premier versement.'
              }`}
        </p>

        {methode === 'alma' && (
          <div className="mx-auto mt-3 max-w-xs rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-left">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-marine-300">
              À saisir sur Alma
            </div>
            <div className="chiffres mt-0.5 text-xl font-bold">
              {formaterEuros(montantTotal, 2)}
            </div>
            <div className="text-[11px] text-marine-200">
              le montant de la cure, sans les frais — Alma les ajoute lui-même
            </div>
          </div>
        )}

        <p className="mx-auto mt-4 max-w-sm border-t border-white/15 pt-3 text-[11px] text-marine-200">
          {cure.seances} séances × {formaterEuros(prixSeance)}
          {montantBoites > 0 ? ` + compléments ${formaterEuros(montantBoites)}` : ''} ={' '}
          <b className="text-white">{formaterEurosJuste(montantTotal)}</b>.
          <span className="mt-0.5 block text-marine-300">
            Le premier rendez-vous ({formaterEuros(grille.bilan_signature)}) se règle à part, il
            n’est pas compris ici.
          </span>
        </p>
      </section>

      {differee && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          La cure peut être réglée aujourd'hui, mais la première séance attendra un mois après son
          dernier peeling, laser ou injection.
        </p>
      )}

      {bloque && (
        <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Une contre-indication a été signalée : la cure ne peut pas être validée. Enregistrez le
          Profil Signature et orientez vers un avis médical.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ardoise-200 pt-5">
        <button onClick={onRetour} disabled={enregistrement} className="bouton-discret">
          <ChevronLeft className="h-4 w-4" />
          Revenir au Profil Signature
        </button>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onBilanSeul(proposition())}
            disabled={enregistrement}
            className="bouton-discret"
            title="Le premier rendez-vous est facturé, aucune cure n'est ouverte, et son Profil Signature part par mail."
          >
            <Mail className="h-4 w-4" />
            Sans cure · {formaterEuros(grille.bilan_signature)}
          </button>
          <button
            onClick={() => onValider(proposition())}
            disabled={enregistrement || bloque}
            className="bouton-fort"
          >
            {enregistrement ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Valider la cure {cure.nom}
          </button>
        </div>
      </div>
    </div>
  );
}
