import { useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { MOT_DE_PASSE_MIN, changerMonMotDePasse } from '../services/comptes';
import { texteErreur } from '../lib/erreurs';

/**
 * Changer son propre mot de passe.
 *
 * Sans ça, celui que la direction a dicté au téléphone reste en place pour
 * toujours : il a été prononcé à voix haute dans un centre, parfois noté
 * sur un papier au comptoir. Ici, personne d'autre n'intervient — Supabase
 * accepte qu'une personne connectée change le sien, et rien d'autre.
 */
export default function MonMotDePasse() {
  const [ouvert, setOuvert] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');

  const envoi = useMutation({
    mutationFn: () => changerMonMotDePasse(motDePasse),
    onSuccess: () => {
      toast.success('Mot de passe changé. Il servira à votre prochaine connexion.');
      setMotDePasse('');
      setOuvert(false);
    },
    onError: (e) => toast.error(texteErreur(e) || 'Le changement a échoué.'),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-ardoise-500 transition-colors hover:bg-ardoise-50 hover:text-ardoise-900"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Mon mot de passe
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ardoise-900/40 p-4">
          <div className="carte w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ardoise-900">Changer mon mot de passe</h2>
            <p className="mt-1 text-sm text-ardoise-500">
              Il remplace celui que vous utilisez aujourd’hui, tout de suite.
            </p>

            <label className="etiquette mt-5 block" htmlFor="mon-mdp">
              Nouveau mot de passe
            </label>
            <input
              id="mon-mdp"
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="new-password"
              placeholder={`${MOT_DE_PASSE_MIN} caractères minimum`}
              className="champ"
            />
            <p className="mt-1.5 text-xs text-ardoise-500">
              Choisissez-en un que vous retiendrez : personne ne peut vous le rappeler, il faudra
              en demander un nouveau à la direction.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setMotDePasse('');
                  setOuvert(false);
                }}
                className="bouton-discret"
              >
                Annuler
              </button>
              <button
                onClick={() => envoi.mutate()}
                disabled={motDePasse.length < MOT_DE_PASSE_MIN || envoi.isPending}
                className="bouton-fort"
              >
                {envoi.isPending ? 'Changement…' : 'Changer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
