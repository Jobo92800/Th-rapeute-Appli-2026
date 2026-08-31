import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Headphones, Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  donnerAccesParcours,
  etatParcours,
  renvoyerInvitationParcours,
} from '../../services/metier';
import type { Cliente } from '../../types/db';

const ADRESSE = 'https://applipodcast.netlify.app';

/**
 * L'accès de la cliente à l'application Mon Parcours.
 *
 * Il n'existe aucun lien personnel : la cliente a un compte, et l'adresse du
 * site est la même pour toutes. Ce bloc sert donc à donner l'accès, à voir
 * s'il a été activé, et à renvoyer l'invitation quand elle s'est perdue.
 */
export default function CarteParcoursAudio({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [action, setAction] = useState<'creer' | 'renvoyer' | null>(null);
  const [parcoursChoisi, setParcoursChoisi] = useState<'A' | 'B' | 'C'>('A');

  const aAcces = Boolean(cliente.acces_audio_le);

  const { data: compte, isLoading } = useQuery({
    queryKey: ['parcours-audio', cliente.id],
    queryFn: () => etatParcours(cliente.id),
    enabled: aAcces,
    staleTime: 60_000,
  });

  async function donner() {
    setAction('creer');
    try {
      const { dejaLa } = await donnerAccesParcours(cliente.id, parcoursChoisi);
      qc.invalidateQueries({ queryKey: ['cliente', cliente.id] });
      qc.invalidateQueries({ queryKey: ['parcours-audio', cliente.id] });
      toast.success(
        dejaLa
          ? 'La cliente avait déjà un compte — parcours enregistré'
          : `Invitation envoyée à ${cliente.email}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'accès n'a pas pu être créé.");
    } finally {
      setAction(null);
    }
  }

  async function renvoyer() {
    setAction('renvoyer');
    try {
      const email = await renvoyerInvitationParcours(cliente.id);
      toast.success(`Invitation renvoyée à ${email || cliente.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'invitation n'a pas pu être renvoyée.");
    } finally {
      setAction(null);
    }
  }

  return (
    <section className="carte">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ardoise-100 px-5 py-3.5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
            <Headphones className="h-4 w-4 text-ardoise-400" />
            Parcours audio
          </h2>
          <p className="text-xs text-ardoise-500">
            {aAcces
              ? 'La cliente se connecte avec son email et son mot de passe.'
              : "L'accès se donne normalement à la signature du contrat."}
          </p>
        </div>

        {aAcces && (
          <span className="chiffres rounded-full border border-marine-300 bg-marine-50 px-3 py-1 text-sm font-bold text-marine-800">
            Parcours {cliente.parcours_audio}
          </span>
        )}
      </div>

      <div className="p-5">
        {!cliente.email ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Cette cliente n'a pas d'adresse email : l'invitation ne peut pas partir. Renseignez-la
            dans l'onglet Coordonnées.
          </p>
        ) : !aAcces ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5">
              {(['A', 'B', 'C'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setParcoursChoisi(p)}
                  aria-pressed={parcoursChoisi === p}
                  className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    parcoursChoisi === p
                      ? 'border-marine-600 bg-marine-600 text-white'
                      : 'border-ardoise-300 bg-white text-ardoise-700 hover:border-marine-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button onClick={donner} disabled={action !== null} className="bouton-principal">
              {action === 'creer' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Donner accès
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {isLoading ? (
                <span className="text-ardoise-400">Vérification du compte…</span>
              ) : compte?.compteActive ? (
                <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Compte activé
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-medium text-amber-700">
                  <Clock className="h-4 w-4" />
                  Invitation envoyée, mot de passe pas encore choisi
                </span>
              )}

              {compte && compte.total > 0 && (
                <span className="chiffres text-ardoise-600">
                  {compte.terminees} / {compte.total} étapes écoutées
                </span>
              )}

              {compte?.derniereActivite && (
                <span className="text-ardoise-500">
                  dernière écoute le{' '}
                  {format(new Date(compte.derniereActivite), 'd MMM yyyy', { locale: fr })}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={renvoyer} disabled={action !== null} className="bouton-discret">
                {action === 'renvoyer' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Renvoyer l'invitation
              </button>
              <a
                href={ADRESSE}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs text-marine-700 underline hover:text-marine-900"
              >
                {ADRESSE.replace('https://', '')}
              </a>
            </div>

            <p className="text-xs text-ardoise-400">
              Accès donné le{' '}
              {format(new Date(cliente.acces_audio_le!), 'd MMMM yyyy', { locale: fr })}. Le renvoi
              d'invitation sert quand la cliente ne retrouve pas son email.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
