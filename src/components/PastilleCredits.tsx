import { Gift } from 'lucide-react';

/**
 * Les séances offertes qui l'attendent, à poser sur sa prochaine cure.
 * Discrète : elle ne doit pas concurrencer le nom, juste se remarquer.
 */
export default function PastilleCredits({ nombre }: { nombre: number }) {
  if (nombre <= 0) return null;

  return (
    <span
      title={`${nombre} séance${nombre > 1 ? 's' : ''} offerte${nombre > 1 ? 's' : ''} par parrainage, à poser sur sa prochaine cure`}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-marine-50 px-1.5 py-px text-[10px] font-semibold text-marine-700"
    >
      <Gift className="h-2.5 w-2.5" />
      {nombre}
    </span>
  );
}
