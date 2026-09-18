import { useState } from 'react';
import { texteErreur } from '../../lib/erreurs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useCentre } from '../../lib/session';
import {
  arriveeDesContratsAuCrm,
  consentementsDuContrat,
  contratsDeLaCliente,
  lirePdfContrat,
  programmesDeLaCliente,
  renvoyerAuCrm,
  ventesDeLaCliente,
} from '../../services/metier';
import { etatDuCentre } from '../../services/stock';
import ModaleContrat from '../contrat/ModaleContrat';
import type { Cliente } from '../../types/db';

/** Déclenche le téléchargement d'un PDF encodé en base64. */
function telecharger(base64: string, nom: string) {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OngletDocuments({ cliente }: { cliente: Cliente }) {
  const centre = useCentre();
  const qc = useQueryClient();
  const [signature, setSignature] = useState(false);
  const [consentsOuverts, setConsentsOuverts] = useState<string | null>(null);
  const [cureChoisie, setCureChoisie] = useState<string | null>(null);

  const { data: programmes = [] } = useQuery({
    queryKey: ['programmes', cliente.id],
    queryFn: () => programmesDeLaCliente(cliente.id),
  });

  const { data: contrats = [], isLoading } = useQuery({
    queryKey: ['contrats', cliente.id],
    queryFn: () => contratsDeLaCliente(cliente.id),
  });

  /*
    Où en est chaque contrat vis-à-vis du CRM. Tant qu'un contrat est en
    route, on redemande toutes les cinq secondes : la thérapeute voit la
    pastille passer d'« en route » à « dans le CRM » sans rien faire, et
    n'a plus à se demander si elle a oublié un bouton.
  */
  const { data: arrivees } = useQuery({
    queryKey: ['contrats-crm', cliente.id],
    queryFn: () => arriveeDesContratsAuCrm(cliente.id),
    refetchInterval: (q) =>
      [...(q.state.data?.values() ?? [])].some((d) => d === null) ? 5000 : false,
  });
  const enRoute = contrats.filter((c) => arrivees && arrivees.get(c.id) === null);
  // En route depuis plus de deux minutes : quelque chose coince, on le dit fort.
  const enPanne = enRoute.filter((c) => Date.now() - new Date(c.signe_le).getTime() > 2 * 60_000);

  /*
    Les boîtes de compléments comprises dans la cure figurent au contrat :
    on les charge avant d'ouvrir la fenêtre de signature, qui prépare ses
    documents une seule fois à l'ouverture.
  */
  const { data: ventes, isLoading: ventesEnCours } = useQuery({
    queryKey: ['ventes', cliente.id],
    queryFn: () => ventesDeLaCliente(cliente.id),
  });
  const { data: rayon = [] } = useQuery({
    queryKey: ['stock', centre.id],
    queryFn: () => etatDuCentre(centre.id),
  });

  const { data: consentements = [] } = useQuery({
    queryKey: ['consentements', consentsOuverts],
    queryFn: () => consentementsDuContrat(consentsOuverts!),
    enabled: Boolean(consentsOuverts),
  });

  const eligibles = programmes.filter((p) => p.programme.statut !== 'abandonne');

  // Par défaut la dernière cure, mais la thérapeute peut en choisir une autre :
  // une cliente qui revient a plusieurs cures, chacune son contrat.
  const actif =
    eligibles.find((p) => p.programme.id === cureChoisie) ?? eligibles.at(-1) ?? null;

  const numeroParProgramme = new Map(
    programmes.map((p) => [p.programme.id, p.programme.numero]),
  );

  async function telechargerContrat(id: string, nom: string) {
    try {
      const pdf = await lirePdfContrat(id);
      if (!pdf) {
        toast.error('PDF introuvable.');
        return;
      }
      telecharger(pdf, nom);
    } catch {
      toast.error('Le téléchargement a échoué.');
    }
  }

  return (
    <div className="space-y-5">
      <section className="carte">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ardoise-100 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ardoise-900">Contrat de prestation</h2>
            <p className="text-xs text-ardoise-500">
              {eligibles.length > 1
                ? 'Choisissez la cure à contractualiser, puis établissez le contrat.'
                : 'Le contrat et les consentements sont signés à l’écran, puis conservés ici.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {eligibles.length > 1 && (
              <select
                value={actif?.programme.id ?? ''}
                onChange={(e) => setCureChoisie(e.target.value)}
                aria-label="Cure à contractualiser"
                className="champ w-auto"
              >
                {eligibles.map((p) => (
                  <option key={p.programme.id} value={p.programme.id}>
                    Cure {p.programme.numero} —{' '}
                    {Number(p.programme.montant_total).toLocaleString('fr-FR')} €
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setSignature(true)}
              disabled={!actif}
              title={actif ? undefined : "Il faut d'abord valider une cure"}
              className="bouton-fort"
            >
              <FileSignature className="h-4 w-4" />
              Établir le contrat
            </button>
          </div>
        </div>

        {!actif && (
          <p className="px-5 py-8 text-center text-sm text-ardoise-500">
            Aucune cure enregistrée : le contrat reprend les prestations et l'échéancier d'une
            cure, il faut donc en valider une d'abord.
          </p>
        )}

        {actif && (
          <>
            {isLoading ? (
              <p className="px-5 py-8 text-center text-sm text-ardoise-400">Chargement…</p>
            ) : contrats.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ardoise-500">
                Aucun contrat signé pour l'instant.
              </p>
            ) : (
              <ul className="divide-y divide-ardoise-100">
                {contrats.map((c) => (
                  <li key={c.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-ardoise-900">
                          <FileText className="h-4 w-4 shrink-0 text-ardoise-400" />
                          Contrat du{' '}
                          {format(new Date(c.signe_le), 'd MMMM yyyy', { locale: fr })}
                        </p>
                        <p className="mt-0.5 text-xs text-ardoise-500">
                          {c.programme_id && numeroParProgramme.has(c.programme_id) && (
                            <>Cure {numeroParProgramme.get(c.programme_id)} · </>
                          )}
                          {c.montant && <>{c.montant} · </>}
                          {c.therapeute && <>signé avec {c.therapeute} · </>}
                          {c.nb_consentements} consentement{c.nb_consentements > 1 ? 's' : ''}
                        </p>
                        {arrivees && <PastilleCrm arriveLe={arrivees.get(c.id) ?? null} signeLe={c.signe_le} />}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {c.nb_consentements > 0 && (
                          <button
                            onClick={() =>
                              setConsentsOuverts(consentsOuverts === c.id ? null : c.id)
                            }
                            className="bouton-discret"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Consentements
                          </button>
                        )}
                        <button
                          onClick={() =>
                            telechargerContrat(
                              c.id,
                              `Contrat_${cliente.nom}_${cliente.prenom}.pdf`,
                            )
                          }
                          className="bouton-principal"
                        >
                          <Download className="h-4 w-4" />
                          Contrat
                        </button>
                      </div>
                    </div>

                    {consentsOuverts === c.id && (
                      <div className="mt-3 flex flex-wrap gap-2 rounded-lg bg-ardoise-50 p-3">
                        {consentements.length === 0 ? (
                          <span className="text-xs text-ardoise-400">Chargement…</span>
                        ) : (
                          consentements.map((cs) => (
                            <button
                              key={cs.id}
                              onClick={() => telecharger(cs.pdf_base64, cs.nom_fichier)}
                              className="bouton-discret text-xs"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {cs.nom_fichier.replace(/\.pdf$/, '').replace(/_/g, ' ')}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <EnvoyerAuCrm
        cliente={cliente}
        alerte={enPanne.length > 0}
        onEnvoye={() => qc.invalidateQueries({ queryKey: ['contrats-crm', cliente.id] })}
      />

      {signature && actif && !ventesEnCours && (
        <ModaleContrat
          cliente={cliente}
          centre={centre}
          programme={actif.programme}
          lignes={actif.lignes}
          echeances={actif.echeances}
          ventes={ventes ?? []}
          nomProduit={(code) => rayon.find((r) => r.code === code)?.nom ?? code}
          onFerme={() => setSignature(false)}
          onSigne={() => {
            setSignature(false);
            qc.invalidateQueries({ queryKey: ['contrats', cliente.id] });
            qc.invalidateQueries({ queryKey: ['contrats-crm', cliente.id] });
          }}
        />
      )}
    </div>
  );
}

/**
 * Reposer la fiche dans la file du CRM.
 *
 * Tout part dans Airtable tout seul. Quand la synchro passe à côté — CRM
 * indisponible, coupure au mauvais moment —, il fallait jusqu'ici retourner
 * dans « Coordonnées » et réappuyer sur « Enregistrer » : ça remet la fiche
 * en file, mais rien ne l'annonce et c'est à trois onglets d'ici. Le même
 * geste, nommé, à l'endroit où on le cherche.
 */
/** Où en est un contrat vis-à-vis du CRM : arrivé, en route, ou bloqué. */
function PastilleCrm({ arriveLe, signeLe }: { arriveLe: string | null; signeLe: string }) {
  if (arriveLe) {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        <CheckCircle2 className="h-3 w-3" />
        Dans le CRM depuis le {format(new Date(arriveLe), 'd MMM à HH:mm', { locale: fr })}
      </p>
    );
  }
  const bloque = Date.now() - new Date(signeLe).getTime() > 2 * 60_000;
  return bloque ? (
    <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
      <AlertTriangle className="h-3 w-3" />
      Pas encore dans le CRM — appuyez sur « Envoyer au CRM » ci-dessous
    </p>
  ) : (
    <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <Loader2 className="h-3 w-3 animate-spin" />
      En route vers le CRM…
    </p>
  );
}

function EnvoyerAuCrm({
  cliente,
  alerte,
  onEnvoye,
}: {
  cliente: Cliente;
  /** Un contrat n'est toujours pas dans le CRM : le bloc se fait voir. */
  alerte: boolean;
  onEnvoye: () => void;
}) {
  const envoi = useMutation({
    mutationFn: () => renvoyerAuCrm(cliente.id),
    onSuccess: (r) => {
      onEnvoye();
      if (r.echecs > 0) {
        toast.error(r.erreurs[0]?.message ?? "Le CRM n'a pas accepté l'envoi.");
        return;
      }
      toast.success(
        r.traitees === 0
          ? 'Le CRM était déjà à jour.'
          : `${r.traitees} envoi${r.traitees > 1 ? 's' : ''} au CRM`,
      );
    },
    onError: (e) =>
      toast.error(texteErreur(e) || "L'envoi au CRM n'a pas abouti."),
  });

  return (
    <section
      className={`carte flex flex-wrap items-center justify-between gap-4 px-5 py-4 ${
        alerte ? 'border-rose-300 bg-rose-50' : ''
      }`}
    >
      <div className="min-w-0 flex-1 basis-72">
        <h2 className={`text-sm font-semibold ${alerte ? 'text-rose-900' : 'text-ardoise-900'}`}>
          {alerte ? 'Un contrat n’est pas arrivé dans le CRM' : 'Envoyer au CRM'}
        </h2>
        <p className={`mt-0.5 text-xs ${alerte ? 'text-rose-800' : 'text-ardoise-500'}`}>
          {alerte
            ? 'Il est signé et enregistré ici, mais Airtable ne l’a pas reçu. Appuyez pour le renvoyer ; si ça échoue encore, le message dira pourquoi.'
            : 'Le contrat, les consentements et l’accès au parcours audio partent dans Airtable tout seuls. Ce bouton les repose dans la file quand ils n’y sont pas arrivés.'}
        </p>
      </div>
      <button
        onClick={() => envoi.mutate()}
        disabled={envoi.isPending}
        className={alerte ? 'bouton-fort' : 'bouton-principal'}
      >
        {envoi.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {envoi.isPending ? 'Envoi…' : 'Envoyer au CRM'}
      </button>
    </section>
  );
}
