import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Dices,
  Lock,
  Plus,
  X,
} from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  lireBibliotheque,
  majSeance,
  ouvrirSeance,
  programmesDeLaCliente,
  seancesDuProgramme,
  supprimerSeance,
} from '../../services/metier';
import { aUnProgrammeAppareil, couleurSoin } from '../../domain/soins';
import { LIBELLES_TECHNOLOGIE } from '../../domain/tarification';
import CourbePoids, { libelleDelta } from './CourbePoids';
import ModaleSeance from './ModaleSeance';
import EquipementIShape from './EquipementIShape';
import { LIBELLES_PHASE, choisirJeu } from '../../domain/jeuDuJour';
import type { AxeProfil } from '../../domain/bioportrait';
import type { Seance, Technologie } from '../../types/db';

interface Props {
  clienteId: string;
  centreId: string;
  profilDominant: AxeProfil | null;
}

export default function OngletSeances({ clienteId, centreId, profilDominant }: Props) {
  const qc = useQueryClient();
  const [aCorriger, setACorriger] = useState<Seance | null>(null);
  const [enCours, setEnCours] = useState<Seance | null>(null);
  const [cureChoisie, setCureChoisie] = useState<string | null>(null);

  const { data: programmes = [], isLoading } = useQuery({
    queryKey: ['programmes', clienteId],
    queryFn: () => programmesDeLaCliente(clienteId),
  });

  /*
    Une cliente qui revient a plusieurs cures, et ses séances vivent sous
    celle à laquelle elles appartiennent. Sans sélecteur, l'ouverture d'une
    cure 2 faisait disparaître de l'écran toutes les séances de la cure 1 :
    elles étaient bien là, mais plus personne ne pouvait les voir.

    Par défaut on montre la dernière — c'est celle qui se déroule — et la
    thérapeute peut remonter. Le même geste que sur l'onglet Contrat, où
    elle choisit déjà la cure à contractualiser.
  */
  const eligibles = programmes.filter((p) => p.programme.statut !== 'abandonne');
  const actif =
    eligibles.find((p) => p.programme.id === cureChoisie) ?? eligibles.at(-1) ?? null;

  /*
    La taille de tenue se cherche sur toutes les cures, pas seulement sur
    celle qu'on regarde : elle n'est demandée qu'une fois, à la signature de
    la cure où la tenue est vendue. Sur une cure suivante, guide et tenue
    sont décochés — la cliente les a déjà — et la colonne reste vide, alors
    que la taille, elle, n'a pas changé. On prend donc la plus récente qui
    soit renseignée.
  */
  const tailleTenue =
    programmes
      .map((p) => p.programme.taille_tenue)
      .filter(Boolean)
      .at(-1) ?? null;

  const { data: seances = [] } = useQuery({
    queryKey: ['seances', actif?.programme.id],
    queryFn: () => seancesDuProgramme(actif!.programme.id),
    enabled: Boolean(actif),
  });

  /*
    L'écart de poids d'une séance à l'autre. Il se calcule dans l'ordre des
    dates, pas dans celui de l'affichage — la liste montre les plus récentes
    d'abord, et une différence lue à l'envers dirait le contraire de la
    vérité.
  */
  const ecartPoids = useMemo(() => {
    const pesees = seances
      .filter((s) => s.cloturee && s.poids != null)
      .slice()
      .sort((a, b) => a.date_seance.localeCompare(b.date_seance));

    const ecarts = new Map<string, number>();
    pesees.forEach((s, i) => {
      if (i === 0) return;
      ecarts.set(s.id, Math.round((Number(s.poids) - Number(pesees[i - 1].poids)) * 10) / 10);
    });
    return ecarts;
  }, [seances]);

  const { data: bibliotheque = [] } = useQuery({
    queryKey: ['jeux'],
    queryFn: lireBibliotheque,
    staleTime: Infinity,
  });

  const faites = useMemo(() => seances.filter((s) => s.cloturee), [seances]);

  /*
    Un bloc par soin, dans l'ordre des soins, la séance la plus récente en
    haut de chaque bloc. Le nombre prévu vient du suivi de la cure ; il
    manque sur une cure reprise du CRM.
  */
  const blocsParSoin = useMemo(() => {
    const ordre: Technologie[] = ['luxo', 'relax', 'ishape', 'presso', 'dome', 'advance_lift'];
    return ordre
      .map((technologie) => ({
        technologie,
        liste: faites
          .filter((s) => s.technologie === technologie)
          .slice()
          .sort((a, b) => b.date_seance.localeCompare(a.date_seance) || b.cree_le.localeCompare(a.cree_le)),
        prevues: actif?.suivi.find((x) => x.technologie === technologie)?.seances_prevues ?? null,
      }))
      .filter((b) => b.liste.length > 0);
  }, [faites, actif]);

  const totaux = useMemo(() => {
    const prevues = actif?.suivi.reduce((n, s) => n + s.seances_prevues, 0) ?? 0;
    const faites = actif?.suivi.reduce((n, s) => n + s.seances_faites, 0) ?? 0;
    return { prevues, faites };
  }, [actif]);

  // Deux venues dans la même semaine : on alterne pédagogique / action.
  const natureAEviter = useMemo(() => {
    const derniere = seances.find((s) => s.cloturee);
    if (!derniere?.jeu_code) return null;
    if (differenceInCalendarDays(new Date(), new Date(derniere.date_seance)) > 6) return null;
    return bibliotheque.find((j) => j.code === derniere.jeu_code)?.nature ?? null;
  }, [seances, bibliotheque]);

  const choix = useMemo(
    () =>
      choisirJeu({
        bibliotheque,
        dejaFaits: seances.filter((s) => s.cloturee && s.jeu_code).map((s) => s.jeu_code!),
        seancesFaites: totaux.faites,
        seancesPrevues: totaux.prevues,
        profilDominant,
        natureAEviter,
      }),
    [bibliotheque, seances, totaux, profilDominant, natureAEviter],
  );

  const jeuEnCours = enCours?.jeu_code
    ? (bibliotheque.find((j) => j.code === enCours.jeu_code) ?? null)
    : null;

  async function demarrer(technologie: Technologie) {
    if (!actif) return;
    try {
      const s = await ouvrirSeance({
        programmeId: actif.programme.id,
        clienteId,
        centreId,
        technologie,
        /*
          Pas de Mission Déclic sur l'Advance Lift : c'est une règle de la
          perte de poids — un exercice par venue pour ancrer le changement.
          L'anti-âge se suit au commentaire.
        */
        jeuCode: technologie === 'advance_lift' ? null : (choix.jeu?.code ?? null),
      });
      setEnCours(s);
    } catch {
      toast.error("La séance n'a pas pu être ouverte.");
    }
  }

  async function cloturer(patch: Partial<Seance>) {
    if (!enCours) return;
    try {
      await majSeance(enCours.id, { ...patch, cloturee: true });
      setEnCours(null);
      qc.invalidateQueries({ queryKey: ['seances', actif?.programme.id] });
      qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
      toast.success('Séance clôturée');
    } catch {
      toast.error('La clôture a échoué. La Mission Déclic a-t-elle bien été validée ?');
    }
  }

  async function annuler() {
    if (!enCours) return;
    await supprimerSeance(enCours.id).catch(() => undefined);
    setEnCours(null);
  }

  if (isLoading) {
    return <p className="carte px-5 py-10 text-center text-sm text-ardoise-400">Chargement…</p>;
  }

  if (!actif) {
    return (
      <div className="carte px-5 py-12 text-center">
        <p className="text-sm text-ardoise-600">Aucune cure en cours.</p>
        <p className="mt-1 text-xs text-ardoise-400">
          Les séances se rattachent à une cure : il faut d'abord en valider une.
        </p>
      </div>
    );
  }

  /*
    Une cure reprise du CRM ne sait pas toujours combien de séances elle
    comptait : Airtable ne le disait pas, l'ancienne application parfois.
    Elle doit pourtant continuer — la cliente vient, on démarre sa séance.
    On propose donc les soins de la perte de poids quoi qu'il en soit :
    avec le compteur quand la ligne existe, sans compteur sinon. Un « Toutes
    les séances ont été réalisées » sur une cure dont on ignore la taille
    serait un mensonge qui bloque le comptoir.
  */
  const cureReprise = actif.programme.origine === 'import_v1';
  const restantes: Array<{ technologie: Technologie; seances_restantes: number | null }> = cureReprise
    ? (['luxo', 'relax', 'ishape', 'presso'] as Technologie[]).map((t) => {
        const suivi = actif.suivi.find((s) => s.technologie === t);
        return { technologie: t, seances_restantes: suivi ? suivi.seances_restantes : null };
      })
    : actif.suivi.filter((s) => s.seances_restantes > 0);
  /* Une cure d'Advance Lift : ni Mission Déclic, ni pesée — un suivi au commentaire. */
  const cureAntiAge = actif.suivi.length > 0 && actif.suivi.every((s) => s.technologie === 'advance_lift');

  return (
    <div className="space-y-5">
      {/* Séance en cours ------------------------------------------------ */}
      {enCours ? (
        <SeanceEnCours
          seance={enCours}
          jeu={jeuEnCours}
          phase={choix.phase}
          motif={choix.motif}
          onCloturer={cloturer}
          onAnnuler={annuler}
        />
      ) : (
        <section className="carte">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ardoise-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ardoise-900">Démarrer une séance</h2>
            <div className="flex flex-wrap items-center gap-3">
              {/*
                Un bouton par cure plutôt qu'un menu déroulant : à deux ou
                trois cures, le menu cachait le choix — il fallait l'ouvrir
                pour savoir qu'il y avait autre chose. Les numéros se voient
                sans rien ouvrir, et la cure regardée se lit d'un coup d'œil.
                La date passe en infobulle : elle départage deux cures d'une
                même année sans encombrer la ligne.
              */}
              {eligibles.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                    Cure
                  </span>
                  {eligibles.map((p) => {
                    const choisie = p.programme.id === actif.programme.id;
                    return (
                      <button
                        key={p.programme.id}
                        type="button"
                        onClick={() => setCureChoisie(p.programme.id)}
                        aria-pressed={choisie}
                        title={
                          p.programme.date_validation
                            ? `Cure ${p.programme.numero} — validée le ${format(new Date(p.programme.date_validation), 'd MMMM yyyy', { locale: fr })}`
                            : `Cure ${p.programme.numero}`
                        }
                        className={`chiffres h-7 w-7 rounded-full border text-xs font-bold transition-colors ${
                          choisie
                            ? 'border-marine-600 bg-marine-600 text-white'
                            : 'border-ardoise-300 bg-white text-ardoise-600 hover:border-marine-400'
                        }`}
                      >
                        {p.programme.numero}
                      </button>
                    );
                  })}
                </div>
              )}
              <span className="chiffres text-xs text-ardoise-500">
                {totaux.faites} / {totaux.prevues} séances réalisées
              </span>
            </div>
          </div>

          {restantes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ardoise-500">
              Toutes les séances de la cure {actif.programme.numero} ont été réalisées.
            </p>
          ) : (
            <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {/*
                La même couleur qu'en bas de page : la thérapeute voit la
                teinte au moment de démarrer la séance, et la retrouve dans la
                liste des séances faites. Sans ce rappel, la couleur ne serait
                qu'une décoration à apprendre.
              */}
              {restantes.map((s) => (
                <button
                  key={s.technologie}
                  onClick={() => demarrer(s.technologie)}
                  className={`bouton-discret ${couleurSoin(s.technologie).bouton}`}
                >
                  <Plus className={`h-4 w-4 ${couleurSoin(s.technologie).texte}`} />
                  <span className={`font-semibold ${couleurSoin(s.technologie).texte}`}>
                    {LIBELLES_TECHNOLOGIE[s.technologie]}
                  </span>
                  <span className="chiffres ml-1 rounded bg-ardoise-100 px-1.5 py-0.5 text-2xs font-semibold text-ardoise-600">
                    {s.seances_restantes == null
                      ? 'reprise du CRM'
                      : s.seances_restantes > 0
                        ? `${s.seances_restantes} restantes`
                        : 'au-delà du prévu'}
                  </span>
                </button>
              ))}

            </div>

              {/*
                Les deux tailles de l'I-Shape, sous les boutons, en gros.

                La tenue est choisie une fois, dans la fenêtre de signature,
                et dormait dans l'onglet Contrat ; la combi se note ici même
                et change au fil de la cure. C'est au moment d'installer la
                cliente sur l'I-Shape qu'on en a besoin, et une pastille en
                petit se cherchait — Jonathan l'a demandée « plus grosse et
                plus visible ».

                Elles n'apparaissent que si l'I-Shape est au programme : sur
                une cure sans électrostimulation, elles ne disent rien.
              */}
              {restantes.some((s) => s.technologie === 'ishape') && (
                <EquipementIShape clienteId={clienteId} tailleTenue={tailleTenue} />
              )}
            </div>
          )}

          {!cureAntiAge && choix.jeu && restantes.length > 0 && (
            <div className="border-t border-ardoise-100 bg-marine-50/60 px-5 py-3">
              <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest text-marine-700">
                <Dices className="h-3.5 w-3.5" />
                Mission Déclic imposée à la prochaine séance
              </p>
              <p className="mt-1 text-sm font-semibold text-ardoise-900">
                {choix.jeu.code} · {choix.jeu.titre}
              </p>
              <p className="text-xs text-ardoise-500">
                {LIBELLES_PHASE[choix.phase]} — {choix.motif}
              </p>
            </div>
          )}
        </section>
      )}

      {/*
        Historique — UN BLOC PAR SOIN, comme le cahier des thérapeutes.

        La première version listait toutes les séances dans l'ordre des
        venues, tous soins mêlés. Jonathan a demandé la disposition de son
        cahier (15 septembre 2026) : la Luxothérapie avec sa courbe de poids,
        puis l'I-Shape, puis la presso, chacun avec ses séances numérotées
        S1, S2, S3… La question au comptoir n'est pas « que s'est-il passé
        le 6 septembre » mais « où en est-elle sur l'I-Shape, et quel
        programme la collègue a mis la dernière fois ». S1 est la première
        séance du soin ; la plus récente est en haut.
      */}
      {faites.length === 0 ? (
        <section className="carte">
          <div className="border-b border-ardoise-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ardoise-900">Séances réalisées</h2>
          </div>
          <p className="px-5 py-8 text-center text-sm text-ardoise-400">
            Aucune séance clôturée pour l'instant.
          </p>
        </section>
      ) : (
        blocsParSoin.map(({ technologie, liste, prevues }) => {
          const teinte = couleurSoin(technologie);
          const avecCourbe = technologie === 'luxo';
          return (
            <section key={technologie} className={`carte border ${teinte.carte}`}>
              <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5 ${teinte.entete}`}>
                <h2 className={`text-sm font-semibold ${teinte.texte}`}>
                  {LIBELLES_TECHNOLOGIE[technologie]}
                  {eligibles.length > 1 && (
                    <span className="ml-2 font-normal text-ardoise-500">— cure {actif.programme.numero}</span>
                  )}
                </h2>
                <span className="chiffres text-xs text-ardoise-500">
                  {liste.length}
                  {prevues != null ? ` / ${prevues}` : ''} séance{liste.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className={avecCourbe ? 'lg:grid lg:grid-cols-[1fr_minmax(300px,42%)]' : ''}>
                <ul className="divide-y divide-white/70">
                  {liste.map((s, i) => {
                    const numeroSeance = liste.length - i;
                    const jeu = bibliotheque.find((j) => j.code === s.jeu_code);
                    const delta = ecartPoids.get(s.id) ?? null;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setACorriger(s)}
                          className={`flex w-full items-start gap-4 border-l-[3px] py-3 pl-4 pr-5 text-left hover:bg-white/70 ${teinte.bord}`}
                          title="Corriger cette séance"
                        >
                          <span
                            className={`chiffres mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${teinte.pastille}`}
                          >
                            S{numeroSeance}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="chiffres text-sm font-semibold text-ardoise-900">
                              {format(new Date(s.date_seance), 'dd/MM/yyyy')}
                            </p>
                            {jeu && (
                              <p className="text-xs text-ardoise-500">
                                Mission Déclic {jeu.code} · {jeu.titre}
                              </p>
                            )}
                            {s.programme_utilise && (
                              <p className="mt-1 text-xs text-ardoise-700">
                                <span className="font-semibold">Programme :</span> {s.programme_utilise}
                              </p>
                            )}
                            {s.commentaire && (
                              <p className="mt-1 text-xs text-ardoise-600">{s.commentaire}</p>
                            )}
                          </div>

                          {s.poids != null && (
                            <span className="shrink-0 text-right">
                              <span className="chiffres block text-sm font-semibold text-marine-800">
                                {Number(s.poids).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} kg
                              </span>
                              {delta != null && delta !== 0 && (
                                <span
                                  className={`chiffres block text-xs font-semibold ${
                                    delta < 0 ? 'text-marine-600' : 'text-rose-600'
                                  }`}
                                >
                                  {libelleDelta(delta)}
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {avecCourbe && (
                  <div className="border-t border-white/80 bg-white/50 lg:border-l lg:border-t-0">
                    <CourbePoids seances={faites} nue />
                  </div>
                )}
              </div>
            </section>
          );
        })
      )}

      {aCorriger && (
        <ModaleSeance
          seance={aCorriger}
          onFerme={() => setACorriger(null)}
          onEnregistre={() => {
            qc.invalidateQueries({ queryKey: ['seances', actif?.programme.id] });
            qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
          }}
        />
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------

function SeanceEnCours({
  seance,
  jeu,
  phase,
  motif,
  onCloturer,
  onAnnuler,
}: {
  seance: Seance;
  jeu: import('../../types/db').Jeu | null;
  phase: 'A' | 'B' | 'C';
  motif: string;
  onCloturer: (patch: Partial<Seance>) => void;
  onAnnuler: () => void;
}) {
  const [poids, setPoids] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [programmeUtilise, setProgrammeUtilise] = useState('');
  const [photo, setPhoto] = useState(false);
  const [jeuFait, setJeuFait] = useState(false);
  /* I-Shape et presso : le programme choisi sur l'appareil se note à part du ressenti. */
  const avecProgramme = aUnProgrammeAppareil(seance.technologie);
  const [reponseJeu, setReponseJeu] = useState('');

  /*
    L'Advance Lift se clôture sur un commentaire : pas de Mission Déclic à
    valider, pas de poids à relever. Le suivi, c'est ce que la thérapeute
    observe sur la peau d'une séance à l'autre.
  */
  const antiAge = seance.technologie === 'advance_lift';
  const bloque = !antiAge && Boolean(jeu) && !jeuFait;

  return (
    <section className="carte overflow-hidden ring-2 ring-marine-500">
      <div className="flex items-center justify-between bg-marine-600 px-5 py-3">
        <h2 className="text-sm font-semibold text-white">
          Séance en cours — {LIBELLES_TECHNOLOGIE[seance.technologie]}
        </h2>
        <button
          onClick={onAnnuler}
          className="text-white/80 hover:text-white"
          aria-label="Annuler la séance"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* La Mission Déclic du jour, imposée */}
      {antiAge ? null : jeu ? (
        <div className="border-b border-ardoise-100 bg-marine-50/60 p-5">
          <p className="text-2xs font-semibold uppercase tracking-widest text-marine-700">
            Mission Déclic obligatoire de la séance · {LIBELLES_PHASE[phase]}
          </p>
          <h3 className="mt-1.5 text-lg font-bold tracking-tight text-ardoise-900">
            {jeu.code} · {jeu.titre}
          </h3>
          <p className="text-xs text-ardoise-500">
            {jeu.theme} · {jeu.duree} · {motif}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="etiquette">Matériel à sortir</p>
              <p className="text-sm text-ardoise-700">{jeu.materiel}</p>
            </div>
            <div>
              <p className="etiquette">Objectif</p>
              <p className="text-sm text-ardoise-700">{jeu.objectif}</p>
            </div>
          </div>

          {jeu.phrase_lancement && (
            <blockquote className="mt-4 border-l-3 border-marine-500 bg-white px-4 py-3 text-sm italic text-ardoise-800">
              « {jeu.phrase_lancement} »
            </blockquote>
          )}

          {jeu.regles.length > 0 && (
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ardoise-700">
              {jeu.regles.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          )}

          {jeu.options.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {jeu.options.map((o) => (
                <span
                  key={o}
                  className="rounded-lg border border-ardoise-200 bg-white px-2.5 py-1 text-xs text-ardoise-700"
                >
                  {o}
                </span>
              ))}
            </div>
          )}

          {jeu.mission && (
            <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm text-ardoise-700">
              <span className="font-semibold">Petit pas jusqu'au prochain rendez-vous :</span>{' '}
              {jeu.mission}
            </p>
          )}

          <div className="mt-4">
            <label htmlFor="reponse-jeu" className="etiquette">
              {jeu.a_enregistrer || 'Ce qui ressort de la Mission Déclic'}
            </label>
            <input
              id="reponse-jeu"
              value={reponseJeu}
              onChange={(e) => setReponseJeu(e.target.value)}
              className="champ"
              placeholder="Ex. : Grignotages / envies"
            />
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-marine-300 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={jeuFait}
              onChange={(e) => setJeuFait(e.target.checked)}
              className="h-4 w-4 rounded border-ardoise-300 text-marine-600 focus:ring-marine-500"
            />
            <span className="text-sm font-semibold text-ardoise-900">
              Mission Déclic {jeu.code} réalisée — je valide le code
            </span>
          </label>
        </div>
      ) : (
        <p className="border-b border-ardoise-100 px-5 py-4 text-sm text-ardoise-500">
          Aucune Mission Déclic disponible : toutes ont déjà été réalisées sur cette fiche.
        </p>
      )}

      {/* Relevés de la séance */}
      {antiAge ? (
        <div className="p-5">
          <label htmlFor="comm" className="etiquette">
            Ce que vous observez
          </label>
          <textarea
            id="comm"
            rows={3}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            className="champ resize-y"
            placeholder="L’état de la peau, la zone travaillée, ce qui a changé depuis la dernière fois…"
          />
        </div>
      ) : (
        <div className={`grid gap-4 p-5 ${avecProgramme ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <div>
            <label htmlFor="poids" className="etiquette">
              Poids (kg)
            </label>
            <input
              id="poids"
              type="number"
              step="0.1"
              value={poids}
              onChange={(e) => setPoids(e.target.value)}
              className="champ"
            />
          </div>
          {avecProgramme && (
            <div>
              <label htmlFor="prog" className="etiquette">
                Programme utilisé
              </label>
              <input
                id="prog"
                value={programmeUtilise}
                onChange={(e) => setProgrammeUtilise(e.target.value)}
                className="champ"
                placeholder="Sur l’appareil"
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label htmlFor="comm" className="etiquette">
              {avecProgramme ? 'Commentaire / ressenti' : 'Commentaire'}
            </label>
            <input
              id="comm"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              className="champ"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ardoise-100 px-5 py-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ardoise-600">
          <input
            type="checkbox"
            checked={photo}
            onChange={(e) => setPhoto(e.target.checked)}
            className="h-4 w-4 rounded border-ardoise-300 text-marine-600 focus:ring-marine-500"
          />
          Photo prise
        </label>

        <div className="flex items-center gap-3">
          {bloque && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-ardoise-500">
              <Lock className="h-3.5 w-3.5" />
              Validez la Mission Déclic pour clôturer
            </span>
          )}
          <button
            onClick={() =>
              onCloturer({
                poids: !antiAge && poids ? Number(poids) : null,
                commentaire,
                programme_utilise: avecProgramme ? programmeUtilise.trim() || null : null,
                photo_prise: photo,
                jeu_valide: antiAge ? false : jeuFait,
                jeu_reponse: !antiAge && reponseJeu ? { reponse: reponseJeu } : {},
              })
            }
            disabled={bloque}
            className="bouton-principal"
          >
            <Check className="h-4 w-4" />
            Clôturer la séance
          </button>
        </div>
      </div>
    </section>
  );
}
