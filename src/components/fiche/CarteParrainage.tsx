import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, HeartHandshake, Loader2, Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  apercuCliente,
  chercherParrain,
  filleulesDe,
  rattacherFilleule,
  definirParrainLibre,
  seancesOffertesUtilisees,
  type ApercuCliente,
} from '../../services/parrainage';
import {
  PLAFOND_SEANCES,
  SEANCES_PAR_FILLEULE,
  calculerSolde,
  libelleSolde,
} from '../../domain/parrainage';
import type { Cliente } from '../../types/db';

/**
 * Qui a parrainé cette cliente, qui elle a parrainé, et ce que ça lui a
 * rapporté. Les séances gagnées ne touchent pas la cure en cours — elle est
 * signée et facturée : elles attendent la suivante.
 */
export default function CarteParrainage({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [marraineOuverte, setMarraineOuverte] = useState(false);
  const [nomLibre, setNomLibre] = useState(cliente.parrain_libre);

  const { data: marraine } = useQuery({
    queryKey: ['marraine', cliente.parrain_id],
    queryFn: () => apercuCliente(cliente.parrain_id!),
    enabled: !!cliente.parrain_id,
  });

  const { data: filleules = [], error } = useQuery({
    queryKey: ['filleules', cliente.id],
    queryFn: () => filleulesDe(cliente.id),
  });

  const { data: utilisees = 0 } = useQuery({
    queryKey: ['seances-offertes-utilisees', cliente.id],
    queryFn: () => seancesOffertesUtilisees(cliente.id),
  });

  const solde = calculerSolde(filleules, utilisees);

  function rafraichir() {
    qc.invalidateQueries({ queryKey: ['filleules', cliente.id] });
    qc.invalidateQueries({ queryKey: ['cliente', cliente.id] });
  }

  if (error) {
    return (
      <section className="carte p-5">
        <p className="text-sm text-amber-900">
          Le parrainage n’existe pas encore dans la base. Passez la migration 017 dans l’éditeur
          SQL de Supabase (projet MAbeautyplus V2), puis rechargez cette page.
        </p>
      </section>
    );
  }

  return (
    <section className="carte">
      <div className="flex items-center gap-2 border-b border-ardoise-200 px-5 py-3.5">
        <HeartHandshake className="h-4 w-4 text-ardoise-400" />
        <h2 className="text-sm font-semibold text-ardoise-900">Parrainage</h2>
      </div>

      <div className="space-y-5 p-5">
        {/* Sa marraine ------------------------------------------------- */}
        <div>
          <h3 className="etiquette">Qui l’a parrainée</h3>

          {cliente.parrain_id && marraine ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ardoise-200 px-3 py-2">
              <span className="text-sm text-ardoise-900">
                {marraine.prenom} {marraine.nom}
                <span className="ml-2 text-xs text-ardoise-500">{marraine.centre}</span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await rattacherFilleule(cliente.id, null);
                    rafraichir();
                    toast.success('Marraine retirée');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Le retrait a échoué.');
                  }
                }}
                className="text-xs font-semibold text-ardoise-500 hover:text-rose-600"
              >
                Retirer
              </button>
            </div>
          ) : marraineOuverte ? (
            <div className="space-y-3">
              <ChercheurCliente
                sauf={cliente.id}
                placeholder="Chercher sa marraine dans les 5 centres…"
                onChoisir={async (c) => {
                  try {
                    await rattacherFilleule(cliente.id, c.id);
                    setMarraineOuverte(false);
                    rafraichir();
                    toast.success(`${c.prenom} ${c.nom} est sa marraine`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Le rattachement a échoué.');
                  }
                }}
              />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="etiquette" htmlFor="parrain-libre">
                    Ou son nom, si elle n’a pas de fiche
                  </label>
                  <input
                    id="parrain-libre"
                    className="champ"
                    value={nomLibre}
                    onChange={(e) => setNomLibre(e.target.value)}
                    placeholder="Cliente de l’ancienne application"
                  />
                </div>
                <button
                  type="button"
                  className="bouton-discret"
                  onClick={async () => {
                    try {
                      await definirParrainLibre(cliente.id, nomLibre);
                      setMarraineOuverte(false);
                      rafraichir();
                      toast.success('Marraine enregistrée');
                    } catch {
                      toast.error("Le nom n'a pas pu être enregistré.");
                    }
                  }}
                >
                  Enregistrer
                </button>
              </div>
              <p className="text-xs text-ardoise-500">
                Un nom libre ne rapporte aucune séance : sans fiche, on ne peut pas savoir si la
                cure a été signée.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ardoise-500">
                {cliente.parrain_libre || 'Personne — elle est venue d’elle-même.'}
              </p>
              <button
                type="button"
                onClick={() => setMarraineOuverte(true)}
                className="text-xs font-semibold text-marine-700 hover:text-marine-800"
              >
                {cliente.parrain_libre ? 'Changer' : 'Indiquer une marraine'}
              </button>
            </div>
          )}
        </div>

        {/* Ses filleules ----------------------------------------------- */}
        <div className="border-t border-ardoise-100 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="etiquette mb-0">Qui elle a parrainé</h3>
            <button
              type="button"
              onClick={() => setAjoutOuvert((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-marine-700 hover:text-marine-800"
            >
              {ajoutOuvert ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {ajoutOuvert ? 'Annuler' : 'Ajouter une filleule'}
            </button>
          </div>

          {ajoutOuvert && (
            <div className="mb-3">
              <ChercheurCliente
                sauf={cliente.id}
                placeholder="Chercher la filleule dans les 5 centres…"
                onChoisir={async (c) => {
                  try {
                    await rattacherFilleule(c.id, cliente.id);
                    setAjoutOuvert(false);
                    rafraichir();
                    toast.success(`${c.prenom} ${c.nom} est sa filleule`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Le rattachement a échoué.');
                  }
                }}
              />
            </div>
          )}

          {filleules.length === 0 ? (
            <p className="text-sm text-ardoise-500">Aucune filleule enregistrée.</p>
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {filleules.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ardoise-900">
                      {f.prenom} {f.nom}
                      {f.centre_id !== cliente.centre_id && (
                        <span className="ml-2 text-xs text-ardoise-500">{f.centre}</span>
                      )}
                    </span>
                    <span className="block text-xs text-ardoise-500">
                      {f.engagee_le
                        ? `Cure signée le ${format(new Date(f.engagee_le), 'd MMM yyyy', { locale: fr })}`
                        : 'Pas encore de cure signée'}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      f.engagee_le
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-ardoise-200 bg-ardoise-50 text-ardoise-500'
                    }`}
                  >
                    {f.engagee_le ? `+ ${SEANCES_PAR_FILLEULE} séances` : 'En attente'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ce que ça lui rapporte -------------------------------------- */}
        {solde.total > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-marine-200 bg-marine-50 px-4 py-3">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-marine-600" />
            <div className="text-sm text-marine-900">
              <p className="font-semibold">{libelleSolde(solde)}</p>
              <p className="mt-0.5 text-xs">
                {solde.utilisees > 0 && `${solde.utilisees} déjà posées sur une cure · `}
                <strong>
                  {solde.disponibles} séance{solde.disponibles > 1 ? 's' : ''} à poser
                </strong>{' '}
                sur sa prochaine cure. Elles ne touchent pas la cure en cours, déjà signée.
              </p>
              {solde.plafondAtteint && (
                <p className="mt-1 text-xs text-marine-700">
                  Plafond de {PLAFOND_SEANCES} séances atteint : les filleules suivantes sont
                  comptées, mais ne rapportent plus.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Recherche une cliente dans les cinq centres, à partir de 3 caractères. */
function ChercheurCliente({
  sauf,
  placeholder,
  onChoisir,
}: {
  sauf: string;
  placeholder: string;
  onChoisir: (c: ApercuCliente) => Promise<void>;
}) {
  const [texte, setTexte] = useState('');
  const [enCours, setEnCours] = useState(false);

  const { data: resultats = [], isFetching } = useQuery({
    queryKey: ['chercher-parrain', texte, sauf],
    queryFn: () => chercherParrain(texte, sauf),
    enabled: texte.trim().length >= 3,
  });

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ardoise-400" />
        <input
          className="champ pl-9"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={placeholder}
        />
      </div>

      {texte.trim().length >= 3 && (
        <div className="mt-2 overflow-hidden rounded-lg border border-ardoise-200">
          {isFetching ? (
            <p className="flex items-center justify-center gap-2 px-3 py-3 text-sm text-ardoise-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Recherche…
            </p>
          ) : resultats.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ardoise-500">
              Aucune fiche à ce nom dans les cinq centres.
            </p>
          ) : (
            <ul className="divide-y divide-ardoise-100">
              {resultats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={async () => {
                      setEnCours(true);
                      await onChoisir(c);
                      setEnCours(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-ardoise-50 disabled:opacity-50"
                  >
                    <span className="text-sm text-ardoise-900">
                      {c.prenom} {c.nom}
                    </span>
                    <span className="text-xs text-ardoise-500">{c.centre}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
