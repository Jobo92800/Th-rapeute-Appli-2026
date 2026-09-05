import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { DetailInclus } from '../../domain/inclus';

/**
 * La bulle qui montre le guide ou l'application audio.
 *
 * Elle s'ouvre pendant le rendez-vous, sur une tablette posée entre la
 * thérapeute et la cliente : d'où un panneau centré plutôt qu'une infobulle
 * accrochée à un bouton de six millimètres, et une image large — c'est
 * l'image qui fait le travail, le texte ne fait que la nommer.
 *
 * Si l'image manque, la bulle s'ouvre quand même avec son texte. Une
 * illustration absente ne doit pas priver la cliente de l'explication.
 */
export default function BulleInclus({
  detail,
  onFerme,
}: {
  detail: DetailInclus;
  onFerme: () => void;
}) {
  const [imageCassee, setImageCassee] = useState(false);

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => e.key === 'Escape' && onFerme();
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, [onFerme]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={detail.titre}
      onClick={onFerme}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ardoise-900/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ardoise-900">{detail.titre}</h2>
            <p className="mt-1 text-sm font-semibold text-marine-700">{detail.accroche}</p>
          </div>
          <button
            type="button"
            onClick={onFerme}
            aria-label="Fermer"
            className="-mr-1 rounded-full p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!imageCassee && (
          <div className="mt-4 bg-marine-50/60 px-6 py-5">
            <img
              src={detail.image}
              alt={detail.alt}
              onError={() => setImageCassee(true)}
              className="mx-auto max-h-[26rem] w-auto rounded-xl object-contain"
            />
          </div>
        )}

        <div className="space-y-3 px-6 pb-6 pt-4">
          {detail.paragraphes.map((p) => (
            <p key={p.slice(0, 24)} className="text-[13.5px] leading-relaxed text-ardoise-700">
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
