import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { contenuCliente, supprimerCliente } from '../../services/clientes';
import type { Cliente } from '../../types/db';

interface Props {
  cliente: Cliente;
  onFerme: () => void;
  onSupprimee: () => void;
}

const LIBELLES: Array<{ cle: keyof Awaited<ReturnType<typeof contenuCliente>>; un: string; plusieurs: string }> = [
  { cle: 'bilans', un: 'bilan Empreinte', plusieurs: 'bilans Empreinte' },
  { cle: 'programmes', un: 'cure', plusieurs: 'cures' },
  { cle: 'seances', un: 'séance', plusieurs: 'séances' },
  { cle: 'mensurations', un: 'relevé de mensurations', plusieurs: 'relevés de mensurations' },
  { cle: 'contrats', un: 'contrat signé', plusieurs: 'contrats signés' },
  { cle: 'notes', un: 'note', plusieurs: 'notes' },
  { cle: 'ventes', un: 'vente de complément', plusieurs: 'ventes de compléments' },
];

/**
 * La suppression est définitive et emporte tout le dossier. On demande donc
 * de retaper le nom : une confirmation qu'on ne peut pas donner par réflexe.
 */
export default function ModaleSuppression({ cliente, onFerme, onSupprimee }: Props) {
  const nomComplet = `${cliente.prenom} ${cliente.nom}`;
  const [saisie, setSaisie] = useState('');
  const [aussiAirtable, setAussiAirtable] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: contenu, isLoading } = useQuery({
    queryKey: ['contenu-cliente', cliente.id],
    queryFn: () => contenuCliente(cliente.id),
  });

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !enCours && onFerme();
    document.addEventListener('keydown', echap);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', echap);
      document.body.style.overflow = '';
    };
  }, [onFerme, enCours]);

  const lignes = contenu
    ? LIBELLES.filter((l) => (contenu[l.cle] ?? 0) > 0).map((l) => {
        const n = contenu[l.cle];
        return `${n} ${n > 1 ? l.plusieurs : l.un}`;
      })
    : [];

  const nomConfirme = saisie.trim().toLowerCase() === nomComplet.trim().toLowerCase();

  async function supprimer() {
    setEnCours(true);
    setErreur(null);
    try {
      await supprimerCliente(cliente.id, {
        supprimerDansAirtable: aussiAirtable,
        airtableRecordId: cliente.airtable_record_id,
      });
      onSupprimee();
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : "La suppression a échoué. Seule la direction peut supprimer une fiche.",
      );
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ardoise-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Supprimer ${nomComplet}`}
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-carte"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ardoise-200 px-5 py-3.5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <h2 className="text-sm font-semibold text-ardoise-900">
                Supprimer définitivement {nomComplet}
              </h2>
              <p className="text-xs text-ardoise-500">Cette action ne peut pas être annulée.</p>
            </div>
          </div>
          <button
            onClick={onFerme}
            disabled={enCours}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-sm font-semibold text-rose-900">Ce qui sera effacé avec la fiche</p>
            {isLoading ? (
              <p className="mt-1 text-sm text-rose-800">Vérification…</p>
            ) : lignes.length === 0 ? (
              <p className="mt-1 text-sm text-rose-800">
                Rien d'autre : cette fiche n'a ni bilan, ni cure, ni séance.
              </p>
            ) : (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-rose-800">
                {lignes.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-sm text-ardoise-600">
            Si vous voulez seulement la sortir des listes, <strong>archivez-la</strong> plutôt :
            rien n'est perdu et la fiche se restaure.
          </p>

          {cliente.airtable_record_id && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ardoise-200 px-3 py-2.5 text-sm text-ardoise-700">
              <input
                type="checkbox"
                checked={aussiAirtable}
                onChange={(e) => setAussiAirtable(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-ardoise-300 text-rose-600 focus:ring-rose-500"
              />
              <span>
                Supprimer aussi la fiche dans Airtable
                <span className="block text-xs text-ardoise-500">
                  Décochez pour la conserver dans le CRM malgré tout.
                </span>
              </span>
            </label>
          )}

          <div>
            <label htmlFor="confirmation" className="etiquette">
              Retapez « {nomComplet} » pour confirmer
            </label>
            <input
              id="confirmation"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              autoComplete="off"
              className="champ"
              placeholder={nomComplet}
            />
          </div>

          {erreur && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {erreur}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ardoise-200 px-5 py-4">
          <button onClick={onFerme} disabled={enCours} className="bouton-discret">
            Annuler
          </button>
          <button
            onClick={supprimer}
            disabled={!nomConfirme || enCours}
            className="bouton bg-rose-600 text-white hover:bg-rose-700"
          >
            {enCours ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {enCours ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  );
}
