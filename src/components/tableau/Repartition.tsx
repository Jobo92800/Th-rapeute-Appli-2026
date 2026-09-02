/**
 * Une répartition en barres horizontales : moyens de paiement, technologies,
 * profils BioPortrait. La barre se lit d'un coup d'œil, le chiffre reste
 * lisible à droite.
 */
export default function Repartition({
  titre,
  lignes,
  format,
  vide = 'Rien sur cette période',
}: {
  titre: string;
  lignes: Array<{ libelle: string; valeur: number; detail?: string }>;
  format?: (n: number) => string;
  vide?: string;
}) {
  const max = Math.max(1, ...lignes.map((l) => l.valeur));

  return (
    <section className="carte p-5">
      <h2 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">{titre}</h2>

      {lignes.length === 0 ? (
        <p className="mt-3 text-sm text-ardoise-400">{vide}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {lignes.map((l) => (
            <li key={l.libelle}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-ardoise-700">{l.libelle}</span>
                <span className="chiffres shrink-0 font-semibold text-ardoise-900">
                  {format ? format(l.valeur) : l.valeur}
                  {l.detail && <span className="ml-1.5 text-xs font-normal text-ardoise-400">{l.detail}</span>}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ardoise-100">
                <div
                  className="h-full rounded-full bg-marine-500"
                  style={{ width: `${Math.round((l.valeur / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
