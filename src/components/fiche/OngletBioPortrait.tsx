import { useState } from 'react';
import { texteErreur } from '../../lib/erreurs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, Loader2, Mail, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { redeposerBioPortrait, renvoyerRecap } from '../../services/recap';
import { laCliente, pronom } from '../../domain/civilite';
import type { Bilan, Civilite } from '../../types/db';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { bilansDeLaCliente, lireBaremeActif } from '../../services/metier';
import { SEUIL_PRESENCE, type Axe, AXES_PROFIL, AXES_TERRAIN } from '../../domain/bioportrait';

export default function OngletBioPortrait({
  clienteId,
  civilite,
}: {
  clienteId: string;
  civilite: Civilite;
}) {
  const qc = useQueryClient();
  const [confirme, setConfirme] = useState(false);

  const { data: bilans = [], isLoading } = useQuery({
    queryKey: ['bilans', clienteId],
    queryFn: () => bilansDeLaCliente(clienteId),
  });

  const { data: baremeData } = useQuery({
    queryKey: ['bareme'],
    queryFn: lireBaremeActif,
    staleTime: Infinity,
  });

  if (isLoading) {
    return <p className="carte px-5 py-10 text-center text-sm text-ardoise-400">Chargement…</p>;
  }

  const bilan = bilans.find((b) => b.statut === 'termine') ?? null;

  if (!bilan || !baremeData) {
    return (
      <div className="carte px-5 py-12 text-center">
        <p className="text-sm text-ardoise-600">Aucun bilan sur cette fiche.</p>
        <Link to="/bilan" className="bouton-fort mt-5">
          <Sparkles className="h-4 w-4" />
          Démarrer un Bilan BioPortrait
        </Link>
      </div>
    );
  }

  const { bareme } = baremeData;
  const pct = (bilan.scores ?? {}) as Record<Axe, number>;
  const dp = bilan.profil_dominant as Axe | null;
  const dt = bilan.terrain_dominant as Axe | null;
  const mesures = ((bilan.inbody as { mesures?: { libelle: string; valeur: string }[] })?.mesures) ?? [];

  return (
    <div className="space-y-5">
      <section className="carte px-6 py-7 text-center">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Bilan du {format(new Date(bilan.date_bilan), 'd MMMM yyyy', { locale: fr })}
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xl font-bold">
          <span className="text-marine-700">{dp ? bareme.AX[dp].name : '—'}</span>
          <span className="text-ardoise-300">×</span>
          <span className="text-rose-600">{dt ? bareme.AX[dt].name : '—'}</span>
        </p>
        <p className="mt-2 text-xs text-ardoise-500">
          {bilan.facturation === 'offert'
            ? `Bilan offert — ${laCliente(civilite)} a démarré son accompagnement`
            : bilan.facturation === 'facture'
              ? `Bilan facturé ${Number(bilan.montant_facture ?? 0).toLocaleString('fr-FR')} €`
              : 'Facturation à trancher'}
        </p>

        <Recapitulatif bilan={bilan} clienteId={clienteId} qc={qc} confirme={confirme} setConfirme={setConfirme} />
        <LeBioPortraitSeul bilan={bilan} clienteId={clienteId} qc={qc} />
      </section>

      {mesures.length > 0 && (
        <section className="carte p-5">
          <h2 className="mb-3 text-sm font-semibold text-ardoise-900">Analyse InBody</h2>
          <div className="flex flex-wrap gap-2">
            {mesures.map((m) => (
              <span
                key={m.libelle}
                className="rounded-lg border border-ardoise-200 bg-ardoise-50 px-3 py-1.5 text-xs text-ardoise-700"
              >
                <span className="font-semibold text-ardoise-900">{m.libelle}</span> · {m.valeur}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Colonne titre="Profil comportemental" axes={[...AXES_PROFIL]} pct={pct} dominant={dp} bareme={bareme} accent="bg-marine-600" />
        <Colonne titre="Terrain physiologique" axes={[...AXES_TERRAIN]} pct={pct} dominant={dt} bareme={bareme} accent="bg-rose-600" />
      </div>

      {bilan.texte_libre && (
        <section className="carte p-5">
          <h2 className="mb-2 text-sm font-semibold text-ardoise-900">
            Ce qu{'\u2019'}{pronom(civilite)} voulait transformer en priorité
          </h2>
          <p className="text-sm italic text-ardoise-700">« {bilan.texte_libre} »</p>
        </section>
      )}
    </div>
  );
}

function Colonne({
  titre,
  axes,
  pct,
  dominant,
  bareme,
  accent,
}: {
  titre: string;
  axes: Axe[];
  pct: Record<Axe, number>;
  dominant: Axe | null;
  bareme: { AX: Record<Axe, { name: string; note: string }> };
  accent: string;
}) {
  const tries = [...axes].sort((a, b) => (pct[b] ?? 0) - (pct[a] ?? 0));

  return (
    <section className="carte p-5">
      <h2 className="mb-4 text-sm font-semibold text-ardoise-900">{titre}</h2>
      <div className="space-y-3">
        {tries.map((a) => {
          const p = pct[a] ?? 0;
          const est = a === dominant;
          const present = p >= SEUIL_PRESENCE;
          return (
            <div key={a}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span
                  className={`text-sm ${est ? 'font-bold text-ardoise-900' : present ? 'font-medium text-ardoise-700' : 'text-ardoise-400'}`}
                >
                  {bareme.AX[a].name}
                </span>
                <span
                  className={`chiffres text-sm ${est ? 'font-bold text-ardoise-900' : 'text-ardoise-500'}`}
                >
                  {p}%
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-ardoise-200">
                <div
                  className={`h-full rounded-full ${est ? accent : present ? 'bg-ardoise-400' : 'bg-ardoise-300'}`}
                  style={{ width: `${p}%` }}
                />
                <span
                  className="absolute top-0 h-full w-px bg-ardoise-400/70"
                  style={{ left: `${SEUIL_PRESENCE}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

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
function LeBioPortraitSeul({
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

function Recapitulatif({
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
