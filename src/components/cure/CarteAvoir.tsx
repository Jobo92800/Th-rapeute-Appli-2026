import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BadgeEuro, Loader2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  accorderAvoir,
  mouvementsAvoir,
  rembourserAvoir,
  soldeAvoir,
  utiliserAvoir,
} from '../../services/avoirs';
import { LIBELLE_SENS, avoirPosable, resteAEncaisser } from '../../domain/avoir';
import { formaterEuros } from '../../domain/tarification';
import type { Echeance, Programme } from '../../types/db';

const MOYENS: { valeur: string; libelle: string }[] = [
  { valeur: 'cheque', libelle: 'Chèque' },
  { valeur: 'especes', libelle: 'Espèces' },
  { valeur: 'cb', libelle: 'Carte bancaire' },
  { valeur: 'virement', libelle: 'Virement' },
];

type Geste = null | 'utiliser' | 'rembourser' | 'accorder';

/**
 * Ce que le centre doit encore à la cliente.
 *
 * Le solde ne se stocke pas : c'est la somme des mouvements — accordé,
 * utilisé, remboursé. On peut donc toujours dire d'où vient chaque euro,
 * et personne ne peut se retrouver avec un compteur qui ment.
 *
 * Un avoir vaut dans les cinq centres : c'est une dette de l'entreprise
 * envers la cliente, pas d'un centre en particulier.
 */
