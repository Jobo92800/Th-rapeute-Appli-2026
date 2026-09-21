import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { texteErreur } from '../lib/erreurs';
import { useSession } from '../lib/session';
import { annoncesNonLues } from '../domain/messages';
import { lireMessages, marquerLu } from '../services/messages';

/**
 * Les annonces de la direction que la thérapeute n'a pas encore lues, en
 * carte en haut de son écran d'accueil.
 *
 * La pastille sur le menu Messages ne suffisait pas : on ne va dans le
 * carnet que quand on y pense, et une annonce importante pouvait attendre
 * des jours. Ici, le message est sous les yeux dès la connexion, en entier.
 * Il y reste tant qu'il n'a pas été lu ; « J'ai lu » le retire — et c'est
 * ce geste qui dit à la direction que le message est passé (même règle que
 * l'ouverture dans le carnet). Pas de croix pour le cacher sans le lire :
 * ce serait mentir à la direction.
 */
export default function AnnoncesDuJour() {
  const { therapeute, role } = useSession();
  const qc = useQueryClient();
  const moi = therapeute?.id ?? null;

  const { data: messages = [] } = useQuery({
    queryKey: ['messages'],
    queryFn: lireMessages,
    enabled: Boolean(moi),
    refetchInterval: 60_000,
  });

  const lu = useMutation({
    mutationFn: (messageId: string) => marquerLu(messageId, moi!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['messages-en-attente'] });
    },
    onError: (e) => toast.error(texteErreur(e) || "Le message n'a pas pu être marqué lu."),
  });

  // La direction écrit les annonces, elle ne se les fait pas afficher.
  if (role === 'direction') return null;

  const annonces = annoncesNonLues(messages, moi);
  if (annonces.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Messages de la direction">
      {annonces.map((m) => (
        <article
          key={m.id}
          className="rounded-2xl border-[1.5px] border-marine-300 bg-marine-50 px-5 py-4 shadow-flottante"
        >
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marine-500 text-white">
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="surtitre">
                Message de la direction · {m.auteur} ·{' '}
                {format(new Date(m.cree_le), 'd MMMM', { locale: fr })}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-ardoise-900">{m.sujet}</h2>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ardoise-700">
                {m.corps}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => lu.mutate(m.id)}
                disabled={lu.isPending}
                className="bouton-principal"
              >
                <Check className="h-4 w-4" />
                J’ai lu
              </button>
              <Link to="/messages" className="text-xs font-semibold text-marine-700 hover:underline">
                Ouvrir le carnet
              </Link>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
