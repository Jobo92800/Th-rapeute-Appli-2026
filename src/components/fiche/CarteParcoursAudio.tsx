import { useState } from 'react';
import { texteErreur } from '../../lib/erreurs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Headphones, Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  MOT_DE_PASSE_MIN,
  donnerAccesParcours,
  etatParcours,
} from '../../services/metier';
import { laCliente, majuscule } from '../../domain/civilite';
import {
  ADRESSE_PARCOURS,
  ADRESSE_PARCOURS_DITE,
  PARCOURS,
  libelleParcours,
  type CodeParcours,
} from '../../domain/parcoursAudio';
import type { Cliente } from '../../types/db';

/**
 * L'accès de la cliente à l'application Mon Parcours.
 *
 * CE BLOC EST UN RATTRAPAGE, PAS LE CHEMIN NORMAL.
 *
 * L'accès se donne à la signature du contrat, dans la fenêtre de signature :
 * c'est le moment où la cliente est là, où l'on choisit le mot de passe avec
 * elle et où elle se connecte devant nous. Ici, on répare — une cliente qui
 * a oublié son mot de passe, ou un accès qui n'a pas été donné ce jour-là.
 *
 * Le dire est nécessaire : rien n'empêche techniquement de donner l'accès
 * ici puis de le redonner à la signature, et une thérapeute qui ne le sait
 * pas crée deux comptes sans s'en rendre compte.
 *
 * Il n'existe aucun lien personnel : la cliente a un compte, et l'adresse du
 * site est la même pour toutes.
 */