export default function CarteAvoir({
  clienteId,
  centreId,
  cures,
}: {
  clienteId: string;
  centreId: string;
  /** Les cures en cours, seules candidates à recevoir un avoir. */
  cures: { programme: Programme; echeances: Echeance[] }[];
}) {
  const qc = useQueryClient();
  const [geste, setGeste] = useState<Geste>(null);

  const { data: solde } = useQuery({
    queryKey: ['avoir', clienteId],
    queryFn: () => soldeAvoir(clienteId),
  });
  const { data: mouvements = [] } = useQuery({
    queryKey: ['avoir-mouvements', clienteId],
    queryFn: () => mouvementsAvoir(clienteId),
  });

  const montantSolde = Number(solde?.solde ?? 0);
  const jamaisRien = mouvements.length === 0;

  function rafraichir() {
    qc.invalidateQueries({ queryKey: ['avoir', clienteId] });
    qc.invalidateQueries({ queryKey: ['avoir-mouvements', clienteId] });
    qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
    qc.invalidateQueries({ queryKey: ['situations', centreId] });
    setGeste(null);
  }

  // Rien à montrer et rien à faire : on n'encombre pas l'écran d'une carte
  // vide. Le bouton d'ouverture reste accessible depuis l'en-tête de l'onglet.
  if (jamaisRien && geste === null) return null;

  return (
    <section className="carte overflow-hidden border-marine-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ardoise-100 bg-marine-50/60 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <BadgeEuro className="h-4 w-4 text-marine-700" />
          <div>
            <h2 className="text-sm font-semibold text-ardoise-900">Son avoir</h2>
            <p className="text-xs text-ardoise-500">
              Utilisable dans les 5 centres, ou remboursable en argent.
            </p>
          </div>
        </div>
        <span
          className={`chiffres text-2xl font-bold ${
            montantSolde > 0 ? 'text-marine-800' : 'text-ardoise-300'
          }`}
        >
          {formaterEuros(montantSolde, 2)}
        </span>
      </div>

      {montantSolde > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-ardoise-100 px-5 py-3">
          <button onClick={() => setGeste('utiliser')} className="bouton-fort">
            Utiliser sur une cure
          </button>
          <button onClick={() => setGeste('rembourser')} className="bouton-discret">
            Rembourser en argent
          </button>
        </div>
      )}

      {geste === 'utiliser' && (
        <Utiliser cures={cures} solde={montantSolde} onFini={rafraichir} onAnnule={() => setGeste(null)} />
      )}
      {geste === 'rembourser' && (
        <Rembourser
          clienteId={clienteId}
          solde={montantSolde}
          onFini={rafraichir}
          onAnnule={() => setGeste(null)}
        />
      )}
      {geste === 'accorder' && (
        <Accorder clienteId={clienteId} onFini={rafraichir} onAnnule={() => setGeste(null)} />
      )}

      {mouvements.length > 0 && (
        <div className="px-5 py-3">
          <h3 className="surtitre mb-1.5">Les mouvements</h3>
          <div className="space-y-0.5">
            {mouvements.map((m) => (
              <div
                key={m.id}
                className="flex items-baseline justify-between gap-3 border-b border-ardoise-50 py-1.5 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <span className="text-ardoise-700">{LIBELLE_SENS[m.sens]}</span>
                  <span className="ml-2 text-xs text-ardoise-400">
                    {format(new Date(m.date_avoir), 'd MMM yyyy', { locale: fr })}
                  </span>
                  {/* Le motif par défaut répète le libellé : on ne l'écrit pas deux fois. */}
                  {m.motif && m.motif !== LIBELLE_SENS[m.sens] && (
                    <div className="truncate text-xs text-ardoise-500">{m.motif}</div>
                  )}
                </div>
                <span
                  className={`chiffres shrink-0 font-semibold ${
                    m.sens === 'accorde' ? 'text-marine-700' : 'text-ardoise-500'
                  }`}
                >
                  {m.sens === 'accorde' ? '+' : '−'} {formaterEuros(Number(m.montant), 2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** Le bouton d'ouverture, quand la cliente n'a encore aucun mouvement. */
export function BoutonAvoir({
  clienteId,
  centreId,
}: {
  clienteId: string;
  centreId: string;
}) {
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="bouton-discret">
        <Plus className="h-4 w-4" />
        Faire un avoir
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Faire un avoir"
        className="my-8 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-carte"
      >
        <div className="flex items-center justify-between border-b border-ardoise-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ardoise-900">Faire un avoir</h2>
          <button
            onClick={() => setOuvert(false)}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <Accorder
          clienteId={clienteId}
          onFini={() => {
            qc.invalidateQueries({ queryKey: ['avoir', clienteId] });
            qc.invalidateQueries({ queryKey: ['avoir-mouvements', clienteId] });
            qc.invalidateQueries({ queryKey: ['situations', centreId] });
            setOuvert(false);
          }}
          onAnnule={() => setOuvert(false)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Les trois gestes
// ---------------------------------------------------------------------------

function Utiliser({
  cures,
  solde,
  onFini,
  onAnnule,
}: {
  cures: { programme: Programme; echeances: Echeance[] }[];
  solde: number;
  onFini: () => void;
  onAnnule: () => void;
}) {
  const candidates = cures
    .filter((c) => c.programme.statut !== 'abandonne')
    .map((c) => ({ ...c, reste: resteAEncaisser(c.echeances) }))
    .filter((c) => c.reste > 0);

  const [cureId, setCureId] = useState(candidates[0]?.programme.id ?? '');
  const choisie = candidates.find((c) => c.programme.id === cureId);
  const plafond = avoirPosable(solde, choisie?.reste ?? 0);
  const [montant, setMontant] = useState(String(plafond));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const envoyer = useMutation({
    mutationFn: () => utiliserAvoir(cureId, Number(montant.replace(',', '.')) || 0, date),
    onSuccess: () => {
      toast.success('Avoir déduit de son échéancier');
      onFini();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "L'avoir n'a pas pu être posé."),
  });

  if (candidates.length === 0) {
    return (
      <Cadre onAnnule={onAnnule}>
        <p className="text-sm text-ardoise-600">
          Aucune cure en cours n’attend de règlement. Son avoir l’attendra : il se posera sur sa
          prochaine cure, ou vous pouvez le lui rembourser.
        </p>
      </Cadre>
    );
  }

  return (
    <Cadre onAnnule={onAnnule} onValide={() => envoyer.mutate()} enCours={envoyer.isPending} valider="Déduire de l’échéancier">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="etiquette" htmlFor="avoir-cure">
            Sur quelle cure
          </label>
          <select
            id="avoir-cure"
            value={cureId}
            onChange={(e) => {
              setCureId(e.target.value);
              const c = candidates.find((x) => x.programme.id === e.target.value);
              setMontant(String(avoirPosable(solde, c?.reste ?? 0)));
            }}
            className="champ"
          >
            {candidates.map((c) => (
              <option key={c.programme.id} value={c.programme.id}>
                Cure {c.programme.numero} — {formaterEuros(c.reste, 2)} à encaisser
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="avoir-montant">
            Montant
          </label>
          <input
            id="avoir-montant"
            type="text"
            inputMode="decimal"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className="champ chiffres"
          />
        </div>
      </div>
      <div className="mt-3">
        <label className="etiquette" htmlFor="avoir-date-u">
          Le
        </label>
        <input
          id="avoir-date-u"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="champ"
        />
      </div>
      <p className="mt-2 text-xs text-ardoise-500">
        Le montant descend l’échéancier en partant de la dernière échéance. Le montant de la cure,
        lui, ne bouge pas : c’est ce qu’elle a signé.
      </p>
    </Cadre>
  );
}

function Rembourser({
  clienteId,
  solde,
  onFini,
  onAnnule,
}: {
  clienteId: string;
  solde: number;
  onFini: () => void;
  onAnnule: () => void;
}) {
  const [montant, setMontant] = useState(String(solde));
  const [moyen, setMoyen] = useState('cheque');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const envoyer = useMutation({
    mutationFn: () =>
      rembourserAvoir(clienteId, Number(montant.replace(',', '.')) || 0, moyen, date),
    onSuccess: () => {
      toast.success('Remboursement enregistré');
      onFini();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Le remboursement n'a pas pu être enregistré."),
  });

  return (
    <Cadre
      onAnnule={onAnnule}
      onValide={() => envoyer.mutate()}
      enCours={envoyer.isPending}
      valider="Enregistrer le remboursement"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="etiquette" htmlFor="remb-montant">
            Montant
          </label>
          <input
            id="remb-montant"
            type="text"
            inputMode="decimal"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className="champ chiffres"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="remb-moyen">
            Par
          </label>
          <select
            id="remb-moyen"
            value={moyen}
            onChange={(e) => setMoyen(e.target.value)}
            className="champ"
          >
            {MOYENS.map((m) => (
              <option key={m.valeur} value={m.valeur}>
                {m.libelle}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="remb-date">
            Le
          </label>
          <input
            id="remb-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="champ"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-ardoise-500">
        L’argent sort de la caisse : n’enregistrez le remboursement qu’une fois le chèque fait ou
        le virement parti.
      </p>
    </Cadre>
  );
}

function Accorder({
  clienteId,
  onFini,
  onAnnule,
}: {
  clienteId: string;
  onFini: () => void;
  onAnnule: () => void;
}) {
  const [montant, setMontant] = useState('');
  const [motif, setMotif] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const envoyer = useMutation({
    mutationFn: () => accorderAvoir(clienteId, Number(montant.replace(',', '.')) || 0, motif.trim(), date),
    onSuccess: () => {
      toast.success('Avoir accordé');
      onFini();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "L'avoir n'a pas pu être créé."),
  });

  return (
    <Cadre
      onAnnule={onAnnule}
      onValide={() => envoyer.mutate()}
      enCours={envoyer.isPending}
      valider="Accorder l’avoir"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="acc-montant">
            Montant
          </label>
          <input
            id="acc-montant"
            type="text"
            inputMode="decimal"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder="120"
            className="champ chiffres"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor="acc-date">
            Le
          </label>
          <input
            id="acc-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="champ"
          />
        </div>
      </div>
      <div className="mt-3">
        <label className="etiquette" htmlFor="acc-motif">
          Pourquoi
        </label>
        <input
          id="acc-motif"
          type="text"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Geste commercial — trois séances annulées de notre fait."
          className="champ"
        />
      </div>
    </Cadre>
  );
}

function Cadre({
  children,
  onAnnule,
  onValide,
  enCours,
  valider,
}: {
  children: React.ReactNode;
  onAnnule: () => void;
  onValide?: () => void;
  enCours?: boolean;
  valider?: string;
}) {
  return (
    <div className="border-b border-ardoise-100 bg-ardoise-50/60 px-5 py-4">
      {children}
      <div className="mt-4 flex justify-end gap-3">
        <button onClick={onAnnule} disabled={enCours} className="bouton-discret">
          Annuler
        </button>
        {onValide && (
          <button onClick={onValide} disabled={enCours} className="bouton-fort">
            {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
            {valider}
          </button>
        )}
      </div>
    </div>
  );
}
