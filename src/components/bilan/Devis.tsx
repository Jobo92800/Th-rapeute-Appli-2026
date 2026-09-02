import { useState } from 'react';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';
import CompositionCure, { type Prescription } from '../cure/CompositionCure';
import { formaterEuros, type GrilleTarifaire } from '../../domain/tarification';

export type { Prescription };

interface Contact {
  civilite: 'Mme' | 'M.';
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  code_postal: string;
  ville: string;
  age: string;
}

interface Props {
  grille: GrilleTarifaire;
  prenom: string;
  priorite: string;
  complement: { nom: string; raison: string } | null;
  profil: string;
  terrain: string;
  contact: Contact;
  onContact: (c: Contact) => void;
  enregistrement: boolean;
  onRetour: () => void;
  onBilanSeul: () => void;
  onValider: (p: Prescription) => void;
}

export default function Devis({
  grille,
  prenom,
  priorite,
  complement,
  profil,
  terrain,
  contact,
  onContact,
  enregistrement,
  onRetour,
  onBilanSeul,
  onValider,
}: Props) {
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [totalSeances, setTotalSeances] = useState(0);

  const contactComplet = contact.prenom.trim() !== '' && contact.nom.trim() !== '';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="carte px-6 py-7 sm:px-8">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Son accompagnement
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ardoise-900">
          Le parcours pensé pour {prenom}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2.5 text-sm font-semibold">
          <span className="text-marine-700">{profil}</span>
          <span className="text-ardoise-300">×</span>
          <span className="text-rose-600">{terrain}</span>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ardoise-600">{priorite}</p>
      </header>

      <CompositionCure
        grille={grille}
        complement={complement}
        onChange={(p, n) => {
          setPrescription(p);
          setTotalSeances(n);
        }}
      />

      {!contactComplet && (
        <section className="carte border-amber-300 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Coordonnées manquantes</h2>
          <p className="mt-1 text-xs text-amber-800">
            Le nom et le prénom sont nécessaires pour créer la fiche de la cliente.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="d_nom" className="etiquette">
                Nom
              </label>
              <input
                id="d_nom"
                value={contact.nom}
                onChange={(e) => onContact({ ...contact, nom: e.target.value })}
                className="champ"
              />
            </div>
            <div>
              <label htmlFor="d_prenom" className="etiquette">
                Prénom
              </label>
              <input
                id="d_prenom"
                value={contact.prenom}
                onChange={(e) => onContact({ ...contact, prenom: e.target.value })}
                className="champ"
              />
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onRetour} className="bouton-discret" disabled={enregistrement}>
          <ChevronLeft className="h-4 w-4" />
          Revenir à l'Empreinte
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBilanSeul}
            disabled={enregistrement || !contactComplet}
            className="bouton-discret"
          >
            Bilan seul — {formaterEuros(grille.bilan)}
          </button>
          <button
            onClick={() => prescription && onValider(prescription)}
            disabled={enregistrement || !contactComplet || totalSeances === 0 || !prescription}
            className="bouton-fort"
          >
            {enregistrement ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Valider la cure
          </button>
        </div>
      </div>

      <p className="pb-4 text-center text-xs text-ardoise-400">
        Proposition établie ce jour, valable 15 jours.
      </p>
    </div>
  );
}
