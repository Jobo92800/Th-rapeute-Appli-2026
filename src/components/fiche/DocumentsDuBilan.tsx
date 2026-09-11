import { useMutation, type useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { texteErreur } from '../../lib/erreurs';
import { redeposerBioPortrait, renvoyerRecap } from '../../services/recap';
import type { Bilan } from '../../types/db';

/*
  Les deux documents d'un bilan, tels qu'ils se relisent sur la fiche : le
  récapitulatif parti par mail, et le BioPortrait gardé au dossier. Les
  mêmes gestes pour le BioPortrait de la perte de poids et pour le
  Bio-Portrait Anti-Âge — c'est pourquoi ils vivent à part.
*/

/**
 * Le récapitulatif envoyé à la cliente : son état, et le renvoi.
 *
 * On renvoie le document déjà établi, jamais un document refabriqué. Entre
 * les deux, les prix ont pu changer et la thérapeute a pu ajuster : la
 * cliente doit recevoir ce qu'on lui a promis, à l'identique.
 */
/**
 * Le BioPortrait seul : le diagnostic, sans un mot sur la cure ni sur le prix.
 *
 * Il est fabriqué à la fin de chaque bilan et gardé au dossier. Deux gestes
 * ici : le télécharger — pour l'imprimer ou le joindre à un mail écrit à la
 * main — et le redéposer dans le CRM si le dépôt avait échoué.
 *
 * Aucun bouton n'envoie de mail. C'est ce qui le distingue du
 * récapitulatif : celui-là part tout seul, celui-ci se garde.
 */
export function LeBioPortraitSeul({
  bilan,
  clienteId,
  qc,
}: {
  bilan: Bilan;
  clienteId: string;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const depot = useMutation({
    mutationFn: () => redeposerBioPortrait(bilan.id),
    onSuccess: () => {
      toast.success('Le BioPortrait repart vers le CRM');
      qc.invalidateQueries({ queryKey: ['bilans', clienteId] });
    },
    onError: (e) => toast.error(texteErreur(e) || "Le BioPortrait n'a pas pu être redéposé."),
  });

  if (!bilan.bioportrait_pdf) {
    return (
      <p className="mt-2 text-xs text-ardoise-400">
        Le BioPortrait seul n’a pas été gardé pour ce bilan : il date d’avant cette
        fonction. Les bilans suivants l’auront.
      </p>
    );
  }

  /*
    Le PDF est rangé en base64 : on le rend au navigateur tel quel, sans
    repasser par le réseau. Rien à télécharger d'ailleurs.
  */
  function telecharger() {
    const lien = document.createElement('a');
    lien.href = `data:application/pdf;base64,${bilan.bioportrait_pdf}`;
    lien.download = `BioPortrait_${bilan.date_bilan?.slice(0, 10) ?? ''}.pdf`;
    lien.click();
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-3 border-t border-ardoise-100 pt-3">
      <span className="text-xs text-ardoise-500">
        {bilan.bioportrait_depose_le
          ? 'BioPortrait au dossier, et dans le CRM'
          : 'BioPortrait au dossier · dépôt dans le CRM en attente'}
      </span>
      <button onClick={telecharger} className="bouton-discret text-xs">
        <Download className="h-3.5 w-3.5" />
        Télécharger
      </button>
      {!bilan.bioportrait_depose_le && (
        <button
          onClick={() => depot.mutate()}
          disabled={depot.isPending}
          className="bouton-discret text-xs"
        >
          {depot.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Redéposer dans le CRM
        </button>
      )}
    </div>
  );
}

export function Recapitulatif({
  bilan,
  clienteId,
  qc,
  confirme,
  setConfirme,
}: {
  bilan: Bilan;
  clienteId: string;
  qc: ReturnType<typeof useQueryClient>;
  confirme: boolean;
  setConfirme: (v: boolean) => void;
}) {
  const envoi = useMutation({
    mutationFn: () => renvoyerRecap(bilan.id),
    onSuccess: () => {
      toast.success('Le récapitulatif repart par mail');
      qc.invalidateQueries({ queryKey: ['bilans', clienteId] });
      setConfirme(false);
    },
    onError: (e) =>
      toast.error(texteErreur(e) || "Le récapitulatif n'a pas pu être renvoyé."),
  });

  if (!bilan.recap_pdf) {
    return (
      <p className="mt-4 border-t border-ardoise-100 pt-3 text-xs text-ardoise-400">
        Aucun récapitulatif n’a encore été envoyé. Il part du dernier écran d’un bilan,
        avec le bouton « Bilan seul ».
      </p>
    );
  }

  const envoye = bilan.recap_envoye_le;
  const enAttente = bilan.recap_demande_le && !envoye;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-3 border-t border-ardoise-100 pt-3">
      <span className="text-xs text-ardoise-500">
        {enAttente
          ? 'Récapitulatif en cours d’envoi…'
          : `Récapitulatif envoyé le ${format(new Date(envoye!), 'd MMMM yyyy', { locale: fr })}`}
      </span>
      {!confirme ? (
        <button onClick={() => setConfirme(true)} className="bouton-discret text-xs">
          <Mail className="h-3.5 w-3.5" />
          Le renvoyer
        </button>
      ) : (
        <span className="flex items-center gap-2">
          <button
            onClick={() => envoi.mutate()}
            disabled={envoi.isPending}
            className="bouton-fort text-xs"
          >
            {envoi.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirmer le renvoi
          </button>
          <button onClick={() => setConfirme(false)} className="bouton-discret text-xs">
            Annuler
          </button>
        </span>
      )}
    </div>
  );
}
