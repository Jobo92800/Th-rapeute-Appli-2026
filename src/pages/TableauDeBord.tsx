import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { endOfMonth, format, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSession } from '../lib/session';
import { lireTableauDeBord } from '../services/tableauDeBord';
import { lireBaremeActif } from '../services/metier';

import type { Axe } from '../domain/empreinte';
import ContenuTableauDeBord from '../components/tableau/Contenu';

type Periode = 'jour' | 'semaine' | 'mois' | 'mois_dernier' | 'annee';

const PERIODES: { id: Periode; libelle: string }[] = [
  { id: 'jour', libelle: "Aujourd'hui" },
  { id: 'semaine', libelle: '7 derniers jours' },
  { id: 'mois', libelle: 'Ce mois' },
  { id: 'mois_dernier', libelle: 'Mois dernier' },
  { id: 'annee', libelle: 'Cette année' },
];

/** Les bornes de la période choisie, en dates ISO. */
function bornes(p: Periode): { du: string; au: string } {
  const jour = (d: Date) => format(d, 'yyyy-MM-dd');
  const aujourdhui = new Date();

  switch (p) {
    case 'jour':
      return { du: jour(aujourdhui), au: jour(aujourdhui) };
    case 'semaine':
      return { du: jour(subDays(aujourdhui, 6)), au: jour(aujourdhui) };
    case 'mois':
      return { du: jour(startOfMonth(aujourdhui)), au: jour(aujourdhui) };
    case 'mois_dernier': {
      const m = subMonths(aujourdhui, 1);
      return { du: jour(startOfMonth(m)), au: jour(endOfMonth(m)) };
    }
    case 'annee':
      return { du: jour(startOfYear(aujourdhui)), au: jour(aujourdhui) };
  }
}

export default function TableauDeBord() {
  const { centresAccessibles, role } = useSession();
  const [periode, setPeriode] = useState<Periode>('mois');
  const [centreId, setCentreId] = useState<string | null>(null);

  const { du, au } = useMemo(() => bornes(periode), [periode]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tableau-de-bord', centreId, du, au],
    queryFn: () => lireTableauDeBord(centreId, du, au),
    enabled: role === 'direction',
  });

  const { data: bareme } = useQuery({
    queryKey: ['bareme'],
    queryFn: lireBaremeActif,
    staleTime: 10 * 60_000,
  });

  const nomAxe = (code: string) =>
    bareme?.bareme.AX?.[code as Axe]?.name ?? code;

  if (role !== 'direction') {
    return (
      <div className="carte px-5 py-12 text-center">
        <h1 className="text-lg font-semibold text-ardoise-900">Tableau de bord</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ardoise-500">
          Les chiffres sont réservés à la direction. Votre compte donne accès aux fiches, aux
          cures et au stock de votre centre.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ardoise-900">Tableau de bord</h1>
          <p className="mt-0.5 text-sm text-ardoise-500">
            {centreId
              ? centresAccessibles.find((c) => c.id === centreId)?.nom
              : 'Les cinq centres'}{' '}
            · du {format(new Date(du), 'd MMM', { locale: fr })} au{' '}
            {format(new Date(au), 'd MMM yyyy', { locale: fr })}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          className="champ w-auto"
          value={centreId ?? ''}
          onChange={(e) => setCentreId(e.target.value || null)}
          aria-label="Centre"
        >
          <option value="">Tous les centres</option>
          {centresAccessibles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-1.5">
          {PERIODES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriode(p.id)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                periode === p.id
                  ? 'border-marine-600 bg-marine-600 text-white'
                  : 'border-ardoise-300 bg-white text-ardoise-700 hover:border-marine-400'
              }`}
            >
              {p.libelle}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="carte flex items-start gap-3 border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            {/does not exist|schema cache/i.test(String(error))
              ? 'Le tableau de bord n’existe pas encore dans la base. Passez la migration 021 dans l’éditeur SQL de Supabase, puis rechargez cette page.'
              : `Les chiffres n’ont pas pu être lus : ${String(error)}`}
          </p>
        </div>
      ) : isLoading || !data ? (
        <p className="py-10 text-center text-sm text-ardoise-400">Calcul des chiffres…</p>
      ) : (
        <ContenuTableauDeBord data={data} nomAxe={nomAxe} tousCentres={!centreId} />
      )}
    </div>
  );
}
