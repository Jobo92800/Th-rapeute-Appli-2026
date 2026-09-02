import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download } from 'lucide-react';
import { endOfMonth, format, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/session';
import { lireTableauDeBord } from '../services/tableauDeBord';
import { supabase } from '../lib/supabase';
import { lireBaremeActif } from '../services/metier';

import type { Axe } from '../domain/bioportrait';
import ContenuTableauDeBord from '../components/tableau/Contenu';

type Periode = 'jour' | 'semaine' | 'mois' | 'mois_dernier' | 'annee' | 'tout' | 'perso';

const PERIODES: { id: Periode; libelle: string }[] = [
  { id: 'jour', libelle: "Aujourd'hui" },
  { id: 'semaine', libelle: '7 derniers jours' },
  { id: 'mois', libelle: 'Ce mois' },
  { id: 'mois_dernier', libelle: 'Mois dernier' },
  { id: 'annee', libelle: 'Cette année' },
  { id: 'tout', libelle: 'Tout' },
];

/* Avant cette date, il n'existe rien : ni cure reprise, ni cure de la V2. */
const ORIGINE_DES_TEMPS = '2015-01-01';

/** Les bornes de la période choisie, en dates ISO. */
function bornes(p: Periode, perso: { du: string; au: string }): { du: string; au: string } {
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
    case 'tout':
      return { du: ORIGINE_DES_TEMPS, au: jour(aujourdhui) };
    case 'perso':
      return perso;
  }
}

export default function TableauDeBord() {
  const { centresAccessibles, role } = useSession();
  const [periode, setPeriode] = useState<Periode>('mois');
  const aujourdhuiIso = format(new Date(), 'yyyy-MM-dd');
  const [perso, setPerso] = useState({ du: aujourdhuiIso, au: aujourdhuiIso });
  const [centreId, setCentreId] = useState<string | null>(null);
  const [therapeuteId, setTherapeuteId] = useState<string | null>(null);

  const { du, au } = useMemo(() => bornes(periode, perso), [periode, perso]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tableau-de-bord', centreId, du, au, therapeuteId],
    queryFn: () => lireTableauDeBord(centreId, du, au, therapeuteId),
    enabled: role === 'direction',
  });

  // Toutes les thérapeutes des centres accessibles, pour le filtre.
  const { data: therapeutes = [] } = useQuery({
    queryKey: ['therapeutes-toutes'],
    queryFn: async () => {
      const { data: liste } = await supabase
        .from('therapeutes')
        .select('id, prenom, centre_id')
        .eq('actif', true)
        .order('prenom');
      return (liste ?? []) as Array<{ id: string; prenom: string; centre_id: string }>;
    },
    staleTime: 10 * 60_000,
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
              : 'Les cinq centres'}
            {therapeuteId && ` · ${therapeutes.find((t) => t.id === therapeuteId)?.prenom ?? ''}`}{' '}
            ·{' '}
            {periode === 'tout'
              ? 'depuis le début'
              : `du ${format(new Date(du), 'd MMM', { locale: fr })} au ${format(new Date(au), 'd MMM yyyy', { locale: fr })}`}
          </p>
        </div>

        <Link to="/reprise-crm" className="bouton-discret">
          <Download className="h-4 w-4" />
          Reprendre les fiches du CRM
        </Link>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          className="champ w-auto"
          value={centreId ?? ''}
          onChange={(e) => {
            setCentreId(e.target.value || null);
            setTherapeuteId(null);
          }}
          aria-label="Centre"
        >
          <option value="">Tous les centres</option>
          {centresAccessibles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>

        <select
          className="champ w-auto"
          value={therapeuteId ?? ''}
          onChange={(e) => setTherapeuteId(e.target.value || null)}
          aria-label="Thérapeute"
        >
          <option value="">Toutes les thérapeutes</option>
          {therapeutes
            .filter((t) => !centreId || t.centre_id === centreId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.prenom}
              </option>
            ))}
        </select>

        <div className="flex flex-wrap items-center gap-1.5">
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

          {/* La plage libre, comme sur l'ancien tableau de bord. */}
          <span className="flex items-center gap-1.5">
            <input
              type="date"
              className="champ w-auto"
              value={perso.du}
              max={perso.au}
              onChange={(e) => {
                setPerso((v) => ({ ...v, du: e.target.value }));
                setPeriode('perso');
              }}
              aria-label="Début de la période"
            />
            <span className="text-ardoise-400">→</span>
            <input
              type="date"
              className="champ w-auto"
              value={perso.au}
              min={perso.du}
              onChange={(e) => {
                setPerso((v) => ({ ...v, au: e.target.value }));
                setPeriode('perso');
              }}
              aria-label="Fin de la période"
            />
          </span>
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
