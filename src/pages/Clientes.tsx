import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, UserPlus, X, Sparkles, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCentre } from '../lib/session';
import { listerClientes, listerTherapeutes } from '../services/clientes';
import { situationsDuCentre } from '../services/metier';
import { etatCliente, type SituationReglement } from '../domain/reglement';
import { formaterEuros } from '../domain/tarification';

type Tri = 'recent' | 'ancien' | 'az' | 'za';

const TRIS: { valeur: Tri; libelle: string }[] = [
  { valeur: 'recent', libelle: 'Plus récentes' },
  { valeur: 'ancien', libelle: 'Plus anciennes' },
  { valeur: 'az', libelle: 'Nom A → Z' },
  { valeur: 'za', libelle: 'Nom Z → A' },
];

export default function Clientes() {
  const centre = useCentre();
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<Tri>('recent');
  const [therapeute, setTherapeute] = useState('');
  const [retardsSeuls, setRetardsSeuls] = useState(false);

  const { data: clientes = [], isLoading, error } = useQuery({
    queryKey: ['clientes', centre.id],
    queryFn: () => listerClientes(centre.id),
  });

  const { data: therapeutes = [] } = useQuery({
    queryKey: ['therapeutes', centre.id],
    queryFn: () => listerTherapeutes(centre.id),
  });

  const { data: situations = [] } = useQuery({
    queryKey: ['situations', centre.id],
    queryFn: () => situationsDuCentre(centre.id),
  });

  const parCliente = useMemo(
    () => new Map(situations.map((s) => [s.cliente_id, s])),
    [situations],
  );

  const nbEnRetard = useMemo(
    () => situations.filter((s) => s.nb_en_retard > 0).length,
    [situations],
  );

  const filtrees = useMemo(() => {
    let liste = [...clientes];

    if (retardsSeuls) {
      liste = liste.filter((c) => (parCliente.get(c.id!)?.nb_en_retard ?? 0) > 0);
    }

    if (therapeute) {
      liste = liste.filter((c) => c.therapeutes.includes(therapeute));
    }

    const q = recherche.trim().toLowerCase();
    if (q) {
      liste = liste.filter((c) =>
        [c.prenom, c.nom, c.email, c.telephone]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      );
    }

    const nomComplet = (c: (typeof liste)[number]) => `${c.nom} ${c.prenom}`.toLowerCase();
    const parDate = (a: (typeof liste)[number], b: (typeof liste)[number]) =>
      new Date(a.cree_le).getTime() - new Date(b.cree_le).getTime();

    if (tri === 'recent') liste.sort((a, b) => parDate(b, a));
    else if (tri === 'ancien') liste.sort(parDate);
    else if (tri === 'az') liste.sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr'));
    else liste.sort((a, b) => nomComplet(b).localeCompare(nomComplet(a), 'fr'));

    return liste;
  }, [clientes, recherche, tri, therapeute, retardsSeuls, parCliente]);

  const filtreActif = Boolean(recherche.trim() || therapeute || retardsSeuls);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ardoise-900">Clientes</h1>
          <p className="mt-0.5 text-sm text-ardoise-500">
            {isLoading
              ? 'Chargement…'
              : `${filtrees.length} fiche${filtrees.length > 1 ? 's' : ''}${
                  filtreActif ? ` sur ${clientes.length}` : ''
                } — ${centre.nom}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/clientes/nouvelle" className="bouton-discret">
            <UserPlus className="h-4 w-4" />
            Fiche seule
          </Link>
          <Link to="/bilan" className="bouton-fort">
            <Sparkles className="h-4 w-4" />
            Nouveau bilan
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ardoise-400" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, prénom, téléphone, email…"
            className="champ pl-9"
            aria-label="Rechercher une cliente"
          />
        </div>

        <select
          value={therapeute}
          onChange={(e) => setTherapeute(e.target.value)}
          className="champ w-auto"
          aria-label="Filtrer par thérapeute"
        >
          <option value="">Toutes les thérapeutes</option>
          {therapeutes.map((t) => (
            <option key={t.id} value={t.prenom}>
              {t.prenom}
            </option>
          ))}
        </select>

        <select
          value={tri}
          onChange={(e) => setTri(e.target.value as Tri)}
          className="champ w-auto"
          aria-label="Trier"
        >
          {TRIS.map((t) => (
            <option key={t.valeur} value={t.valeur}>
              {t.libelle}
            </option>
          ))}
        </select>

        {nbEnRetard > 0 && (
          <button
            type="button"
            onClick={() => setRetardsSeuls((v) => !v)}
            aria-pressed={retardsSeuls}
            className={`bouton ${
              retardsSeuls
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            {nbEnRetard} en retard
          </button>
        )}

        {filtreActif && (
          <button
            type="button"
            onClick={() => {
              setRecherche('');
              setTherapeute('');
              setRetardsSeuls(false);
            }}
            className="bouton-discret"
          >
            <X className="h-4 w-4" />
            Effacer
          </button>
        )}
      </div>

      {error ? (
        <p className="carte px-5 py-8 text-center text-sm text-rose-700">
          Les fiches n'ont pas pu être chargées. Vérifiez votre connexion et réessayez.
        </p>
      ) : isLoading ? (
        <p className="carte px-5 py-10 text-center text-sm text-ardoise-400">Chargement…</p>
      ) : filtrees.length === 0 ? (
        <div className="carte px-5 py-12 text-center">
          <p className="text-sm text-ardoise-500">
            {filtreActif
              ? 'Aucune fiche ne correspond à cette recherche.'
              : "Aucune cliente dans ce centre pour l'instant."}
          </p>
        </div>
      ) : (
        <div className="carte overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ardoise-200 bg-ardoise-50 text-left">
                <Entete>Cliente</Entete>
                <Entete>Contact</Entete>
                <Entete>Thérapeute</Entete>
                <Entete>Règlement</Entete>
                <Entete>Créée le</Entete>
              </tr>
            </thead>
            <tbody className="divide-y divide-ardoise-100">
              {filtrees.map((c) => (
                <tr key={c.id} className="hover:bg-ardoise-50">
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/clientes/${c.id}`}
                      className="font-semibold text-ardoise-900 hover:text-marine-700"
                    >
                      {c.prenom} {c.nom}
                    </Link>
                    {c.ville && <div className="text-xs text-ardoise-400">{c.ville}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-ardoise-600">
                    <div>{c.telephone ?? '—'}</div>
                    {c.email && <div className="text-xs text-ardoise-400">{c.email}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-ardoise-600">
                    {c.therapeutes.length > 0 ? c.therapeutes.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <CelluleReglement situation={parCliente.get(c.id!)} />
                  </td>
                  <td className="px-4 py-2.5 text-ardoise-500">
                    {format(new Date(c.cree_le), 'd MMM yyyy', { locale: fr })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CelluleReglement({ situation }: { situation: SituationReglement | undefined }) {
  const etat = etatCliente(situation);

  if (etat.etat === 'aucun') {
    return <span className="text-xs text-ardoise-300">—</span>;
  }

  return (
    <span className="flex flex-col gap-0.5">
      <span
        className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-2xs font-semibold ${etat.classe}`}
      >
        {etat.libelle}
      </span>
      {etat.etat === 'retard' && situation && (
        <span className="chiffres text-2xs font-semibold text-rose-700">
          {formaterEuros(Number(situation.montant_en_retard), 2)}
        </span>
      )}
      {etat.etat === 'en_cours' && situation?.prochaine_echeance && (
        <span className="text-2xs text-ardoise-400">
          prochaine le {format(new Date(situation.prochaine_echeance), 'd MMM', { locale: fr })}
        </span>
      )}
    </span>
  );
}

function Entete({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-widest text-ardoise-500">
      {children}
    </th>
  );
}