export default function CarteParcoursAudio({
  cliente,
  contratSigneLe,
}: {
  cliente: Cliente;
  /**
   * La date du dernier contrat signé, s'il y en a un.
   *
   * Elle sert aux deux mises en garde de ce bloc, qui ne disent pas la même
   * chose : avant la signature, l'accès va être proposé et il ne faut pas le
   * donner deux fois ; après, il aurait dû l'être, et s'il ne l'a pas été il
   * faut d'abord s'assurer qu'il n'existe pas déjà ailleurs.
   */
  contratSigneLe: string | null;
}) {
  const qc = useQueryClient();
  const [action, setAction] = useState<'creer' | null>(null);
  const [parcoursChoisi, setParcoursChoisi] = useState<CodeParcours>('B');
  const [motDePasse, setMotDePasse] = useState('');

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
      /*
        Sur un compte existant, on ne redistribue pas son parcours : elle en
        suit un, le remettre à zéro effacerait son avancement.
      */
      const { motDePasseDefini } = await donnerAccesParcours(
        cliente.id,
        aAcces ? ((cliente.parcours_audio as CodeParcours | null) ?? parcoursChoisi) : parcoursChoisi,
        motDePasse,
      );
      setMotDePasse('');
      qc.invalidateQueries({ queryKey: ['cliente', cliente.id] });
      qc.invalidateQueries({ queryKey: ['parcours-audio', cliente.id] });
      toast.success(
        motDePasseDefini
          ? `Compte prêt — ${laCliente(cliente.civilite)} peut se connecter dès maintenant`
          : `Compte créé — reprenez le mot de passe ici`,
        { duration: 6000 },
      );
    } catch (e) {
      toast.error(texteErreur(e) || "L'accès n'a pas pu être créé.");
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
              ? `${majuscule(laCliente(cliente.civilite))} a déjà son accès. Ici, on dépanne : mot de passe oublié, email perdu.`
              : "L'accès se donne à la signature du contrat. Ici, seulement s'il n'a pas été donné ce jour-là."}
          </p>
        </div>

        {aAcces && (
          <span className="chiffres rounded-full border border-marine-300 bg-marine-50 px-3 py-1 text-sm font-bold text-marine-800">
            Parcours {libelleParcours(cliente.parcours_audio)}
          </span>
        )}
      </div>

      <div className="p-5">
        {!cliente.email ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {majuscule(laCliente(cliente.civilite, 'cette'))} n'a pas d'adresse email : l'invitation ne peut
                pas partir. Renseignez-la
            dans l'onglet Coordonnées.
          </p>
        ) : !aAcces ? (
          <div className="space-y-3">
            {/*
              Le doublon qu'on veut éviter : donner l'accès ici, puis le
              redonner dans la fenêtre de signature qui le propose aussi.
              Deux comptes pour la même cliente, et personne ne s'en aperçoit
              avant qu'elle appelle.
            */}
            {!contratSigneLe ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <b>Son contrat n’est pas encore signé.</b> L’accès se donne dans la fenêtre de
                signature, avec le parcours et le mot de passe — n’y touchez pas ici, vous
                créeriez deux comptes.
              </p>
            ) : (
              /*
                Contrat signé, et pourtant aucun accès enregistré. Deux
                explications, et elles n'appellent pas le même geste : le
                parcours n'a pas été coché ce jour-là — c'est ici qu'on
                rattrape — ou le compte a bien été créé sans que l'application
                l'apprenne. Dans le second cas, en créer un autre donnerait à
                la cliente deux comptes et un mot de passe qui ne marche
                qu'une fois sur deux.
              */
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <b>
                  Son contrat a été signé le{' '}
                  {format(new Date(contratSigneLe), 'd MMMM yyyy', { locale: fr })}
                </b>
                , et aucun accès n’a été enregistré ce jour-là. Si le parcours n’a pas été choisi
                à la signature, c’est bien ici qu’on le rattrape. Mais si vous pensez qu’il lui a
                déjà été donné, <b>vérifiez d’abord dans Mon Parcours</b> : deux comptes pour la
                même personne, et son mot de passe ne marchera qu’une fois sur deux.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <span className="etiquette">Parcours</span>
                <div className="flex gap-1.5">
                  {PARCOURS.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => setParcoursChoisi(p.code)}
                      aria-pressed={parcoursChoisi === p.code}
                      className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        parcoursChoisi === p.code
                          ? 'border-marine-600 bg-marine-600 text-white'
                          : 'border-ardoise-300 bg-white text-ardoise-700 hover:border-marine-400'
                      }`}
                    >
                      {p.libelle}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-52 flex-1">
                <label htmlFor="mdp-carte" className="etiquette">
                  Mot de passe, à choisir avec {laCliente(cliente.civilite)}
                </label>
                <input
                  id="mdp-carte"
                  type="text"
                  autoComplete="off"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  className="champ"
                  placeholder={`${MOT_DE_PASSE_MIN} caractères minimum`}
                />
              </div>

              <button
                onClick={donner}
                disabled={action !== null || motDePasse.length < MOT_DE_PASSE_MIN}
                className="bouton-principal"
              >
                {action === 'creer' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Donner accès
              </button>
            </div>

            <p className="text-xs text-ardoise-500">
              {motDePasse.length >= MOT_DE_PASSE_MIN
                ? `Le compte sera utilisable immédiatement : ${cliente.email} et ce mot de passe.`
                : `Obligatoire : c'est lui qui ouvre le compte. Aucun email ne part — notez-lui l'adresse et le mot de passe.`}
            </p>
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

            {/*
              MOT DE PASSE OUBLIÉ : ON LUI EN REDONNE UN, ON N'ENVOIE PLUS DE LIEN.

              Le renvoi d'invitation partait par email, et son lien ne valait
              qu'une fois, vingt-quatre heures. Depuis que le compte se crée
              dans deux applications — le parcours audio et la nutrition, le
              temps de la bascule —, chacune envoyait le sien : deux mails,
              deux liens, dont un vers une application qui n'est pas encore
              ouverte au public.

              Redonner un mot de passe ne fait partir aucun email, marche
              immédiatement, et met les deux comptes d'accord. C'est aussi ce
              que la thérapeute veut vraiment quand la cliente l'appelle.
            */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-52 flex-1">
                <label htmlFor="mdp-reprise" className="etiquette">
                  Mot de passe oublié ? Donnez-lui-en un nouveau
                </label>
                <input
                  id="mdp-reprise"
                  type="text"
                  autoComplete="off"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  className="champ"
                  placeholder={`${MOT_DE_PASSE_MIN} caractères minimum`}
                />
              </div>
              <button
                onClick={donner}
                disabled={action !== null || motDePasse.length < MOT_DE_PASSE_MIN}
                className="bouton-discret"
              >
                {action === 'creer' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Redonner l'accès
              </button>
              <a
                href={ADRESSE_PARCOURS}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs text-marine-700 underline hover:text-marine-900"
              >
                {ADRESSE_PARCOURS_DITE}
              </a>
            </div>

            <p className="text-xs text-ardoise-400">
              Accès donné le{' '}
              {format(new Date(cliente.acces_audio_le!), 'd MMMM yyyy', { locale: fr })}. Le nouveau
              mot de passe remplace l'ancien tout de suite, et{' '}
              {laCliente(cliente.civilite)} se connecte avec {cliente.email} sur{' '}
              {ADRESSE_PARCOURS_DITE}. Aucun email ne part : notez-lui les deux, ou dictez-les-lui
              au téléphone.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
