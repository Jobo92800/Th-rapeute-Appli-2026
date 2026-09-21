import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { texteErreur } from '../../lib/erreurs';
import { contenuCure, supprimerCure } from '../../services/avoirs';
import { formaterEuros } from '../../domain/tarification';
import type { Cliente, Programme } from '../../types/db';

/**
 * Supprimer une cure — pas l'arrêter.
 *
 * Arrêter dit qu'elle a existé et qu'elle s'interrompt : on annule ce qui
 * reste dû, on fait un avoir. Supprimer dit qu'elle n'aurait jamais dû
 * exister — ajoutée sur la mauvaise fiche, un essai, une erreur de saisie.
 * Les deux gestes se ressemblent sur l'écran et ne laissent pas la même
 * chose derrière eux : la fenêtre le dit avant de laisser confirmer.
 *
 * Définitive et sans corbeille, comme la suppression d'une fiche : on
 * montre ce qui part, et on fait retaper le nom.
 */
export default function ModaleSuppressionCure({
  cliente,
  programme,
  centreId,
  onFerme,
}: {
  cliente: Cliente;
  programme: Programme;
  centreId: string;
  onFerme: () => void;
}) {
  const qc = useQueryClient();
  const nomComplet = `${cliente.prenom} ${cliente.nom}`;
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: contenu, isLoading } = useQuery({
    queryKey: ['contenu-cure', programme.id],
    queryFn: () => contenuCure(programme.id),
  });

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !enCours && onFerme();
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [onFerme, enCours]);

  const nomConfirme = saisie.trim().toLowerCase() === nomComplet.trim().toLowerCase();

  const lignes: string[] = [];
  if (contenu) {
    if (contenu.seances_faites > 0) {
      lignes.push(
        `${contenu.seances_faites} séance${contenu.seances_faites > 1 ? 's' : ''} réalisée${contenu.seances_faites > 1 ? 's' : ''}`,
      );
    }
    if (contenu.echeances_payees > 0) {
      lignes.push(
        `${contenu.echeances_payees} règlement${contenu.echeances_payees > 1 ? 's' : ''} encaissé${contenu.echeances_payees > 1 ? 's' : ''}, ${formaterEuros(contenu.montant_paye, 2)} — ils sortiront du tableau de bord`,
      );
    }
    if (contenu.contrats > 0) {
      lignes.push('le contrat signé et ses consentements');
    }
    if (contenu.sorties_stock > 0) {
      lignes.push(
        'les sorties de stock de la signature : le guide et la tenue reviennent au rayon',
      );
    }
    if (contenu.complements_compris > 0) {
      lignes.push(
        `${contenu.complements_compris} boîte${contenu.complements_compris > 1 ? 's' : ''} de compléments comprise${contenu.complements_compris > 1 ? 's' : ''} dans la cure — elle${contenu.complements_compris > 1 ? 's' : ''} revien${contenu.complements_compris > 1 ? 'nent' : 't'} au rayon`,
      );
    }
    if (contenu.avoir_accorde > 0) {
      lignes.push(`l'avoir de ${formaterEuros(contenu.avoir_accorde, 2)} né de son arrêt`);
    }
  }
  const avoirRendu = contenu?.avoir_utilise ?? 0;

  async function supprimer() {
    setEnCours(true);
    setErreur(null);
    try {
      const reste = await supprimerCure(programme.id, cliente.airtable_record_id);
      qc.invalidateQueries({ queryKey: ['programmes', cliente.id] });
      qc.invalidateQueries({ queryKey: ['avoir', cliente.id] });
      qc.invalidateQueries({ queryKey: ['avoir-mouvements', cliente.id] });
      qc.invalidateQueries({ queryKey: ['contrats', cliente.id] });
      qc.invalidateQueries({ queryKey: ['situations', centreId] });
      // Les boîtes comprises dans la cure sont parties avec elle : le rayon les récupère.
      qc.invalidateQueries({ queryKey: ['ventes', cliente.id] });
      qc.invalidateQueries({ queryKey: ['stock', centreId] });
      if (reste) toast(reste, { duration: 10000, icon: '⚠️' });
      else toast.success(`Cure ${programme.numero} supprimée`);
      onFerme();
    } catch (e) {
      // Le refus vient de la base et dit précisément pourquoi : on le montre.
      setErreur(texteErreur(e) || "La cure n'a pas pu être supprimée.");
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Supprimer la cure ${programme.numero}`}
        className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-flottante"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ardoise-200 px-5 py-3.5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <h2 className="text-sm font-semibold text-ardoise-900">
                Supprimer définitivement la cure {programme.numero}
              </h2>
              <p className="text-xs text-ardoise-500">
                {formaterEuros(Number(programme.montant_total), 2)} · cette action ne peut pas
                être annulée.
              </p>
            </div>
          </div>
          <button
            onClick={onFerme}
            disabled={enCours}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-sm font-semibold text-rose-900">Ce qui sera effacé avec la cure</p>
            {isLoading ? (
              <p className="mt-1 text-sm text-rose-800">Vérification…</p>
            ) : (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-rose-800">
                <li>son échéancier et ses séances prévues</li>
                {lignes.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </div>

          <ul className="space-y-1 rounded-xl bg-ardoise-50 px-4 py-3 text-xs text-ardoise-600">
            <li>La fiche, le bilan, les mensurations et les ventes de compléments restent.</li>
            {avoirRendu > 0 && (
              <li>
                L’avoir de{' '}
                <strong className="font-semibold text-ardoise-800">
                  {formaterEuros(avoirRendu, 2)}
                </strong>{' '}
                dépensé sur cette cure lui est rendu.
              </li>
            )}
            {cliente.airtable_record_id && (
              <li>
                Dans Airtable, « {programme.numero <= 1 ? 'Montant Cure' : `Montant cure ${programme.numero}`} »
                sera vidé.
              </li>
            )}
          </ul>

          <p className="text-sm text-ardoise-600">
            Si la cliente s’arrête en cours de route, <strong>arrêtez la cure</strong> plutôt :
            elle a existé, et on lui fait un avoir. Supprimer, c’est pour une cure qui n’aurait
            jamais dû être créée.
          </p>

          <div>
            <label htmlFor="confirmation-cure" className="etiquette">
              Retapez « {nomComplet} » pour confirmer
            </label>
            <input
              id="confirmation-cure"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              autoComplete="off"
              className="champ"
              placeholder={nomComplet}
            />
          </div>

          {erreur && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {erreur}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ardoise-200 px-5 py-4">
          <button onClick={onFerme} disabled={enCours} className="bouton-discret">
            Annuler
          </button>
          <button
            onClick={supprimer}
            disabled={!nomConfirme || enCours}
            className="bouton bg-rose-600 text-white hover:bg-rose-700"
          >
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {enCours ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  );
}
