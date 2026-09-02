import { useEffect, useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { majSeance, supprimerSeance } from '../../services/metier';
import type { Seance } from '../../types/db';

/**
 * Modifier une séance déjà clôturée.
 *
 * Une pesée se saisit à la volée, entre deux gestes : le chiffre part de
 * travers, la date glisse d'un jour. Sans possibilité de correction, la
 * courbe garde l'erreur pour toujours — et c'est cette courbe qu'on montre
 * à la cliente.
 *
 * Le jeu du jour, lui, ne se rejoue pas : il appartient à la séance qui a
 * eu lieu.
 */
export default function ModaleSeance({
  seance,
  onFerme,
  onEnregistre,
}: {
  seance: Seance;
  onFerme: () => void;
  onEnregistre: () => void;
}) {
  const [date, setDate] = useState(seance.date_seance);
  const [poids, setPoids] = useState(seance.poids != null ? String(seance.poids) : '');
  const [commentaire, setCommentaire] = useState(seance.commentaire ?? '');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !enCours && onFerme();
    document.addEventListener('keydown', echap);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', echap);
      document.body.style.overflow = '';
    };
  }, [onFerme, enCours]);

  async function enregistrer() {
    const valeur = poids.trim().replace(',', '.');
    const nombre = valeur === '' ? null : Number(valeur);

    if (nombre != null && (Number.isNaN(nombre) || nombre <= 0 || nombre > 400)) {
      toast.error('Le poids doit être un nombre entre 1 et 400 kg.');
      return;
    }

    setEnCours(true);
    try {
      await majSeance(seance.id, {
        date_seance: date,
        poids: nombre,
        commentaire: commentaire.trim(),
      });
      toast.success('Séance corrigée');
      onEnregistre();
      onFerme();
    } catch {
      toast.error("La séance n'a pas pu être modifiée.");
      setEnCours(false);
    }
  }

  async function supprimer() {
    if (
      !confirm(
        'Supprimer cette séance ?\n\nElle repassera au compte des séances restantes, et sa pesée disparaîtra de la courbe.',
      )
    )
      return;

    setEnCours(true);
    try {
      await supprimerSeance(seance.id);
      toast.success('Séance supprimée');
      onEnregistre();
      onFerme();
    } catch {
      toast.error("La séance n'a pas pu être supprimée.");
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Modifier la séance"
        className="my-8 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-carte"
      >
        <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ardoise-900">Corriger la séance</h2>
          <button
            onClick={onFerme}
            disabled={enCours}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiquette" htmlFor="seance-date">
                Date
              </label>
              <input
                id="seance-date"
                type="date"
                className="champ"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="etiquette" htmlFor="seance-poids">
                Poids (kg)
              </label>
              <input
                id="seance-poids"
                type="text"
                inputMode="decimal"
                className="champ"
                value={poids}
                onChange={(e) => setPoids(e.target.value)}
                placeholder="Non relevé"
              />
            </div>
          </div>

          <div>
            <label className="etiquette" htmlFor="seance-com">
              Commentaire
            </label>
            <textarea
              id="seance-com"
              rows={3}
              className="champ resize-y"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
          </div>

          <p className="text-xs text-ardoise-500">
            Le soin et le jeu du jour ne se modifient pas : ils appartiennent à la séance qui a eu
            lieu.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-ardoise-200 px-5 py-4">
          <button
            onClick={supprimer}
            disabled={enCours}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ardoise-500 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>

          <div className="flex gap-3">
            <button onClick={onFerme} disabled={enCours} className="bouton-discret">
              Annuler
            </button>
            <button onClick={enregistrer} disabled={enCours} className="bouton-principal">
              {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
