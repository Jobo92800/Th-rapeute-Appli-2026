/**
 * Les communes d'un code postal qui en couvre plusieurs — 34980 en a cinq.
 *
 * Elles s'affichent sous le champ Ville, à cliquer. On ne choisit pas à la
 * place de la thérapeute : elle seule sait où habite la cliente, et prendre
 * la première de la liste écrirait « Combaillaux » à quelqu'un de
 * Saint-Gély-du-Fesc.
 */
export default function ChoixDeVille({
  propositions,
  onChoisir,
}: {
  propositions: string[];
  onChoisir: (nom: string) => void;
}) {
  if (propositions.length === 0) return null;

  return (
    <div className="mt-1.5">
      <p className="text-2xs uppercase tracking-widest text-ardoise-400">
        {propositions.length} communes pour ce code postal
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {propositions.map((nom) => (
          <button
            key={nom}
            type="button"
            onClick={() => onChoisir(nom)}
            className="rounded-full border border-ardoise-200 bg-white px-2.5 py-1 text-xs font-medium text-ardoise-700 transition-colors hover:border-marine-400 hover:bg-marine-50 hover:text-marine-800"
          >
            {nom}
          </button>
        ))}
      </div>
    </div>
  );
}
