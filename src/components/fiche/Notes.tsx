import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pin, PinOff, Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useSession } from '../../lib/session';
import {
  ajouterNote,
  epinglerNote,
  notesDeLaCliente,
  supprimerNote,
} from '../../services/metier';

interface Props {
  clienteId: string;
  centreId: string;
  /** Dans une fenêtre, la zone de saisie passe en premier et la liste défile. */
  compact?: boolean;
}

/**
 * Fil de notes partagé par l'équipe du centre. Sert aussi bien dans l'onglet
 * de la fiche que dans la fenêtre ouverte depuis la liste des clientes.
 */
export default function Notes({ clienteId, centreId, compact = false }: Props) {
  const { therapeute, role } = useSession();
  const qc = useQueryClient();
  const [texte, setTexte] = useState('');
  const [epingler, setEpingler] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', clienteId],
    queryFn: () => notesDeLaCliente(clienteId),
  });

  function rafraichir() {
    qc.invalidateQueries({ queryKey: ['notes', clienteId] });
    qc.invalidateQueries({ queryKey: ['resume-notes', centreId] });
  }

  const envoyer = useMutation({
    mutationFn: () =>
      ajouterNote({
        clienteId,
        centreId,
        auteur: therapeute?.prenom ?? '',
        texte,
        epinglee: epingler,
      }),
    onSuccess: () => {
      setTexte('');
      setEpingler(false);
      rafraichir();
    },
    onError: () => toast.error("La note n'a pas pu être enregistrée."),
  });

  async function basculerEpingle(id: string, valeur: boolean) {
    try {
      await epinglerNote(id, valeur);
      rafraichir();
    } catch {
      toast.error("La note n'a pas pu être épinglée.");
    }
  }

  async function supprimer(id: string) {
    if (!confirm('Supprimer cette note ?')) return;
    try {
      await supprimerNote(id);
      rafraichir();
    } catch {
      toast.error('Vous ne pouvez supprimer que vos propres notes.');
    }
  }

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!texte.trim()) return;
    envoyer.mutate();
  }

  const saisie = (
    <form onSubmit={soumettre} className="space-y-2.5">
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={compact ? 3 : 2}
        placeholder="Une information à transmettre à l'équipe…"
        className="champ resize-y"
        aria-label="Nouvelle note"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ardoise-600">
          <input
            type="checkbox"
            checked={epingler}
            onChange={(e) => setEpingler(e.target.checked)}
            className="h-4 w-4 rounded border-ardoise-300 text-marine-600 focus:ring-marine-500"
          />
          <Pin className="h-3.5 w-3.5 text-ardoise-400" />
          Épingler en haut de la fiche
        </label>
        <button
          type="submit"
          disabled={!texte.trim() || envoyer.isPending}
          className="bouton-principal"
        >
          <Send className="h-4 w-4" />
          {envoyer.isPending ? 'Envoi…' : 'Ajouter la note'}
        </button>
      </div>
    </form>
  );

  const liste = isLoading ? (
    <p className="py-8 text-center text-sm text-ardoise-400">Chargement…</p>
  ) : notes.length === 0 ? (
    <p className="py-10 text-center text-sm text-ardoise-500">
      Aucune note pour l'instant. Les notes sont visibles par toute l'équipe du centre.
    </p>
  ) : (
    <ul className="space-y-2.5">
      {notes.map((n) => {
        const sienne = Boolean(therapeute && n.therapeute_id === therapeute.id);
        return (
          <li
            key={n.id}
            className={`rounded-xl border px-4 py-3 ${
              n.epinglee ? 'border-amber-300 bg-amber-50' : 'border-ardoise-200 bg-white'
            }`}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {n.epinglee && (
                <Pin className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Épinglée" />
              )}
              <span className="text-sm font-semibold text-ardoise-900">
                {n.auteur || 'Thérapeute'}
              </span>
              <span
                className="text-xs text-ardoise-400"
                title={format(new Date(n.cree_le), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
              >
                {formatDistanceToNow(new Date(n.cree_le), { locale: fr, addSuffix: true })}
              </span>

              <span className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => basculerEpingle(n.id, !n.epinglee)}
                  title={n.epinglee ? 'Désépingler' : 'Épingler'}
                  aria-label={n.epinglee ? 'Désépingler la note' : 'Épingler la note'}
                  className="rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-700"
                >
                  {n.epinglee ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
                {(sienne || role === 'direction') && (
                  <button
                    type="button"
                    onClick={() => supprimer(n.id)}
                    title="Supprimer"
                    aria-label="Supprimer la note"
                    className="rounded-lg p-1.5 text-ardoise-400 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ardoise-700">
              {n.texte}
            </p>
          </li>
        );
      })}
    </ul>
  );

  if (compact) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {saisie}
        <div className="min-h-0 flex-1 overflow-y-auto">{liste}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="carte p-5">
        <h2 className="mb-1 text-sm font-semibold text-ardoise-900">Nouvelle note</h2>
        <p className="mb-4 text-xs text-ardoise-500">
          Visible par toute l'équipe du centre, signée de votre prénom.
        </p>
        {saisie}
      </section>

      <section className="carte p-5">
        <h2 className="mb-4 text-sm font-semibold text-ardoise-900">
          Historique{notes.length > 0 && ` — ${notes.length} note${notes.length > 1 ? 's' : ''}`}
        </h2>
        {liste}
      </section>
    </div>
  );
}
