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
import { LIBELLES_TECHNOLOGIE } from '../../domain/tarification';
import { LIBELLES_PHASE, choisirJeu } from '../../domain/jeuDuJour';
import type { AxeProfil } from '../../domain/empreinte';
import type { Seance, Technologie } from '../../types/db';

interface Props {
  clienteId: string;
  centreId: string;
  profilDominant: AxeProfil | null;
}

export default function OngletSeances({ clienteId, centreId, profilDominant }: Props) {
  const qc = useQueryClient();
  const [enCours, setEnCours] = useState<Seance | null>(null);

  const { data: programmes = [], isLoading } = useQuery({
    queryKey: ['programmes', clienteId],
    queryFn: () => programmesDeLaCliente(clienteId),
  });

  const actif = programmes.filter((p) => p.programme.statut !== 'abandonne').at(-1) ?? null;

  const { data: seances = [] } = useQuery({
    queryKey: ['seances', actif?.programme.id],
    queryFn: () => seancesDuProgramme(actif!.programme.id),
    enabled: Boolean(actif),
  });

  const { data: bibliotheque = [] } = useQuery({
    queryKey: ['jeux'],
    queryFn: lireBibliotheque,
    staleTime: Infinity,
  });

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
        jeuCode: choix.jeu?.code ?? null,
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
      toast.error('La clôture a échoué. Le jeu du jour a-t-il bien été validé ?');
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

  const restantes = actif.suivi.filter((s) => s.seances_restantes > 0);

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
          <div className="flex items-center justify-between border-b border-ardoise-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ardoise-900">Démarrer une séance</h2>
            <span className="chiffres text-xs text-ardoise-500">
              {totaux.faites} / {totaux.prevues} séances réalisées
            </span>
          </div>

          {restantes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ardoise-500">
              Toutes les séances de cette cure ont été réalisées.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 p-5">
              {restantes.map((s) => (
                <button
                  key={s.technologie}
                  onClick={() => demarrer(s.technologie)}
                  className="bouton-discret"
                >
                  <Plus className="h-4 w-4" />
                  {LIBELLES_TECHNOLOGIE[s.technologie]}
                  <span className="chiffres ml-1 rounded bg-ardoise-100 px-1.5 py-0.5 text-2xs font-semibold text-ardoise-600">
                    {s.seances_restantes} restantes
                  </span>
                </button>
              ))}
            </div>
          )}

          {choix.jeu && restantes.length > 0 && (
            <div className="border-t border-ardoise-100 bg-marine-50/60 px-5 py-3">
              <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest text-marine-700">
                <Dices className="h-3.5 w-3.5" />
                Jeu imposé à la prochaine séance
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

      {/* Historique ------------------------------------------------------ */}
      <section className="carte">
        <div className="border-b border-ardoise-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ardoise-900">Séances réalisées</h2>
        </div>

        {seances.filter((s) => s.cloturee).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ardoise-400">
            Aucune séance clôturée pour l'instant.
          </p>
        ) : (
          <ul className="divide-y divide-ardoise-100">
            {seances
              .filter((s) => s.cloturee)
              .map((s) => {
                const jeu = bibliotheque.find((j) => j.code === s.jeu_code);
                return (
                  <li key={s.id} className="flex items-start justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ardoise-900">
                        {format(new Date(s.date_seance), 'd MMMM yyyy', { locale: fr })}
                        <span className="ml-2 font-normal text-ardoise-500">
                          {LIBELLES_TECHNOLOGIE[s.technologie]}
                        </span>
                      </p>
                      {jeu && (
                        <p className="text-xs text-ardoise-500">
                          {jeu.code} · {jeu.titre}
                        </p>
                      )}
                      {s.commentaire && (
                        <p className="mt-1 text-xs text-ardoise-600">{s.commentaire}</p>
                      )}
                    </div>
                    {s.poids != null && (
                      <span className="chiffres shrink-0 text-sm font-semibold text-marine-800">
                        {Number(s.poids).toLocaleString('fr-FR', { minimumFractionDigits: 1 })} kg
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </section>
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
  const [photo, setPhoto] = useState(false);
  const [jeuFait, setJeuFait] = useState(false);
  const [reponseJeu, setReponseJeu] = useState('');

  const bloque = Boolean(jeu) && !jeuFait;

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

      {/* Le jeu du jour, imposé */}
      {jeu ? (
        <div className="border-b border-ardoise-100 bg-marine-50/60 p-5">
          <p className="text-2xs font-semibold uppercase tracking-widest text-marine-700">
            Jeu obligatoire de la séance · {LIBELLES_PHASE[phase]}
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
              {jeu.a_enregistrer || 'Ce qui ressort du jeu'}
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
              Jeu {jeu.code} réalisé — je valide le code
            </span>
          </label>
        </div>
      ) : (
        <p className="border-b border-ardoise-100 px-5 py-4 text-sm text-ardoise-500">
          Aucun jeu disponible : tous ont déjà été réalisés avec cette cliente.
        </p>
      )}

      {/* Relevés de la séance */}
      <div className="grid gap-4 p-5 sm:grid-cols-3">
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
        <div className="sm:col-span-2">
          <label htmlFor="comm" className="etiquette">
            Commentaire
          </label>
          <input
            id="comm"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            className="champ"
          />
        </div>
      </div>

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
              Validez le jeu pour clôturer
            </span>
          )}
          <button
            onClick={() =>
              onCloturer({
                poids: poids ? Number(poids) : null,
                commentaire,
                photo_prise: photo,
                jeu_valide: jeuFait,
                jeu_reponse: reponseJeu ? { reponse: reponseJeu } : {},
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
