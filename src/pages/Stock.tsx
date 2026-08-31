import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, History, Package } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCentre, useSession } from '../lib/session';
import { etatDuCentre, mouvementsDuCentre } from '../services/stock';
import { LIBELLES_MOTIF, niveauStock } from '../domain/stock';
import CarteProduit from '../components/stock/CarteProduit';
import ModaleMouvement from '../components/stock/ModaleMouvement';
import type { CategorieProduit, EtatStock } from '../types/db';

const SECTIONS: { categorie: CategorieProduit; titre: string }[] = [
  { categorie: 'complement', titre: 'Compléments alimentaires' },
  { categorie: 'guide', titre: 'Guide alimentaire' },
  { categorie: 'tenue', titre: 'Tenues I-Shape' },
  { categorie: 'cosmetique', titre: 'Cosmétiques' },
  { categorie: 'autre', titre: 'Divers' },
];

/** La table manque tant que la migration n'a pas été passée : le dire. */
function messageErreur(e: unknown): string {
  const texte = e instanceof Error ? e.message : String(e);
  if (/does not exist|schema cache/i.test(texte)) {
    return 'Le stock n’existe pas encore dans la base. Passez la migration 015 dans l’éditeur SQL de Supabase (projet MAbeautyplus V2), puis rechargez cette page.';
  }
  return `Le stock n’a pas pu être lu : ${texte}`;
}

export default function Stock() {
  const centre = useCentre();
  const { therapeute } = useSession();
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState<EtatStock | null>(null);

  const { data: rayon = [], isLoading, error } = useQuery({
    queryKey: ['stock', centre.id],
    queryFn: () => etatDuCentre(centre.id),
  });

  const { data: journal = [] } = useQuery({
    queryKey: ['mouvements', centre.id],
    queryFn: () => mouvementsDuCentre(centre.id, 20),
  });

  const alertes = useMemo(
    () => rayon.filter((l) => niveauStock(l.quantite, l.seuil_bas, l.seuil_critique) !== 'ok'),
    [rayon],
  );

  function rafraichir() {
    qc.invalidateQueries({ queryKey: ['stock', centre.id] });
    qc.invalidateQueries({ queryKey: ['mouvements', centre.id] });
    qc.invalidateQueries({ queryKey: ['mouvements-produit', centre.id] });
  }

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ardoise-900">Stock</h1>
        <p className="mt-0.5 text-sm text-ardoise-500">
          {centre.nom} — {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
      </header>

      {error ? (
        <div className="carte flex items-start gap-3 border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">{messageErreur(error)}</p>
        </div>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm text-ardoise-400">Chargement du rayon…</p>
      ) : (
        <>
          {alertes.length > 0 && (
            <div className="carte border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-900">
                  {alertes.length} produit{alertes.length > 1 ? 's' : ''} à recommander
                </h2>
              </div>
              <p className="mt-1.5 text-sm text-amber-900">
                {alertes
                  .map((l) => `${l.nom} (${l.quantite})`)
                  .join(', ')}
              </p>
            </div>
          )}

          {SECTIONS.map(({ categorie, titre }) => {
            const lignes = rayon.filter((l) => l.categorie === categorie);
            if (lignes.length === 0) return null;

            return (
              <section key={categorie}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ardoise-900">
                  <Package className="h-4 w-4 text-ardoise-400" />
                  {titre}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {lignes.map((l) => (
                    <CarteProduit key={l.produit_id} ligne={l} onOuvrir={() => setOuvert(l)} />
                  ))}
                </div>
              </section>
            );
          })}

          <section className="carte">
            <div className="flex items-center gap-2 border-b border-ardoise-200 px-5 py-3.5">
              <History className="h-4 w-4 text-ardoise-400" />
              <h2 className="text-sm font-semibold text-ardoise-900">Derniers mouvements</h2>
            </div>

            {journal.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ardoise-500">
                Aucun mouvement pour l’instant. Commencez par saisir ce que vous avez en rayon :
                ouvrez un produit, puis « J’ai reçu ».
              </p>
            ) : (
              <ul className="divide-y divide-ardoise-100">
                {journal.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ardoise-900">
                        {m.produit?.nom ?? 'Produit retiré du catalogue'}
                      </span>
                      <span className="block text-xs text-ardoise-500">
                        {format(new Date(m.fait_le), 'd MMM yyyy', { locale: fr })} —{' '}
                        {LIBELLES_MOTIF[m.motif] ?? m.motif}
                        {m.note ? ` · ${m.note}` : ''}
                      </span>
                    </span>
                    <span
                      className={`chiffres shrink-0 text-sm font-semibold ${
                        m.sens === 'entree' ? 'text-emerald-700' : 'text-ardoise-800'
                      }`}
                    >
                      {m.sens === 'entree' ? '+' : '−'}
                      {m.quantite}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {ouvert && (
        <ModaleMouvement
          ligne={ouvert}
          auteur={therapeute?.prenom ?? ''}
          onFerme={() => setOuvert(null)}
          onEnregistre={rafraichir}
        />
      )}
    </div>
  );
}
