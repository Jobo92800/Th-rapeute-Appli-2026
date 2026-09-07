import { useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, KeyRound, RefreshCw, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSession } from '../lib/session';
import { texteErreur } from '../lib/erreurs';
import {
  MOT_DE_PASSE_MIN,
  changerLeMotDePasse,
  etatDesComptes,
  type EtatCompte,
} from '../services/comptes';

/**
 * Les comptes de connexion.
 *
 * Deux questions, et une seule réponse suffisait rarement : « pourquoi
 * Caroll n'arrive plus à se connecter ? » et « comment lui redonner un mot
 * de passe ? ». Elles se réglaient jusqu'ici dans Supabase, avec du SQL
 * collé à la main, pendant qu'une thérapeute attendait au téléphone.
 *
 * Ce que l'écran ne peut pas dire : si un mot de passe est faux ou
 * simplement oublié. Supabase ne rend jamais un mot de passe, même à la
 * clé de service. Quand tout est « ok » ici et que la connexion échoue
 * quand même, c'est le mot de passe — et il se remplace.
 */
export default function Comptes() {
  const { role } = useSession();
  const qc = useQueryClient();
  const [cible, setCible] = useState<EtatCompte | null>(null);

  const {
    data: comptes = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['comptes'],
    queryFn: etatDesComptes,
    enabled: role === 'direction',
  });

  if (role !== 'direction') {
    return (
      <div className="carte flex items-start gap-3 p-5">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-ardoise-400" />
        <p className="text-sm text-ardoise-600">
          Les comptes de connexion sont tenus par la direction.
        </p>
      </div>
    );
  }

  const parCentre = new Map<string, EtatCompte[]>();
  for (const c of comptes) {
    const cle = c.centre_nom ?? 'Direction';
    parCentre.set(cle, [...(parCentre.get(cle) ?? []), c]);
  }
  const enPanne = comptes.filter((c) => c.diagnostic !== 'ok' && c.actif);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ardoise-900">Comptes</h1>
          <p className="mt-0.5 text-sm text-ardoise-500">
            Qui peut se connecter, et quoi faire quand ça ne marche plus.
          </p>
        </div>
        <button onClick={() => void refetch()} disabled={isFetching} className="bouton-discret">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Relire
        </button>
      </header>

      {error ? (
        <div className="carte flex items-start gap-3 border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              La liste des comptes n’a pas pu être lue.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {texteErreur(error)}
            </p>
            <p className="mt-2 text-xs text-amber-800">
              Si le message parle d’une fonction absente, la migration 048 n’a pas encore été
              passée dans l’éditeur SQL de Supabase.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm text-ardoise-400">Lecture des comptes…</p>
      ) : (
        <>
          {enPanne.length > 0 && (
            <div className="carte border-amber-200 bg-amber-50 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {enPanne.length} compte{enPanne.length > 1 ? 's' : ''} ne fonctionne
                {enPanne.length > 1 ? 'nt' : ''} pas
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {enPanne.map((c) => (
                  <li key={c.therapeute_id}>
                    <b>{c.prenom}</b> — {c.diagnostic}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {[...parCentre.entries()].map(([centre, lignes]) => (
            <section key={centre} className="carte overflow-hidden">
              <h2 className="border-b border-ardoise-200 bg-ardoise-50 px-5 py-3 text-sm font-semibold text-ardoise-900">
                {centre}
              </h2>
              <ul className="divide-y divide-ardoise-100">
                {lignes.map((c) => (
                  <li
                    key={c.therapeute_id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
                  >
                    <span className="min-w-40 flex-1">
                      <span className="block text-sm font-semibold text-ardoise-900">
                        {c.prenom}
                        {!c.actif && (
                          <span className="ml-2 rounded-full border border-ardoise-200 px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-ardoise-500">
                            Inactive
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-ardoise-500">
                        {c.email ?? 'aucune adresse'}
                      </span>
                    </span>

                    <span className="min-w-36 text-xs text-ardoise-500">
                      {c.derniere_connexion
                        ? `Vue le ${format(new Date(c.derniere_connexion), 'dd/MM/yyyy', { locale: fr })}`
                        : 'Jamais connectée'}
                    </span>

                    <span className="min-w-52 flex-1 text-xs">
                      {c.diagnostic === 'ok' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Peut se connecter
                        </span>
                      ) : (
                        <span className="text-amber-800">{c.diagnostic}</span>
                      )}
                    </span>

                    <button
                      onClick={() => setCible(c)}
                      disabled={!c.a_un_compte}
                      className="bouton-discret shrink-0"
                      title={
                        c.a_un_compte
                          ? undefined
                          : 'Cette personne n’a pas encore de compte de connexion.'
                      }
                    >
                      <KeyRound className="h-4 w-4" />
                      Mot de passe
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="text-xs text-ardoise-500">
            Un compte « qui peut se connecter » et un mot de passe juste sont deux choses
            différentes. Supabase ne rend jamais un mot de passe, même ici : quand tout est vert
            et que la connexion échoue quand même, c’est celui-là — remplacez-le.
          </p>
        </>
      )}

      {cible && (
        <ModaleMotDePasse
          compte={cible}
          onFermer={() => setCible(null)}
          onFait={() => {
            setCible(null);
            void qc.invalidateQueries({ queryKey: ['comptes'] });
          }}
        />
      )}
    </div>
  );
}

/**
 * Le mot de passe se tape ici et ne va nulle part ailleurs : il n'est ni
 * journalisé, ni enregistré, ni envoyé dans Airtable. Il traverse la
 * fonction Edge et Supabase le remplace.
 */
function ModaleMotDePasse({
  compte,
  onFermer,
  onFait,
}: {
  compte: EtatCompte;
  onFermer: () => void;
  onFait: () => void;
}) {
  const [motDePasse, setMotDePasse] = useState('');

  const envoi = useMutation({
    mutationFn: () => changerLeMotDePasse(compte.therapeute_id, motDePasse),
    onSuccess: ({ prenom }) => {
      toast.success(`Nouveau mot de passe en place pour ${prenom}. Dictez-le-lui.`, {
        duration: 8000,
      });
      onFait();
    },
    onError: (e) => toast.error(texteErreur(e) || 'Le changement a échoué.'),
  });

  const tropCourt = motDePasse.length > 0 && motDePasse.length < MOT_DE_PASSE_MIN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ardoise-900/40 p-4">
      <div className="carte w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-ardoise-900">
          Mot de passe de {compte.prenom}
        </h2>
        <p className="mt-1 text-sm text-ardoise-500">{compte.email}</p>

        <label className="etiquette mt-5 block" htmlFor="mdp">
          Nouveau mot de passe
        </label>
        <input
          id="mdp"
          type="text"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          autoComplete="off"
          placeholder={`${MOT_DE_PASSE_MIN} caractères minimum`}
          className="champ"
        />
        <p className="mt-1.5 text-xs text-ardoise-500">
          {tropCourt
            ? `Il en faut au moins ${MOT_DE_PASSE_MIN}.`
            : 'Il s’affiche en clair : vous allez le dicter. Elle pourra le changer ensuite depuis son propre écran.'}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onFermer} className="bouton-discret">
            Annuler
          </button>
          <button
            onClick={() => envoi.mutate()}
            disabled={motDePasse.length < MOT_DE_PASSE_MIN || envoi.isPending}
            className="bouton-fort"
          >
            {envoi.isPending ? 'Changement…' : 'Changer le mot de passe'}
          </button>
        </div>
      </div>
    </div>
  );
}
