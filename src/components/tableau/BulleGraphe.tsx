import type { ReactNode } from 'react';

/*
  L'info-bulle des graphiques.

  Les `<title>` du SVG faisaient déjà le travail, mais avec les manières du
  navigateur : une seconde d'attente, une bulle système, et rien quand on
  survole entre deux points. Ici la bulle suit la souris, sort tout de suite
  et donne le mois entier plutôt que la seule barre visée.

  Elle se place dans le cadre qui défile, donc en coordonnées de ce cadre —
  `x` compte le défilement horizontal, sans quoi elle glisserait dès qu'on
  fait défiler un graphique plus large que l'écran. Et elle se replie à
  gauche du curseur près du bord droit, pour ne jamais sortir du cadre.
*/
export default function BulleGraphe({
  x,
  y,
  largeur,
  children,
}: {
  x: number;
  y: number;
  /** Largeur du cadre, pour savoir de quel côté se replier. */
  largeur: number;
  children: ReactNode;
}) {
  const aDroite = x > largeur - 170;

  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 max-w-56 rounded-lg border border-ardoise-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{
        left: x,
        top: y,
        transform: `translate(${aDroite ? 'calc(-100% - 14px)' : '14px'}, -50%)`,
      }}
    >
      {children}
    </div>
  );
}
