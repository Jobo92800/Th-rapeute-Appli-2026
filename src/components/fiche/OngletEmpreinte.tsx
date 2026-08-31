import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { bilansDeLaCliente, lireBaremeActif } from '../../services/metier';
import { SEUIL_PRESENCE, type Axe, AXES_PROFIL, AXES_TERRAIN } from '../../domain/empreinte';

export default function OngletEmpreinte({ clienteId }: { clienteId: string }) {
  const { data: bilans = [], isLoading } = useQuery({
    queryKey: ['bilans', clienteId],
    queryFn: () => bilansDeLaCliente(clienteId),
  });

  const { data: baremeData } = useQuery({
    queryKey: ['bareme'],
    queryFn: lireBaremeActif,
    staleTime: Infinity,
  });

  if (isLoading) {
    return <p className="carte px-5 py-10 text-center text-sm text-ardoise-400">Chargement…</p>;
  }

  const bilan = bilans.find((b) => b.statut === 'termine') ?? null;

  if (!bilan || !baremeData) {
    return (
      <div className="carte px-5 py-12 text-center">
        <p className="text-sm text-ardoise-600">Aucun bilan pour cette cliente.</p>
        <Link to="/bilan" className="bouton-fort mt-5">
          <Sparkles className="h-4 w-4" />
          Démarrer un Bilan Empreinte
        </Link>
      </div>
    );
  }

  const { bareme } = baremeData;
  const pct = (bilan.scores ?? {}) as Record<Axe, number>;
  const dp = bilan.profil_dominant as Axe | null;
  const dt = bilan.terrain_dominant as Axe | null;
  const mesures = ((bilan.inbody as { mesures?: { libelle: string; valeur: string }[] })?.mesures) ?? [];

  return (
    <div className="space-y-5">
      <section className="carte px-6 py-7 text-center">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Bilan du {format(new Date(bilan.date_bilan), 'd MMMM yyyy', { locale: fr })}
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xl font-bold">
          <span className="text-marine-700">{dp ? bareme.AX[dp].name : '—'}</span>
          <span className="text-ardoise-300">×</span>
          <span className="text-rose-600">{dt ? bareme.AX[dt].name : '—'}</span>
        </p>
        <p className="mt-2 text-xs text-ardoise-500">
          {bilan.facturation === 'offert'
            ? 'Bilan offert — la cliente a démarré son accompagnement'
            : bilan.facturation === 'facture'
              ? `Bilan facturé ${Number(bilan.montant_facture ?? 0).toLocaleString('fr-FR')} €`
              : 'Facturation à trancher'}
        </p>
      </section>

      {mesures.length > 0 && (
        <section className="carte p-5">
          <h2 className="mb-3 text-sm font-semibold text-ardoise-900">Analyse InBody</h2>
          <div className="flex flex-wrap gap-2">
            {mesures.map((m) => (
              <span
                key={m.libelle}
                className="rounded-lg border border-ardoise-200 bg-ardoise-50 px-3 py-1.5 text-xs text-ardoise-700"
              >
                <span className="font-semibold text-ardoise-900">{m.libelle}</span> · {m.valeur}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Colonne titre="Profil comportemental" axes={[...AXES_PROFIL]} pct={pct} dominant={dp} bareme={bareme} accent="bg-marine-600" />
        <Colonne titre="Terrain physiologique" axes={[...AXES_TERRAIN]} pct={pct} dominant={dt} bareme={bareme} accent="bg-rose-600" />
      </div>

      {bilan.texte_libre && (
        <section className="carte p-5">
          <h2 className="mb-2 text-sm font-semibold text-ardoise-900">
            Ce qu'elle voulait transformer en priorité
          </h2>
          <p className="text-sm italic text-ardoise-700">« {bilan.texte_libre} »</p>
        </section>
      )}
    </div>
  );
}

function Colonne({
  titre,
  axes,
  pct,
  dominant,
  bareme,
  accent,
}: {
  titre: string;
  axes: Axe[];
  pct: Record<Axe, number>;
  dominant: Axe | null;
  bareme: { AX: Record<Axe, { name: string; note: string }> };
  accent: string;
}) {
  const tries = [...axes].sort((a, b) => (pct[b] ?? 0) - (pct[a] ?? 0));

  return (
    <section className="carte p-5">
      <h2 className="mb-4 text-sm font-semibold text-ardoise-900">{titre}</h2>
      <div className="space-y-3">
        {tries.map((a) => {
          const p = pct[a] ?? 0;
          const est = a === dominant;
          const present = p >= SEUIL_PRESENCE;
          return (
            <div key={a}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span
                  className={`text-sm ${est ? 'font-bold text-ardoise-900' : present ? 'font-medium text-ardoise-700' : 'text-ardoise-400'}`}
                >
                  {bareme.AX[a].name}
                </span>
                <span
                  className={`chiffres text-sm ${est ? 'font-bold text-ardoise-900' : 'text-ardoise-500'}`}
                >
                  {p}%
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-ardoise-200">
                <div
                  className={`h-full rounded-full ${est ? accent : present ? 'bg-ardoise-400' : 'bg-ardoise-300'}`}
                  style={{ width: `${p}%` }}
                />
                <span
                  className="absolute top-0 h-full w-px bg-ardoise-400/70"
                  style={{ left: `${SEUIL_PRESENCE}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
