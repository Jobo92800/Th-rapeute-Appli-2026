import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Shirt, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { texteErreur } from '../../lib/erreurs';
import { definirTailleCombi, lireCliente } from '../../services/clientes';

/**
 * Les deux tailles de l'I-Shape, sous les boutons de démarrage — en gros,
 * parce que c'est au moment d'installer la cliente qu'on en a besoin, et
 * qu'une pastille en petit se cherchait.
 *
 * LA TENUE est vendue à la signature : sa taille est figée sur la cure, on
 * la lit. LA COMBI est le matériel du centre, enfilé à chaque séance : sa
 * taille se constate, se note ici, et change au fil de la cure — c'est
 * même le but. Elle vit sur la cliente et se modifie d'un clic, sans
 * passer par un autre onglet.
 */
export default function EquipementIShape({
  clienteId,
  tailleTenue,
}: {
  clienteId: string;
  tailleTenue: string | null;
}) {
  const qc = useQueryClient();
  const { data: cliente } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: () => lireCliente(clienteId),
  });
  const tailleCombi = cliente?.taille_combi_ishape ?? null;

  const [edition, setEdition] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!edition) setSaisie(tailleCombi ?? '');
  }, [tailleCombi, edition]);

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    try {
      await definirTailleCombi(clienteId, saisie);
      qc.invalidateQueries({ queryKey: ['cliente', clienteId] });
      toast.success(saisie.trim() ? `Combi I-Shape : taille ${saisie.trim()}` : 'Taille de combi effacée');
      setEdition(false);
    } catch (err) {
      toast.error(texteErreur(err) || "La taille n'a pas pu être enregistrée.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <Shirt className="h-6 w-6 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-widest text-amber-800">
            Tenue I-Shape
          </p>
          <p className="text-2xl font-bold leading-tight text-amber-950">
            {tailleTenue ? `Taille ${tailleTenue}` : '—'}
          </p>
          <p className="text-xs text-amber-800/80">
            {tailleTenue ? 'Remise à la signature du contrat.' : 'Pas de taille enregistrée à la signature.'}
          </p>
        </div>
      </div>

      <form
        onSubmit={enregistrer}
        className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
      >
        <Shirt className="h-6 w-6 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-semibold uppercase tracking-widest text-amber-800">
            Combi I-Shape
          </p>
          {edition ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                autoFocus
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                maxLength={12}
                placeholder="ex. M, L, 2…"
                aria-label="Taille de la combi I-Shape"
                className="champ w-28 text-lg font-bold"
              />
              <button type="submit" disabled={enCours} className="bouton-fort px-3 py-1.5 text-xs">
                <Check className="h-3.5 w-3.5" />
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setEdition(false)}
                disabled={enCours}
                aria-label="Annuler"
                className="rounded-lg p-1.5 text-ardoise-500 hover:bg-amber-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold leading-tight text-amber-950">
                {tailleCombi ? `Taille ${tailleCombi}` : 'À renseigner'}
              </p>
              <p className="text-xs text-amber-800/80">
                Notée par la thérapeute, à mettre à jour quand elle change.
              </p>
            </>
          )}
        </div>
        {!edition && (
          <button
            type="button"
            onClick={() => setEdition(true)}
            className="bouton-discret shrink-0 border-amber-300 text-xs text-amber-900 hover:bg-amber-100"
          >
            <Pencil className="h-3.5 w-3.5" />
            {tailleCombi ? 'Modifier' : 'Renseigner'}
          </button>
        )}
      </form>
    </div>
  );
}
