import { useEffect, useRef, useState } from 'react';
import { Check, Eye, FileSignature, Headphones, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Signature, { type SignatureHandle } from './Signature';
import { ENGAGEMENTS, construireContrat, type ContractData } from '../../domain/contrat';
import { donnerAccesParcours, enregistrerContrat } from '../../services/metier';
import type { Centre, Cliente, Echeance, LigneProgramme, Programme } from '../../types/db';

interface Props {
  cliente: Cliente;
  centre: Centre;
  programme: Programme;
  lignes: LigneProgramme[];
  echeances: Echeance[];
  onFerme: () => void;
  onSigne: () => void;
}

interface DocumentAffiche {
  cle: string;
  titre: string;
  url: string;
}

function urlDepuisBase64(base64: string): string {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return URL.createObjectURL(new Blob([octets], { type: 'application/pdf' }));
}

const TITRE_CONSENTEMENT: Record<string, string> = {
  'luxo-pdp': 'Consentement Luxothérapie',
  ishape: 'Consentement Électrostimulation',
  presso: 'Consentement Pressodynamie',
};

export default function ModaleContrat({
  cliente,
  centre,
  programme,
  lignes,
  echeances,
  onFerme,
  onSigne,
}: Props) {
  const signature = useRef<SignatureHandle>(null);
  const [coches, setCoches] = useState<boolean[]>(ENGAGEMENTS.map(() => false));
  const [photos, setPhotos] = useState(true);
  const [signatureVide, setSignatureVide] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [parcoursAudio, setParcoursAudio] = useState<'A' | 'B' | 'C' | null>('A');

  const [documents, setDocuments] = useState<DocumentAffiche[]>([]);
  const [docActif, setDocActif] = useState<string | null>(null);
  const [vus, setVus] = useState<Set<string>>(new Set());
  const [preparation, setPreparation] = useState(true);

  const contrat: ContractData = construireContrat({ cliente, centre, programme, lignes, echeances });

  /*
    Les documents sont générés à l'ouverture, sans signature, pour être lus
    avec la cliente. Tant qu'un document n'a pas été ouvert, la signature
    reste bloquée : signer un texte qu'on n'a pas présenté n'a aucune valeur.
  */
  useEffect(() => {
    let annule = false;
    const urls: string[] = [];

    (async () => {
      try {
        const [{ generateSignedContractPdf }, { generateSignedConsents }] = await Promise.all([
          import('../../services/contratPdf'),
          import('../../services/consentementsPdf'),
        ]);

        const pdfContrat = await generateSignedContractPdf(contrat, '', []);
        const consentements = generateSignedConsents(
          contrat.activeServiceIds,
          cliente.prenom,
          cliente.nom,
          '',
          contrat.signatureDate,
          contrat.activeServiceIds.map(() => true),
        );

        if (annule) return;

        const liste: DocumentAffiche[] = [
          { cle: 'contrat', titre: 'Contrat de prestation', url: urlDepuisBase64(pdfContrat) },
          ...consentements.map((c) => ({
            cle: c.serviceId,
            titre: TITRE_CONSENTEMENT[c.serviceId] ?? c.filename.replace(/\.pdf$/, ''),
            url: urlDepuisBase64(c.pdfBase64),
          })),
        ];

        liste.forEach((d) => urls.push(d.url));
        setDocuments(liste);
        setDocActif(liste[0]?.cle ?? null);
        setVus(new Set(liste.length > 0 ? [liste[0].cle] : []));
      } catch (e) {
        console.error(e);
        toast.error("Les documents n'ont pas pu être préparés.");
      } finally {
        if (!annule) setPreparation(false);
      }
    })();

    return () => {
      annule = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // Générés une seule fois à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !enCours && onFerme();
    document.addEventListener('keydown', echap);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', echap);
      document.body.style.overflow = '';
    };
  }, [onFerme, enCours]);

  const tousLus = documents.length > 0 && vus.size >= documents.length;
  const tousCoches = coches.every(Boolean);
  const pret = tousLus && tousCoches && !signatureVide && !enCours;
  const restants = documents.length - vus.size;

  const manque = preparation
    ? 'Préparation des documents…'
    : !tousLus
      ? `Il reste ${restants} document${restants > 1 ? 's' : ''} à ouvrir.`
      : !tousCoches
        ? 'Cochez les quatre engagements pour continuer.'
        : signatureVide
          ? 'Il manque la signature.'
          : 'Prêt à signer.';

  async function signer() {
    const trace = signature.current?.lire();
    if (!trace) {
      toast.error('La signature est nécessaire.');
      return;
    }

    setEnCours(true);
    try {
      const [{ generateSignedContractPdf }, { generateSignedConsents }] = await Promise.all([
        import('../../services/contratPdf'),
        import('../../services/consentementsPdf'),
      ]);

      const pdf = await generateSignedContractPdf(contrat, trace, coches);
      const consentements = generateSignedConsents(
        contrat.activeServiceIds,
        cliente.prenom,
        cliente.nom,
        trace,
        contrat.signatureDate,
        contrat.activeServiceIds.map(() => photos),
      );

      await enregistrerContrat({
        clienteId: cliente.id,
        programmeId: programme.id,
        centreId: centre.id,
        nomCliente: `${cliente.prenom} ${cliente.nom}`,
        pdfBase64: pdf,
        donnees: contrat,
        consentements,
      });

      toast.success(
        consentements.length > 0
          ? `Contrat signé et ${consentements.length} consentement${consentements.length > 1 ? 's' : ''} enregistré${consentements.length > 1 ? 's' : ''}`
          : 'Contrat signé et enregistré',
      );

      // L'accès au parcours audio ne doit jamais faire échouer le contrat :
      // il est signé, il est enregistré. On signale l'échec, c'est tout.
      if (parcoursAudio && cliente.email) {
        try {
          const { dejaLa } = await donnerAccesParcours(cliente.id, parcoursAudio);
          toast.success(
            dejaLa
              ? `Parcours audio ${parcoursAudio} — la cliente avait déjà un compte`
              : `Parcours audio ${parcoursAudio} — invitation envoyée à ${cliente.email}`,
          );
        } catch (e) {
          toast.error(
            e instanceof Error
              ? e.message
              : "Le contrat est enregistré, mais l'accès au parcours audio a échoué.",
          );
        }
      }

      onSigne();
    } catch (e) {
      console.error(e);
      toast.error("Le contrat n'a pas pu être enregistré. Réessayez.");
      setEnCours(false);
    }
  }

  const doc = documents.find((d) => d.cle === docActif) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Signature du contrat"
        className="my-4 w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-carte"
      >
        <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ardoise-900">
              Contrat de prestation — {cliente.prenom} {cliente.nom}
            </h2>
            <p className="text-xs text-ardoise-500">
              Cure {programme.numero} · {contrat.totalAmount} · {contrat.installmentCount} échéance
              {contrat.installmentCount > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onFerme}
            disabled={enCours}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Lecture des documents ------------------------------------- */}
          <section>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                À lire avec la cliente
              </h3>
              <span
                className={`text-xs font-medium ${tousLus ? 'text-emerald-700' : 'text-ardoise-500'}`}
              >
                {vus.size} / {documents.length || '…'} ouvert{vus.size > 1 ? 's' : ''}
              </span>
            </div>

            {preparation ? (
              <div className="flex h-96 items-center justify-center rounded-xl border border-ardoise-200 bg-ardoise-50">
                <span className="flex items-center gap-2 text-sm text-ardoise-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Préparation des documents…
                </span>
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {documents.map((d) => {
                    const actif = d.cle === docActif;
                    const lu = vus.has(d.cle);
                    return (
                      <button
                        key={d.cle}
                        type="button"
                        onClick={() => {
                          setDocActif(d.cle);
                          setVus((v) => new Set(v).add(d.cle));
                        }}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          actif
                            ? 'border-marine-600 bg-marine-50 text-marine-900'
                            : 'border-ardoise-300 bg-white text-ardoise-600 hover:border-marine-400'
                        }`}
                      >
                        {lu ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                        ) : (
                          <Eye className="h-3.5 w-3.5 text-ardoise-400" />
                        )}
                        {d.titre}
                      </button>
                    );
                  })}
                </div>

                {doc && (
                  <iframe
                    key={doc.cle}
                    src={`${doc.url}#view=FitH`}
                    title={doc.titre}
                    className="h-96 w-full rounded-xl border border-ardoise-300 bg-ardoise-50"
                  />
                )}

                <p className="mt-2 text-xs text-ardoise-500">
                  Parcourez chaque document avec la cliente. Tant qu'un document n'a pas été
                  ouvert, la signature reste bloquée.
                </p>
              </>
            )}
          </section>

          {contrat.activeServiceIds.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-ardoise-50 px-4 py-3 text-sm text-ardoise-700">
              <input
                type="checkbox"
                checked={photos}
                onChange={(e) => setPhotos(e.target.checked)}
                className="h-4 w-4 rounded border-ardoise-300 text-marine-600 focus:ring-marine-500"
              />
              La cliente autorise la diffusion de ses photos sur les réseaux du centre
            </label>
          )}

          {/* Engagements ------------------------------------------------ */}
          <section>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
              À cocher avec la cliente
            </h3>
            <div className="space-y-2">
              {ENGAGEMENTS.map((texte, i) => (
                <label
                  key={i}
                  className={`flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
                    tousLus
                      ? 'cursor-pointer border-ardoise-200 text-ardoise-700 hover:bg-ardoise-50'
                      : 'cursor-not-allowed border-ardoise-100 text-ardoise-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={coches[i]}
                    disabled={!tousLus}
                    onChange={(e) =>
                      setCoches((c) => c.map((v, k) => (k === i ? e.target.checked : v)))
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-ardoise-300 text-marine-600 focus:ring-marine-500 disabled:opacity-40"
                  />
                  <span>{texte}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Parcours audio --------------------------------------------- */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
              <Headphones className="h-3.5 w-3.5" />
              Parcours audio
            </h3>

            {cliente.email ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {(['A', 'B', 'C'] as const).map((p) => {
                    const actif = parcoursAudio === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setParcoursAudio(p)}
                        aria-pressed={actif}
                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                          actif
                            ? 'border-marine-600 bg-marine-600 text-white'
                            : 'border-ardoise-300 bg-white text-ardoise-700 hover:border-marine-400'
                        }`}
                      >
                        Parcours {p}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setParcoursAudio(null)}
                    aria-pressed={parcoursAudio === null}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      parcoursAudio === null
                        ? 'border-ardoise-500 bg-ardoise-100 text-ardoise-800'
                        : 'border-ardoise-300 bg-white text-ardoise-500 hover:border-ardoise-400'
                    }`}
                  >
                    Aucun accès
                  </button>
                </div>
                <p className="mt-2 text-xs text-ardoise-500">
                  {parcoursAudio
                    ? `À la signature, ${cliente.prenom} recevra une invitation à ${cliente.email} pour créer son mot de passe.`
                    : "Aucun compte ne sera créé. L'accès pourra être donné plus tard."}
                </p>
              </>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Cette cliente n'a pas d'adresse email : l'invitation ne peut pas partir.
                Renseignez-la dans l'onglet Coordonnées pour lui donner accès au parcours audio.
              </p>
            )}
          </section>

          {/* Signature -------------------------------------------------- */}
          <section>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
              Signature — « Lu et approuvé »
            </h3>
            <Signature ref={signature} onChange={setSignatureVide} />
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ardoise-200 px-5 py-4">
          <p className={`text-xs ${pret ? 'text-emerald-700' : 'text-ardoise-500'}`}>{manque}</p>
          <div className="flex gap-3">
            <button onClick={onFerme} disabled={enCours} className="bouton-discret">
              Annuler
            </button>
            <button onClick={signer} disabled={!pret} className="bouton-fort">
              {enCours ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSignature className="h-4 w-4" />
              )}
              {enCours ? 'Génération…' : 'Signer le contrat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
