import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Connexion() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function connecter(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    });

    if (error) {
      setErreur(
        error.message === 'Invalid login credentials'
          ? 'Identifiant ou mot de passe incorrect.'
          : "La connexion n'a pas abouti. Réessayez dans un instant.",
      );
      setEnCours(false);
    }
    // En cas de succès, le changement de session bascule l'application.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ardoise-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="text-2xl font-bold tracking-tight text-marine-800">
            MAbeauty<span className="text-rose-600">plus</span>
          </div>
          <p className="mt-1 text-sm text-ardoise-500">Suivi client</p>
        </div>

        <form onSubmit={connecter} className="carte space-y-4 p-6">
          <div>
            <label htmlFor="email" className="etiquette">
              Votre adresse
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="champ"
              placeholder="prenom@mabeautyplus.fr"
            />
          </div>

          <div>
            <label htmlFor="mdp" className="etiquette">
              Mot de passe
            </label>
            <input
              id="mdp"
              type="password"
              autoComplete="current-password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="champ"
            />
          </div>

          {erreur && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {erreur}
            </p>
          )}

          <button type="submit" disabled={enCours} className="bouton-principal w-full">
            <LogIn className="h-4 w-4" />
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
