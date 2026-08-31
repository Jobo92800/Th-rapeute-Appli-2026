import { Package } from 'lucide-react';
import type { EtatStock } from '../../types/db';
import { COULEURS_NIVEAU, LIBELLES_NIVEAU, niveauStock } from '../../domain/stock';

/**
 * Une carte par produit : la quantité en gros, le niveau en pastille.
 * Cliquer ouvre les mouvements — c'est le seul geste de l'écran.
 */
export default function CarteProduit({
  ligne,
  onOuvrir,
}: {
  ligne: EtatStock;
  onOuvrir: () => void;
}) {
  const niveau = niveauStock(ligne.quantite, ligne.seuil_bas, ligne.seuil_critique);

  return (
    <button
      type="button"
      onClick={onOuvrir}
      className="carte flex flex-col items-start gap-3 p-4 text-left transition hover:border-marine-300 hover:shadow-md"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="text-sm font-semibold text-ardoise-900">{ligne.nom}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${COULEURS_NIVEAU[niveau]}`}>
          {LIBELLES_NIVEAU[niveau]}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          className={`chiffres text-3xl font-bold ${
            ligne.quantite <= 0 ? 'text-red-600' : 'text-ardoise-900'
          }`}
        >
          {ligne.quantite}
        </span>
        <span className="text-xs text-ardoise-500">
          {ligne.unite}
          {Math.abs(ligne.quantite) > 1 ? 's' : ''}
        </span>
      </div>

      <span className="flex items-center gap-1.5 text-[11px] text-ardoise-400">
        <Package className="h-3 w-3" />
        Alerte à {ligne.seuil_bas}, critique à {ligne.seuil_critique}
      </span>
    </button>
  );
}
