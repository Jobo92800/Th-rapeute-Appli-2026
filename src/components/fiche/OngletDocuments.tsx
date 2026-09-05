import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSignature, FileText, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useCentre } from '../../lib/session';
import {
  consentementsDuContrat,
  contratsDeLaCliente,
  lirePdfContrat,
  programmesDeLaCliente,
  renvoyerAuCrm,
} from '../../services/metier';
import ModaleContrat from '../contrat/ModaleContrat';
import CarteParcoursAudio from './CarteParcoursAudio';
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
                : 'Le contrat et les consentements sont signés au doigt, puis conservés ici.'}
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

      <CarteParcoursAudio cliente={cliente} />

      <EnvoyerAuCrm cliente={cliente} />

      {signature && actif && (
        <ModaleContrat
          cliente={cliente}
          centre={centre}
          programme={actif.programme}
          lignes={actif.lignes}
          echeances={actif.echeances}
          onFerme={() => setSignature(false)}
          onSigne={() => {
            setSignature(false);
            qc.invalidateQueries({ queryKey: ['contrats', cliente.id] });
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
function EnvoyerAuCrm({ cliente }: { cliente: Cliente }) {
  const envoi = useMutation({
    mutationFn: () => renvoyerAuCrm(cliente.id),
    onSuccess: (r) => {
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
      toast.error(e instanceof Error ? e.message : "L'envoi au CRM n'a pas abouti."),
  });

  return (
    <section className="carte flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1 basis-72">
        <h2 className="text-sm font-semibold text-ardoise-900">Envoyer au CRM</h2>
        <p className="mt-0.5 text-xs text-ardoise-500">
          Le contrat, les consentements et l’accès au parcours audio partent dans Airtable tout
          seuls. Ce bouton les repose dans la file quand ils n’y sont pas arrivés.
        </p>
      </div>
      <button onClick={() => envoi.mutate()} disabled={envoi.isPending} className="bouton-principal">
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
