import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import CompositionCure, { type Prescription } from './CompositionCure';
import { creerProgramme, lireGrilleTarifaire } from '../../services/metier';
import { filleulesDe, seancesOffertesUtilisees } from '../../services/parrainage';
import { calculerSolde } from '../../domain/parrainage';
import type { Cliente } from '../../types/db';

interface Props {
  cliente: Cliente;
  centreId: string;
  /** Numéro qui sera attribué, pour l'afficher avant validation. */
  numero: number;
  onFerme: () => void;
  onCreee: () => void;
}

/**
 * Une cure supplémentaire pour une cliente qui revient.
 *
 * Elle est totalement distincte de la précédente : son propre échéancier,
 * son propre décompte de séances, sa propre ligne de montant dans Airtable
 * (« Montant cure 2 », « Montant cure 3 »…). Aucun bilan n'est demandé :
 * le BioPortrait du premier bilan reste valable.
 */
export default function ModaleNouvelleCure({
  cliente,
  centreId,
  numero,
  onFerme,
  onCreee,
}: Props) {
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [totalSeances, setTotalSeances] = useState(0);
  const [enCours, setEnCours] = useState(false);

  const { data: grille } = useQuery({
    queryKey: ['tarifs'],
    queryFn: lireGrilleTarifaire,
    staleTime: 5 * 60_000,
  });

  // Ce que son parrainage lui a rapporté et qu'elle n'a pas encore utilisé.
  const { data: filleules = [] } = useQuery({
    queryKey: ['filleules', cliente.id],
    queryFn: () => filleulesDe(cliente.id),
  });

  const { data: offertesUtilisees = 0 } = useQuery({
    queryKey: ['seances-offertes-utilisees', cliente.id],
    queryFn: () => seancesOffertesUtilisees(cliente.id),
  });

  const solde = calculerSolde(filleules, offertesUtilisees);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !enCours && onFerme();
    document.addEventListener('keydown', echap);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', echap);
      document.body.style.overflow = '';
    };
  }, [onFerme, enCours]);

  async function valider() {
    if (!prescription) return;
    setEnCours(true);
    try {
      await creerProgramme({
        clienteId: cliente.id,
        bilanId: null,
        centreId,
        lignes: prescription.lignes,
        electro: prescription.electro,
        guide: prescription.guide,
        tenue: prescription.tenue,
        prixGuide: grille?.guide ?? 0,
        prixTenue: grille?.tenue ?? 0,
        montantTotal: prescription.montantTotal,
        modeReglement: prescription.modeReglement,
        fraisFinancement: prescription.frais,
        echeances: prescription.echeances,
        complementRecommande: null,
        offertes: prescription.offertes,
      });
      toast.success(`Cure ${numero} enregistrée`);
      onCreee();
    } catch (e) {
      console.error(e);
      toast.error("La cure n'a pas pu être enregistrée. Réessayez.");
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Nouvelle cure pour ${cliente.prenom} ${cliente.nom}`}
        className="my-4 w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-carte"
      >
        <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ardoise-900">
              Cure {numero} — {cliente.prenom} {cliente.nom}
            </h2>
            <p className="text-xs text-ardoise-500">
              Échéancier et décompte de séances séparés de la cure précédente.
            </p>
          </div>
          <button
            onClick={onFerme}
            disabled={enCours}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {!grille ? (
            <p className="py-10 text-center text-sm text-ardoise-400">Chargement des tarifs…</p>
          ) : (
            <CompositionCure
              grille={grille}
              seancesOffertes={solde.disponibles}
              optionsModifiables
              onChange={(p, n) => {
                setPrescription(p);
                setTotalSeances(n);
              }}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-ardoise-200 px-5 py-4">
          <p className="text-xs text-ardoise-500">
            {totalSeances === 0
              ? 'Ajoutez au moins une séance.'
              : `${totalSeances} séance${totalSeances > 1 ? 's' : ''} au programme.`}
          </p>
          <div className="flex gap-3">
            <button onClick={onFerme} disabled={enCours} className="bouton-discret">
              Annuler
            </button>
            <button
              onClick={valider}
              disabled={enCours || totalSeances === 0 || !prescription}
              className="bouton-fort"
            >
              {enCours ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Valider la cure {numero}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
