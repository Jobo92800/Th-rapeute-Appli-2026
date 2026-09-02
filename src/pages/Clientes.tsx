import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, UserPlus, X, Sparkles, AlertTriangle, MessageSquare, Pin, Archive, Undo2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCentre, usePerimetre, useSession } from '../lib/session';
import {
  archiverCliente,
  listerClientes,
  listerArchivees,
  listerTherapeutes,
  restaurerCliente,
} from '../services/clientes';
import { resumeNotesDuCentre, situationsDuCentre } from '../services/metier';
import { creditsDuCentre } from '../services/parrainage';
import PastilleCredits from '../components/PastilleCredits';
import { soldeDepuisCompteurs } from '../domain/parrainage';
import { etatCliente, type SituationReglement } from '../domain/reglement';
import ModaleNotes from '../components/ModaleNotes';
import ModaleSuppression from '../components/fiche/ModaleSuppression';
import type { Cliente } from '../types/db';
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
  const perimetre = usePerimetre();
  const { role, tousCentres, centresAccessibles } = useSession();
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<Tri>('recent');
  const [therapeute, setTherapeute] = useState('');
  const [retardsSeuls, setRetardsSeuls] = useState(false);
  const [notesOuvertes, setNotesOuvertes] = useState<Cliente | null>(null);
  const [archives, setArchives] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Cliente | null>(null);
  const perimetreLibelle = tousCentres ? 'Les cinq centres' : centre.nom;
  const qc = useQueryClient();

  const { data: clientes = [], isLoading, error } = useQuery({
    queryKey: archives ? ['clientes-archivees', perimetre] : ['clientes', perimetre],
    queryFn: () => (archives ? listerArchivees(perimetre) : listerClientes(perimetre)),
  });

  async function archiver(c: Cliente) {
    /*
      Archiver sort la fiche du suivi — y compris de « Reste à encaisser ».
      Si elle doit encore de l'argent, il faut le dire maintenant : après,
      plus personne ne verra cette somme, ni ne la réclamera.
    */
    const situation = parCliente.get(c.id!);
    const du = Number(situation?.montant_restant ?? 0);
    const alerte =
      du > 0
        ? `\n\nAttention : il reste ${formaterEuros(du)} à encaisser sur sa cure. Une fois archivée, cette somme ne sera plus comptée nulle part et personne ne la relancera.`
        : '';

    if (
      !confirm(
        `Archiver la fiche de ${c.prenom} ${c.nom} ?\n\nElle sort des listes, rien n'est perdu, et elle se restaure.${alerte}`,
      )
    )
      return;
    try {
      await archiverCliente(c.id);
      qc.invalidateQueries({ queryKey: ['clientes', perimetre] });
      qc.invalidateQueries({ queryKey: ['clientes-archivees', perimetre] });
      toast.success(`${c.prenom} ${c.nom} archivée`);
    } catch {
      toast.error("La fiche n'a pas pu être archivée.");
    }
  }

  async function restaurer(c: Cliente) {
    try {
      await restaurerCliente(c.id);
      qc.invalidateQueries({ queryKey: ['clientes-archivees', perimetre] });
      qc.invalidateQueries({ queryKey: ['clientes', perimetre] });
      toast.success(`${c.prenom} ${c.nom} restaurée`);
    } catch {
      toast.error('La fiche n\'a pas pu être restaurée.');
    }
  }

  const { data: therapeutes = [] } = useQuery({
    queryKey: ['therapeutes', centre.id],
    queryFn: () => listerTherapeutes(centre.id),
  });

  const { data: situations = [], error: erreurSituations } = useQuery({
    queryKey: ['situations', perimetre],
    queryFn: () => situationsDuCentre(perimetre),
    retry: false,
  });

  // Les crédits de parrainage du centre, en un seul appel : une filleule
  // peut être suivie ailleurs, la liste ne saurait pas les compter.
  const { data: credits = [] } = useQuery({
    queryKey: ['credits-parrainage', perimetre],
    queryFn: () => creditsDuCentre(perimetre),
  });

  const creditsParCliente = useMemo(
    () =>
      new Map(
        credits.map((c) => [
          c.cliente_id,
          soldeDepuisCompteurs(c.filleules_engagees, c.seances_utilisees).disponibles,
        ]),
      ),
    [credits],
  );

  const { data: resumeNotes = [] } = useQuery({
    queryKey: ['resume-notes', perimetre],
    queryFn: () => resumeNotesDuCentre(perimetre),
    retry: false,
  });

  const notesParCliente = useMemo(
    () => new Map(resumeNotes.map((r) => [r.cliente_id, r])),
    [resumeNotes],
  );

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
                } — ${perimetreLibelle}`}
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

        <button
          type="button"
          onClick={() => {
            setArchives((v) => !v);
            setRetardsSeuls(false);
          }}
          aria-pressed={archives}
          className={`bouton ${
            archives
              ? 'bg-ardoise-700 text-white hover:bg-ardoise-800'
              : 'border border-ardoise-300 bg-white text-ardoise-600 hover:bg-ardoise-50'
          }`}
        >
          <Archive className="h-4 w-4" />
          Archivées
        </button>

        {!archives && nbEnRetard > 0 && (
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

      {erreurSituations && (
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Les règlements ne peuvent pas être affichés.</p>
            <p className="mt-1">
              La vue <code className="rounded bg-amber-100 px-1">situation_reglement</code> est
              absente de la base : exécutez la migration{' '}
              <code className="rounded bg-amber-100 px-1">006_echeances_datees.sql</code> dans
              l'éditeur SQL de Supabase, puis rechargez cette page. La colonne Règlement reste
              vide en attendant.
            </p>
          </div>
        </div>
      )}

      {error ? (
        <p className="carte px-5 py-8 text-center text-sm text-rose-700">
          Les fiches n'ont pas pu être chargées. Vérifiez votre connexion et réessayez.
        </p>
      ) : isLoading ? (
        <p className="carte px-5 py-10 text-center text-sm text-ardoise-400">Chargement…</p>
      ) : filtrees.length === 0 ? (
        <div className="carte px-5 py-12 text-center">
          <p className="text-sm text-ardoise-500">
            {archives
              ? 'Aucune fiche archivée dans ce centre.'
              : filtreActif
                ? 'Aucune fiche ne correspond à cette recherche.'
                : "Aucune cliente dans ce centre pour l'instant."}
          </p>
        </div>
      ) : (
        <div className="carte overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ardoise-200 bg-ardoise-50 text-left">
                <th className="border-l-4 border-transparent px-4 py-2.5 text-2xs font-semibold uppercase tracking-widest text-ardoise-500">
                  Cliente
                </th>
                {tousCentres && <Entete>Centre</Entete>}
                <Entete>Contact</Entete>
                <Entete>Thérapeute</Entete>
                <Entete>Règlement</Entete>
                <Entete>Notes</Entete>
                <Entete>{archives ? 'Archivée' : 'Créée le'}</Entete>
                <th className="w-20 px-4 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ardoise-100">
              {filtrees.map((c) => {
                const situation = parCliente.get(c.id!);
                const enRetard = (situation?.nb_en_retard ?? 0) > 0;
                return (
                <tr
                  key={c.id}
                  className={enRetard ? 'bg-rose-50/70 hover:bg-rose-50' : 'hover:bg-ardoise-50'}
                >
                  {/* Le bandeau rouge court sur toute la ligne : le retard se
                      repère en balayant la liste, sans lire la colonne. */}
                  <td
                    className={`border-l-4 px-4 py-2.5 ${
                      enRetard ? 'border-rose-600' : 'border-transparent'
                    }`}
                  >
                    <Link
                      to={`/clientes/${c.id}`}
                      className="flex items-center gap-1.5 font-semibold text-ardoise-900 hover:text-marine-700"
                    >
                      {enRetard && (
                        <AlertTriangle
                          className="h-3.5 w-3.5 shrink-0 text-rose-600"
                          aria-label="Règlement en retard"
                        />
                      )}
                      {c.prenom} {c.nom}
                      <PastilleCredits nombre={creditsParCliente.get(c.id!) ?? 0} />
                    </Link>
                    {c.ville && <div className="text-xs text-ardoise-400">{c.ville}</div>}
                  </td>
                  {tousCentres && (
                    <td className="px-4 py-2.5 text-ardoise-600">
                      {centresAccessibles.find((ce) => ce.id === c.centre_id)?.nom ?? c.centre_id}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-ardoise-600">
                    <div>{c.telephone ?? '—'}</div>
                    {c.email && <div className="text-xs text-ardoise-400">{c.email}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-ardoise-600">
                    {c.therapeutes.length > 0 ? c.therapeutes.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <CelluleReglement situation={situation} />
                  </td>
                  <td className="px-4 py-2.5">
                    <BoutonNotes
                      resume={notesParCliente.get(c.id!)}
                      onOuvrir={() => setNotesOuvertes(c)}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-ardoise-500">
                    {archives && c.archivee_le ? (
                      <button onClick={() => restaurer(c)} className="bouton-discret text-xs">
                        <Undo2 className="h-3.5 w-3.5" />
                        Restaurer
                      </button>
                    ) : (
                      format(new Date(c.cree_le), 'd MMM yyyy', { locale: fr })
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center justify-end gap-0.5">
                      {!archives && (
                        <button
                          type="button"
                          onClick={() => archiver(c)}
                          title="Archiver — réversible, rien n'est perdu"
                          aria-label={`Archiver ${c.prenom} ${c.nom}`}
                          className="rounded-lg p-1.5 text-ardoise-300 hover:bg-ardoise-100 hover:text-ardoise-700"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                      {role === 'direction' && (
                        <button
                          type="button"
                          onClick={() => setASupprimer(c)}
                          title="Supprimer définitivement"
                          aria-label={`Supprimer ${c.prenom} ${c.nom}`}
                          className="rounded-lg p-1.5 text-ardoise-300 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aSupprimer && (
        <ModaleSuppression
          cliente={aSupprimer}
          onFerme={() => setASupprimer(null)}
          onSupprimee={() => {
            const nom = `${aSupprimer.prenom} ${aSupprimer.nom}`;
            setASupprimer(null);
            qc.invalidateQueries({ queryKey: ['clientes', perimetre] });
            qc.invalidateQueries({ queryKey: ['clientes-archivees', perimetre] });
            toast.success(`${nom} supprimée`);
          }}
        />
      )}

      {notesOuvertes && (
        <ModaleNotes
          clienteId={notesOuvertes.id!}
          centreId={centre.id}
          nomCliente={`${notesOuvertes.prenom} ${notesOuvertes.nom}`}
          onFermer={() => setNotesOuvertes(null)}
        />
      )}
    </div>
  );
}

function BoutonNotes({
  resume,
  onOuvrir,
}: {
  resume: { nb: number; a_epinglee: boolean } | undefined;
  onOuvrir: () => void;
}) {
  const nb = resume?.nb ?? 0;
  const epinglee = resume?.a_epinglee ?? false;

  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-label={nb === 0 ? 'Ajouter une note' : `Voir les ${nb} notes`}
      title={nb === 0 ? 'Ajouter une note' : `${nb} note${nb > 1 ? 's' : ''}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        epinglee
          ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
          : nb > 0
            ? 'border-ardoise-300 bg-white text-ardoise-700 hover:bg-ardoise-50'
            : 'border-ardoise-200 bg-white text-ardoise-400 hover:border-ardoise-300 hover:text-ardoise-700'
      }`}
    >
      {epinglee ? <Pin className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
      {nb > 0 ? nb : '+'}
    </button>
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
