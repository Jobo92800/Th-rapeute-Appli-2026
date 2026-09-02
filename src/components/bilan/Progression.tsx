/**
 * L'avancée dans le questionnaire. La barre se remplit d'un dégradé qui va
 * du teal au magenta : on voit qu'on approche de la fin sans avoir à lire
 * le compteur.
 */
export default function Progression({
  libelle,
  etape,
  total,
}: {
  libelle: string;
  etape: number;
  total: number;
}) {
  const fait = Math.round(((etape + 1) / total) * 100);

  return (
    <div className="mb-6">
      <div className="mb-2 flex justify-between text-xs font-medium text-ardoise-500">
        <span>{libelle}</span>
        <span className="chiffres">
          {etape + 1} / {total}
        </span>
      </div>

      <div
        className="relative h-2 overflow-hidden rounded-full"
        style={{ background: 'linear-gradient(90deg,#3BBFBF 0%,#8E6FC6 55%,#E8318A 100%)' }}
        role="progressbar"
        aria-valuenow={fait}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="absolute inset-y-0 right-0 bg-ardoise-200 transition-[width] duration-500"
          style={{ width: `${100 - fait}%` }}
        />
      </div>
    </div>
  );
}
