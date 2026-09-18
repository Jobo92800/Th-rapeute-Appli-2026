import { Minus, Package, Plus } from 'lucide-react';
import { formaterEuros } from '../../domain/tarification';
import type { EtatStock } from '../../types/db';

/**
 * Les boîtes de compléments choisies avec la cure.
 *
 * Le même bloc sert aux trois formulaires — le devis du bilan, la nouvelle
 * cure, l'anti-âge — pour qu'une boîte se vende pareil partout : 37 € la
 * boîte (tarif `complement`), comptée dans le montant de la cure, et
 * portée par la première échéance quand elle règle en plusieurs fois.
 *
 * Le rayon est celui du centre : on dit ce qu'il en reste, sans jamais
 * bloquer — comme sur la fiche, une vente réelle passe même si le comptage
 * est faux, et le stock négatif dit qu'il faut recompter.
 *
 * `edition` : sur le devis du bilan, l'écran est tourné vers la cliente et
 * les compteurs restent rangés derrière « Modifier », comme pour les
 * séances. Rangé, le bloc ne montre que ce qui a été choisi — et rien du
 * tout si rien ne l'a été : la cliente n'a pas à voir un catalogue.
 */
export default function ChoixComplements({
  catalogue,
  prix,
  quantites,
  onChange,
  edition = true,
  recommandation,
}: {
  /** Les compléments du rayon, avec ce qu'il en reste. */
  catalogue: EtatStock[];
  /** Le prix d'une boîte, de la grille. */
  prix: number;
  /** Code du produit → nombre de boîtes. */
  quantites: Record<string, number>;
  onChange: (quantites: Record<string, number>) => void;
  edition?: boolean;
  /** Le complément que le bilan oriente, pour le rappeler au moment de choisir. */
  recommandation?: { nom: string; raison: string } | null;
}) {
  const complements = catalogue.filter((c) => c.categorie === 'complement');
  const choisis = complements.filter((c) => (quantites[c.code] ?? 0) > 0);
  const boites = choisis.reduce((n, c) => n + (quantites[c.code] ?? 0), 0);
  const montant = boites * prix;

  function ajuster(code: string, delta: number) {
    onChange({ ...quantites, [code]: Math.max(0, (quantites[code] ?? 0) + delta) });
  }

  if (complements.length === 0) return null;
  if (!edition && choisis.length === 0) return null;

  return (
    <section className="carte">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ardoise-100 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-ardoise-900">Compléments alimentaires</h2>
          <p className="text-xs text-ardoise-500">
            {formaterEuros(prix)} la boîte, comptée dans la cure — réglée avec la première
            échéance.
          </p>
        </div>
        {boites > 0 && (
          <p className="chiffres text-sm font-semibold text-ardoise-900">
            {boites} boîte{boites > 1 ? 's' : ''} · {formaterEuros(montant)}
          </p>
        )}
      </div>

      {edition && recommandation && (
        <p className="border-b border-ardoise-100 bg-marine-50 px-5 py-2 text-xs text-marine-900">
          Orienté par son terrain : <strong className="font-semibold">{recommandation.nom}</strong>{' '}
          — {recommandation.raison}.
        </p>
      )}

      <div className="divide-y divide-ardoise-100">
        {(edition ? complements : choisis).map((c) => {
          const n = quantites[c.code] ?? 0;
          return (
            <div key={c.produit_id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p
                  className={`text-sm ${n > 0 ? 'font-semibold text-ardoise-900' : 'text-ardoise-600'}`}
                >
                  {c.nom}
                </p>
                {edition && (
                  <p
                    className={`flex items-center gap-1 text-[11px] ${
                      c.quantite - n < 0 ? 'text-amber-700' : 'text-ardoise-400'
                    }`}
                  >
                    <Package className="h-3 w-3" />
                    {c.quantite} en rayon
                    {c.quantite - n < 0 ? ' — il en manque, le rayon passera en négatif' : ''}
                  </p>
                )}
              </div>

              {edition ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => ajuster(c.code, -1)}
                    disabled={n <= 0}
                    aria-label={`Une boîte de ${c.nom} en moins`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ardoise-300 text-ardoise-600 hover:bg-ardoise-50 disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="chiffres w-8 text-center text-base font-bold text-ardoise-900">
                    {n}
                  </span>
                  <button
                    type="button"
                    onClick={() => ajuster(c.code, 1)}
                    aria-label={`Une boîte de ${c.nom} en plus`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-ardoise-300 text-ardoise-600 hover:bg-ardoise-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <span className="chiffres shrink-0 text-sm font-semibold text-ardoise-900">
                  ×{n}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
