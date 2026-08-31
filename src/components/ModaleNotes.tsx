import { useEffect } from 'react';
import { X } from 'lucide-react';
import Notes from './fiche/Notes';

interface Props {
  clienteId: string;
  centreId: string;
  nomCliente: string;
  onFermer: () => void;
}

export default function ModaleNotes({ clienteId, centreId, nomCliente, onFermer }: Props) {
  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    document.addEventListener('keydown', echap);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', echap);
      document.body.style.overflow = '';
    };
  }, [onFermer]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ardoise-950/40 p-4"
      onClick={onFermer}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Notes de ${nomCliente}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-carte"
      >
        <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ardoise-900">Notes — {nomCliente}</h2>
            <p className="text-xs text-ardoise-500">Visibles par toute l'équipe du centre.</p>
          </div>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-5">
          <Notes clienteId={clienteId} centreId={centreId} compact />
        </div>
      </div>
    </div>
  );
}
