import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Check, Clock, Loader2, Megaphone, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSession } from '../lib/session';
import {
  changerStatut,
  deposerSignalement,
  envoyerAnnonce,
  lireMessages,
  marquerLu,
  repondre,
  supprimerMessage,
  therapeutesJoignables,
  type MessageComplet,
} from '../services/messages';
import {
  ETATS,
  STATUTS_SIGNALEMENT,
  lecture,
  parLecture,
  resume,
  resumeRecu,
  type Destinataire,
  type StatutMessage,
} from '../domain/messages';

/**
 * Le carnet de liaison.
 *
 * Un seul écran pour les deux sens, parce que c'est une seule habitude à
 * prendre : on y va pour voir ce qu'on a reçu, et pour écrire. Ce qui
 * change selon le compte, c'est ce qu'on peut écrire — une thérapeute
 * signale, la direction annonce et répond.
 */
export default function Messages() {
  const { role, therapeute } = useSession();
  const direction = role === 'direction';
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState<string | null>(null);

  const {
    data: messages = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['messages'],
    queryFn: lireMessages,
  });

  function rafraichir() {
    qc.invalidateQueries({ queryKey: ['messages'] });
    qc.invalidateQueries({ queryKey: ['messages-en-attente'] });
  }

  /*
    Ce qu'on a reçu d'un côté, ce qu'on a écrit de l'autre.

    Une thérapeute ne trouve dans la première liste que des annonces : les
    règles de sécurité lui cachent déjà les signalements de ses collègues.
    On le redit ici pour que le titre de la liste ne puisse pas mentir si un
    jour ces règles changent.
  */
  const recus = useMemo(
    () =>
      messages.filter(
        (m) =>
          m.message.auteur_id !== therapeute?.id &&
          (direction || m.message.type === 'annonce'),
      ),
    [messages, therapeute?.id, direction],
  );
  const envoyes = useMemo(
    () => messages.filter((m) => m.message.auteur_id === therapeute?.id),
    [messages, therapeute?.id],
  );

  if (isLoading) {
    return <p className="carte px-5 py-10 text-center text-sm text-ardoise-400">Chargement…</p>;
  }

  /*
    Une liste vide et une liste qui n'a pas pu être lue se ressemblent
    beaucoup à l'écran, et ne veulent pas du tout dire la même chose. On les
    sépare : sans ça, une panne passe pour « aucun message ».
  */
  if (isError) {
    return (
      <div className="carte border-l-2 border-rose-500 px-5 py-6">
        <h1 className="flex items-center gap-2 text-base font-semibold text-ardoise-900">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          Les messages n’ont pas pu être chargés
        </h1>
        <p className="mt-2 text-sm text-ardoise-600">
          Ce n’est pas qu’il n’y en a aucun : le carnet de liaison n’a pas répondu. Prévenez la
          direction, et réessayez dans un instant.
        </p>
        <p className="mt-3 font-mono text-xs text-ardoise-400">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ardoise-900">Messages</h1>
          <p className="mt-0.5 text-sm text-ardoise-500">
            {direction
              ? 'Ce que vos thérapeutes vous remontent, et ce que vous leur annoncez.'
              : 'Les annonces de la direction, et ce que vous lui signalez.'}
          </p>
        </div>
      </header>

      {direction ? <Annoncer onEnvoye={rafraichir} /> : <Signaler onEnvoye={rafraichir} />}

      <Liste
        titre={direction ? 'Ce qu’on vous remonte' : 'Ce que la direction vous annonce'}
        vide={
          direction
            ? 'Aucun signalement pour le moment.'
            : 'Aucune annonce. C’est plutôt bon signe.'
        }
        messages={recus}
        direction={direction}
        moi={therapeute?.id ?? null}
        ouvert={ouvert}
        setOuvert={setOuvert}
        onChange={rafraichir}
      />

      {(direction || envoyes.length > 0) && (
        <Liste
          titre="Ce que vous avez envoyé"
          vide="Vous n’avez encore rien annoncé."
          messages={envoyes}
          direction={direction}
          moi={therapeute?.id ?? null}
          ouvert={ouvert}
          setOuvert={setOuvert}
          onChange={rafraichir}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Écrire
// ---------------------------------------------------------------------------

function Signaler({ onEnvoye }: { onEnvoye: () => void }) {
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');

  const envoi = useMutation({
    mutationFn: () => deposerSignalement(sujet.trim(), corps.trim()),
    onSuccess: () => {
      toast.success('Signalement envoyé à la direction');
      setSujet('');
      setCorps('');
      onEnvoye();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Le message n'est pas parti."),
  });

  return (
    <section className="carte p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
        <AlertTriangle className="h-4 w-4 text-rose-600" />
        Signaler quelque chose
      </h2>
      <p className="mt-1 text-xs text-ardoise-500">
        Un bouton qui ne répond pas, un chiffre qui semble faux, une idée. La direction le voit
        tout de suite et vous dira où ça en est.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="etiquette" htmlFor="sujet">
            En une ligne, ce qui ne va pas
          </label>
          <input
            id="sujet"
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            placeholder="Le bouton Valider la cure ne répond pas"
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="corps">
            Ce que vous faisiez au moment où c’est arrivé
          </label>
          <textarea
            id="corps"
            rows={3}
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            placeholder="J’étais sur la fiche de Mme Marchand, à la fin du bilan. J’ai cliqué deux fois, rien ne s’est passé."
            className="champ resize-y"
          />
          <p className="mt-1.5 text-xs text-ardoise-500">
            Plus c’est précis, plus vite c’est corrigé. L’écran, la cliente, ce que vous attendiez.
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => envoi.mutate()}
          disabled={envoi.isPending || sujet.trim().length === 0}
          className="bouton-fort"
        >
          {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Send className="h-4 w-4" />
          Envoyer à la direction
        </button>
      </div>
    </section>
  );
}

function Annoncer({ onEnvoye }: { onEnvoye: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [choisies, setChoisies] = useState<string[]>([]);

  const { data: therapeutes = [] } = useQuery({
    queryKey: ['therapeutes-joignables'],
    queryFn: therapeutesJoignables,
    staleTime: 5 * 60 * 1000,
  });

  const parCentre = useMemo(() => {
    const m = new Map<string, typeof therapeutes>();
    for (const t of therapeutes) {
      const liste = m.get(t.centre) ?? [];
      liste.push(t);
      m.set(t.centre, liste);
    }
    return [...m.entries()];
  }, [therapeutes]);

  const envoi = useMutation({
    mutationFn: () => envoyerAnnonce(sujet.trim(), corps.trim(), choisies),
    onSuccess: () => {
      toast.success(
        choisies.length === 1 ? 'Annonce envoyée' : `Annonce envoyée à ${choisies.length} thérapeutes`,
      );
      setSujet('');
      setCorps('');
      setChoisies([]);
      setOuvert(false);
      onEnvoye();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "L'annonce n'est pas partie."),
  });

  function basculer(id: string) {
    setChoisies((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="bouton-fort">
        <Megaphone className="h-4 w-4" />
        Écrire une annonce
      </button>
    );
  }

  return (
    <section className="carte p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
        <Megaphone className="h-4 w-4 text-marine-700" />
        Nouvelle annonce
      </h2>

      <div className="mt-4 space-y-3">
        <div>
          <label className="etiquette" htmlFor="a-sujet">
            L’objet
          </label>
          <input
            id="a-sujet"
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            placeholder="Le bilan seul passe à 129 € lundi"
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="a-corps">
            Le message
          </label>
          <textarea
            id="a-corps"
            rows={3}
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            className="champ resize-y"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="etiquette mb-0">À qui</span>
            <button
              type="button"
              onClick={() =>
                setChoisies(choisies.length === therapeutes.length ? [] : therapeutes.map((t) => t.id))
              }
              className="text-xs font-semibold text-marine-700 hover:underline"
            >
              {choisies.length === therapeutes.length ? 'Ne sélectionner personne' : 'Toute l’équipe'}
            </button>
          </div>

          <div className="mt-2 space-y-3">
            {parCentre.map(([centre, liste]) => {
              const ids = liste.map((t) => t.id);
              const toutes = ids.every((id) => choisies.includes(id));
              return (
                <div key={centre}>
                  <button
                    type="button"
                    onClick={() =>
                      setChoisies((c) =>
                        toutes ? c.filter((x) => !ids.includes(x)) : [...new Set([...c, ...ids])],
                      )
                    }
                    className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400 hover:text-marine-700"
                  >
                    {centre}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {liste.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => basculer(t.id)}
                        aria-pressed={choisies.includes(t.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          choisies.includes(t.id)
                            ? 'border-marine-600 bg-marine-600 text-white'
                            : 'border-ardoise-200 bg-white text-ardoise-700 hover:border-marine-400'
                        }`}
                      >
                        {t.prenom}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button onClick={() => setOuvert(false)} disabled={envoi.isPending} className="bouton-discret">
          Annuler
        </button>
        <button
          onClick={() => envoi.mutate()}
          disabled={envoi.isPending || sujet.trim().length === 0 || choisies.length === 0}
          className="bouton-fort"
        >
          {envoi.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Send className="h-4 w-4" />
          Envoyer
          {choisies.length > 0 && ` à ${choisies.length}`}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Lire
// ---------------------------------------------------------------------------

function Liste({
  titre,
  vide,
  messages,
  direction,
  moi,
  ouvert,
  setOuvert,
  onChange,
}: {
  titre: string;
  vide: string;
  messages: MessageComplet[];
  direction: boolean;
  moi: string | null;
  ouvert: string | null;
  setOuvert: (id: string | null) => void;
  onChange: () => void;
}) {
  return (
    <section className="carte overflow-hidden">
      <h2 className="border-b border-ardoise-100 px-5 py-3.5 text-sm font-semibold text-ardoise-900">
        {titre}
      </h2>
      {messages.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ardoise-500">{vide}</p>
      ) : (
        <div className="divide-y divide-ardoise-100">
          {messages.map((m) => (
            <Ligne
              key={m.message.id}
              complet={m}
              direction={direction}
              moi={moi}
              ouvert={ouvert === m.message.id}
              onOuvrir={() => setOuvert(ouvert === m.message.id ? null : m.message.id)}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Ligne({
  complet,
  direction,
  moi,
  ouvert,
  onOuvrir,
  onChange,
}: {
  complet: MessageComplet;
  direction: boolean;
  moi: string | null;
  ouvert: boolean;
  onOuvrir: () => void;
  onChange: () => void;
}) {
  const { message: m, destinataires } = complet;
  const [reponse, setReponse] = useState(m.reponse);

  const maLigne = destinataires.find((d) => d.therapeute_id === moi);
  const nonLu = maLigne != null && maLigne.lu_le === null;

  /*
    Marquer lu à l'ouverture, pas au survol : la direction doit pouvoir se
    fier au compteur pour savoir si le message est passé.
  */
  useEffect(() => {
    if (ouvert && nonLu && moi) {
      marquerLu(m.id, moi).then(onChange).catch(() => undefined);
    }
  }, [ouvert, nonLu, moi, m.id, onChange]);

  const avancer = useMutation({
    mutationFn: (s: StatutMessage) => changerStatut(m.id, s),
    onSuccess: onChange,
    onError: () => toast.error("Le statut n'a pas pu être changé."),
  });

  const envoiReponse = useMutation({
    mutationFn: () => repondre(m.id, reponse.trim()),
    onSuccess: () => {
      toast.success('Réponse enregistrée');
      onChange();
    },
    onError: () => toast.error("La réponse n'a pas pu être enregistrée."),
  });

  const suppression = useMutation({
    mutationFn: () => supprimerMessage(m.id),
    onSuccess: () => {
      toast.success('Message supprimé');
      onChange();
    },
    onError: () => toast.error("Le message n'a pas pu être supprimé."),
  });

  return (
    <div className={nonLu ? 'bg-marine-50/40' : ''}>
      <button
        onClick={onOuvrir}
        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-ardoise-50"
      >
        {nonLu && <span className="h-2 w-2 shrink-0 rounded-full bg-marine-600" aria-label="Non lu" />}
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm ${nonLu ? 'font-semibold text-ardoise-900' : 'text-ardoise-800'}`}>
            {m.sujet}
          </div>
          <div className="mt-0.5 text-xs text-ardoise-500">
            {m.auteur || '—'} · {format(new Date(m.cree_le), 'd MMM yyyy', { locale: fr })} ·{' '}
            {direction ? resume(m, destinataires) : resumeRecu(m, maLigne)}
          </div>
        </div>
        {m.type === 'signalement' && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wide ${ETATS[m.statut].pastille}`}
          >
            {ETATS[m.statut].libelle}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="border-t border-ardoise-100 bg-white px-5 py-4">
          {m.corps ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ardoise-700">{m.corps}</p>
          ) : (
            <p className="text-sm italic text-ardoise-400">Pas de détail.</p>
          )}

          {direction && m.type === 'annonce' && destinataires.length > 0 && (
            <QuiALu destinataires={destinataires} />
          )}

          {m.reponse && (
            <div className="mt-4 rounded-lg border-l-2 border-marine-500 bg-marine-50 px-4 py-3">
              <div className="text-2xs font-semibold uppercase tracking-widest text-marine-700">
                Réponse de la direction
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ardoise-800">{m.reponse}</p>
            </div>
          )}

          {direction && m.type === 'signalement' && (
            <div className="mt-4 space-y-3 border-t border-ardoise-100 pt-4">
              <div className="flex flex-wrap gap-1.5">
                {STATUTS_SIGNALEMENT.map((s) => (
                  <button
                    key={s}
                    onClick={() => avancer.mutate(s)}
                    disabled={avancer.isPending}
                    className={`rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wide transition-opacity hover:opacity-80 ${
                      m.statut === s ? ETATS[s].pastille : 'bg-ardoise-100 text-ardoise-500'
                    }`}
                  >
                    {m.statut === s && <Check className="mr-1 inline h-3 w-3" />}
                    {ETATS[s].libelle}
                  </button>
                ))}
              </div>

              <div>
                <label className="etiquette" htmlFor={`rep-${m.id}`}>
                  Répondre à {m.auteur}
                </label>
                <textarea
                  id={`rep-${m.id}`}
                  rows={2}
                  value={reponse}
                  onChange={(e) => setReponse(e.target.value)}
                  placeholder="C’est corrigé, rechargez la page."
                  className="champ resize-y"
                />
              </div>

              <div className="flex justify-between gap-3">
                <button
                  onClick={() => suppression.mutate()}
                  disabled={suppression.isPending}
                  className="bouton-discret border-rose-200 text-xs text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
                <button
                  onClick={() => envoiReponse.mutate()}
                  disabled={envoiReponse.isPending || reponse.trim() === m.reponse}
                  className="bouton-fort text-xs"
                >
                  {envoiReponse.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Enregistrer la réponse
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Qui a lu l'annonce, et qui ne l'a pas encore ouverte.
 *
 * Un compte — « 9 sur 13 » — ne dit pas quoi faire. Des prénoms, si : on
 * sait à qui en toucher un mot avant l'ouverture demain.
 */
function QuiALu({ destinataires }: { destinataires: Destinataire[] }) {
  const { enAttente, ontLu } = parLecture(destinataires);
  const { lus, total } = lecture(destinataires);

  return (
    <div className="mt-4 border-t border-ardoise-100 pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="etiquette mb-0">Qui l’a lue</span>
        <span className="text-xs text-ardoise-500">
          {lus} sur {total}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {enAttente.map((d) => (
          <span
            key={d.therapeute_id}
            className="inline-flex items-center gap-1 rounded-full bg-ardoise-100 px-2.5 py-1 text-xs font-semibold text-ardoise-500"
          >
            <Clock className="h-3 w-3" />
            {d.prenom ?? '—'}
          </span>
        ))}
        {ontLu.map((d) => (
          <span
            key={d.therapeute_id}
            title={
              d.lu_le
                ? `Lue le ${format(new Date(d.lu_le), 'd MMMM à HH:mm', { locale: fr })}`
                : undefined
            }
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"
          >
            <Check className="h-3 w-3" />
            {d.prenom ?? '—'}
          </span>
        ))}
      </div>
    </div>
  );
}
