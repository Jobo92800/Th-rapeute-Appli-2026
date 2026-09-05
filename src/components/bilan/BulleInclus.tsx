import { useEffect, useState } from 'react';
import {
  BookOpenCheck,
  ChefHat,
  Headphones,
  Lock,
  Moon,
  Scale,
  TrendingUp,
  X,
} from 'lucide-react';
import type { Atout, DetailInclus } from '../../domain/inclus';
import MaquetteParcours from './MaquetteParcours';

/*
  Les icônes vivent ici, pas dans le module de contenu : celui-ci nomme un
  atout, l'écran sait à quoi ressemble un casque.
*/
const ICONES = {
  casque: Headphones,
  cadenas: Lock,
  progression: TrendingUp,
  lune: Moon,
  phases: BookOpenCheck,
  recettes: ChefHat,
  balance: Scale,
} as const;

/**
 * La bulle qui montre le guide ou l'application audio.
 *
 * Elle s'ouvre pendant le rendez-vous, sur une tablette posée entre la
 * thérapeute et la cliente : d'où un panneau centré plutôt qu'une infobulle
 * accrochée à un bouton de six millimètres.
 *
 * Le visuel d'abord, les atouts en pastilles ensuite, le texte en dernier.
 * C'est l'ordre dans lequel on regarde : personne ne lit deux paragraphes
 * avant d'avoir vu de quoi on parle.
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

  const visuel = detail.maquette === 'parcours' ? <MaquetteParcours /> : null;
  const photo = detail.image && !imageCassee;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={detail.titre}
      onClick={onFerme}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ardoise-900/50 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        {/* Le visuel, en tête et sur toute la largeur */}
        {(visuel || photo) && (
          <div className="relative rounded-t-3xl bg-gradient-to-b from-marine-50 to-marine-100/60 px-6 pb-6 pt-7">
            <button
              type="button"
              onClick={onFerme}
              aria-label="Fermer"
              className="absolute right-3 top-3 rounded-full bg-white/70 p-1.5 text-ardoise-500 hover:bg-white hover:text-ardoise-800"
            >
              <X className="h-4 w-4" />
            </button>
            {visuel ?? (
              <img
                src={detail.image}
                alt={detail.alt ?? ''}
                onError={() => setImageCassee(true)}
                className="mx-auto max-h-[22rem] w-auto rounded-xl object-contain"
              />
            )}
          </div>
        )}

        <div className="px-6 pb-6 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold leading-tight tracking-tight text-ardoise-900">
                {detail.titre}
              </h2>
              <p className="mt-1 text-sm font-semibold text-rose-600">{detail.accroche}</p>
            </div>
            {!visuel && !photo && (
              <button
                type="button"
                onClick={onFerme}
                aria-label="Fermer"
                className="-mr-1 rounded-full p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-700"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {detail.atouts.map((a) => (
              <Pastille key={a.texte} atout={a} />
            ))}
          </div>

          <div className="mt-4 space-y-2.5">
            {detail.paragraphes.map((p) => (
              <p key={p.slice(0, 24)} className="text-[13.5px] leading-relaxed text-ardoise-700">
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pastille({ atout }: { atout: Atout }) {
  const Icone = ICONES[atout.icone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-marine-200 bg-marine-50 px-3 py-1.5 text-xs font-semibold text-marine-800">
      <Icone className="h-3.5 w-3.5 shrink-0 text-marine-600" />
      {atout.texte}
    </span>
  );
}
