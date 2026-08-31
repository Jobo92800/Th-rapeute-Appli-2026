import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

export default function EtatSynchro({
  enAttente,
  enErreur,
  erreurs,
  relanceEnCours,
  oubliEnCours,
  onRelancer,
  onOublier,
}: {
  enAttente: number;
  enErreur: number;
  erreurs: Array<{ entite: string; message: string }>;
  relanceEnCours: boolean;
  oubliEnCours: boolean;
  onRelancer: () => void;
  onOublier: () => void;
}) {
  const enPanne = enErreur > 0;
  const enCours = enAttente > 0;

  return (
    <div className="carte px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Synchronisation Airtable
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {(enPanne || enCours) && (
            <button
              onClick={onRelancer}
              disabled={relanceEnCours || oubliEnCours}
              className="text-2xs font-semibold uppercase tracking-wide text-marine-700 hover:text-marine-900 disabled:opacity-50"
            >
              {relanceEnCours ? 'Envoi…' : 'Relancer'}
            </button>
          )}
          {/* Une fiche supprimée à la main dans Airtable ne pourra jamais
              être mise à jour : l'échec est voulu, on l'écarte. */}
          {enPanne && (
            <button
              onClick={onOublier}
              disabled={relanceEnCours || oubliEnCours}
              title="Retire ces erreurs de la file. La fiche repartira à sa prochaine modification."
              className="text-2xs font-semibold uppercase tracking-wide text-ardoise-500 hover:text-ardoise-800 disabled:opacity-50"
            >
              {oubliEnCours ? 'Nettoyage…' : 'Écarter'}
            </button>
          )}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {enPanne ? (
          <>
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <span className="text-sm font-semibold text-rose-700">
              {enErreur} fiche{enErreur > 1 ? 's' : ''} en échec
            </span>
          </>
        ) : enCours ? (
          <>
            <RefreshCw className="h-5 w-5 text-marine-600" />
            <span className="text-sm font-semibold text-marine-800">
              {enAttente} en attente d'envoi
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">Tout est à jour</span>
          </>
        )}
      </div>

      {enPanne && erreurs.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-ardoise-100 pt-2">
          {erreurs.map((e, i) => (
            <li key={i} className="text-2xs leading-snug text-ardoise-500">
              <span className="font-semibold text-ardoise-700">{e.entite}</span> — {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
