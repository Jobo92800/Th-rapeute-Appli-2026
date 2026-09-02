import { Building2 } from 'lucide-react';

/**
 * Certains gestes n'existent pas « sur les cinq centres » : une fiche
 * appartient à un centre, un inventaire se compte dans un rayon. Plutôt que
 * de laisser l'application en choisir un à la place de la personne — et
 * créer la fiche au mauvais endroit —, on le dit.
 */
export default function ChoisirUnCentre({ quoi }: { quoi: string }) {
  return (
    <div className="carte px-5 py-12 text-center">
      <Building2 className="mx-auto h-8 w-8 text-ardoise-300" />
      <h1 className="mt-3 text-lg font-semibold text-ardoise-900">Choisissez un centre</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ardoise-500">
        {quoi} Vous regardez actuellement les cinq centres à la fois : sélectionnez celui qui vous
        intéresse en bas à gauche, sous « Centre ».
      </p>
    </div>
  );
}
