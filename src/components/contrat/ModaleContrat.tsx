import { useEffect, useRef, useState } from 'react';
import { FileSignature, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Signature, { type SignatureHandle } from './Signature';
import { ENGAGEMENTS, construireContrat, type ContractData } from '../../domain/contrat';
import { enregistrerContrat } from '../../services/metier';
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

  const contrat: ContractData = construireContrat({ cliente, centre, programme, lignes, echeances });
  const tousCoches = coches.every(Boolean);
  const pret = tousCoches && !signatureVide && !enCours;

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !enCours && onFerme();
    document.addEventListener('keydown', echap);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', echap);
      document.body.style.overflow = '';
    };
  }, [onFerme, enCours]);

  async function signer() {
    const trace = signature.current?.lire();
    if (!trace) {
      toast.error('La signature est nécessaire.');
      return;
    }

    setEnCours(true);
    try {
      // jsPDF pèse près d'un mégaoctet : on ne le charge qu'au moment de signer,
      // pas au démarrage de l'application.
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
      onSigne();
    } catch (e) {
      console.error(e);
      toast.error("Le contrat n'a pas pu être enregistré. Réessayez.");
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Signature du contrat"
        className="my-4 w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-carte"
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
          {/* Ce que la cliente signe */}
          <section>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
              Prestations au contrat
            </h3>
            <div className="rounded-xl border border-ardoise-200">
              {contrat.careItems
                .filter((c) => c.checked)
                .map((c) => (
                  <div
                    key={c.label}
                    className="flex items-center justify-between border-b border-ardoise-100 px-4 py-2 text-sm last:border-0"
                  >
                    <span className="text-ardoise-800">{c.label}</span>
                    <span className="chiffres text-ardoise-500">{c.sessions} séances</span>
                  </div>
                ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
              Échéancier
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {contrat.deposit && (
                <Case libelle="Acompte" montant={contrat.deposit.amount} date={contrat.deposit.date} />
              )}
              {contrat.installments.map((e) => (
                <Case key={e.label} libelle={e.label} montant={e.amount} date={e.date} />
              ))}
            </div>
          </section>

          {contrat.activeServiceIds.length > 0 && (
            <section className="rounded-xl bg-ardoise-50 px-4 py-3">
              <p className="text-sm text-ardoise-700">
                <strong className="font-semibold">
                  {contrat.activeServiceIds.length} consentement
                  {contrat.activeServiceIds.length > 1 ? 's' : ''}
                </strong>{' '}
                {contrat.activeServiceIds.length > 1 ? 'seront générés' : 'sera généré'} avec la même
                signature, selon les technologies prescrites.
              </p>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-ardoise-700">
                <input
                  type="checkbox"
                  checked={photos}
                  onChange={(e) => setPhotos(e.target.checked)}
                  className="h-4 w-4 rounded border-ardoise-300 text-marine-600 focus:ring-marine-500"
                />
                La cliente autorise la diffusion de ses photos sur les réseaux du centre
              </label>
            </section>
          )}

          {/* Engagements */}
          <section>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
              À lire et cocher avec la cliente
            </h3>
            <div className="space-y-2">
              {ENGAGEMENTS.map((texte, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer gap-2.5 rounded-lg border border-ardoise-200 px-3 py-2.5 text-sm text-ardoise-700 hover:bg-ardoise-50"
                >
                  <input
                    type="checkbox"
                    checked={coches[i]}
                    onChange={(e) =>
                      setCoches((c) => c.map((v, k) => (k === i ? e.target.checked : v)))
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-ardoise-300 text-marine-600 focus:ring-marine-500"
                  />
                  <span>{texte}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Signature */}
          <section>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
              Signature — « Lu et approuvé »
            </h3>
            <Signature ref={signature} onChange={setSignatureVide} />
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ardoise-200 px-5 py-4">
          <p className="text-xs text-ardoise-500">
            {!tousCoches
              ? 'Cochez les quatre engagements pour continuer.'
              : signatureVide
                ? 'Il manque la signature.'
                : 'Prêt à signer.'}
          </p>
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

function Case({ libelle, montant, date }: { libelle: string; montant: string; date: string }) {
  return (
    <div className="rounded-lg border border-ardoise-200 bg-ardoise-50 px-3 py-2">
      <div className="text-2xs font-semibold uppercase tracking-wide text-ardoise-400">
        {libelle}
      </div>
      <div className="chiffres text-sm font-bold text-ardoise-900">{montant}</div>
      {date && <div className="text-2xs text-ardoise-400">le {date}</div>}
    </div>
  );
}
