import { AlertTriangle, Gift, Package, TrendingUp, Wallet } from 'lucide-react';
import { LIBELLES_TECHNOLOGIE, formaterEuros } from '../../domain/tarification';
import type { DonneesTableauDeBord } from '../../services/tableauDeBord';
import Repartition from './Repartition';
import CourbeMensuelle from './CourbeMensuelle';
import CourbeParCentre from './CourbeParCentre';
import TableauCroise from './TableauCroise';
import DernieresVentes from './DernieresVentes';
import { evolution, libelleEvolution } from '../../domain/tableauDeBord';

const LIBELLES_MOYEN: Record<string, string> = {
  cheque: 'Chèque',
  especes: 'Espèces',
  cb: 'Carte bancaire',
  virement: 'Virement',
  alma: 'Alma',
  non_precise: 'Non précisé',
  'non precise': 'Non précisé',
};

const LIBELLES_MODE: Record<string, string> = {
  comptant: 'Comptant',
  '4x_maison': '4 fois sans frais',
  '10x_alma': '10 fois Alma',
  inconnu: 'Inconnu (cure reprise du CRM)',
};

/**
 * Les chiffres eux-mêmes, séparés de la page qui les va chercher : c'est ce
 * qui permet de les regarder avec des données d'exemple avant de livrer.
 */
export default function ContenuTableauDeBord({
  data,
  nomAxe,
  tousCentres,
}: {
  data: DonneesTableauDeBord;
  nomAxe: (code: string) => string;
  tousCentres: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile
          libelle="Encaissé"
          valeur={formaterEuros(data.encaisse.total)}
          detail="Argent réellement rentré"
          evolution={evolution(data.encaisse.cures, data.encaisse.precedent)}
          accent
        />
        <Tuile
          libelle="Signé"
          valeur={formaterEuros(data.signe.montant)}
          detail={`${data.signe.nb} cure${data.signe.nb > 1 ? 's' : ''} validée${data.signe.nb > 1 ? 's' : ''}`}
          evolution={evolution(data.signe.montant, data.signe.precedent)}
        />
        <Tuile
          libelle="Séances faites"
          valeur={String(data.activite.seances)}
          detail={`${data.activite.bilans} bilan${data.activite.bilans > 1 ? 's' : ''} sur la période`}
        />
        <Tuile
          libelle="Nouvelles clientes"
          valeur={String(data.activite.nouvelles_clientes)}
          detail={`${data.activite.contrats_signes} contrat${data.activite.contrats_signes > 1 ? 's' : ''} signé${data.activite.contrats_signes > 1 ? 's' : ''}`}
        />
      </div>

      {/* Ce qui reste à encaisser --------------------------------- */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="carte p-5">
          <h2 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
            <Wallet className="h-3.5 w-3.5" />
            Reste à encaisser
          </h2>
          <p className="chiffres mt-2 text-3xl font-bold text-ardoise-900">
            {formaterEuros(data.attendu.reste)}
          </p>
          <p className="mt-1 text-xs text-ardoise-500">
            Sur toutes les cures en cours, période comprise ou non.
          </p>
        </div>

        <div
          className={`carte p-5 ${
            data.attendu.retard_nb > 0 ? 'border-rose-200 bg-rose-50' : ''
          }`}
        >
          <h2
            className={`flex items-center gap-2 text-2xs font-semibold uppercase tracking-widest ${
              data.attendu.retard_nb > 0 ? 'text-rose-700' : 'text-ardoise-400'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            En retard
          </h2>
          <p
            className={`chiffres mt-2 text-3xl font-bold ${
              data.attendu.retard_nb > 0 ? 'text-rose-700' : 'text-ardoise-900'
            }`}
          >
            {formaterEuros(data.attendu.retard_montant)}
          </p>
          <p
            className={`mt-1 text-xs ${
              data.attendu.retard_nb > 0 ? 'text-rose-700' : 'text-ardoise-500'
            }`}
          >
            {data.attendu.retard_nb} échéance{data.attendu.retard_nb > 1 ? 's' : ''} dont la
            date est passée.
          </p>
        </div>

        <div className="carte p-5">
          <h2 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
            <TrendingUp className="h-3.5 w-3.5" />
            À encaisser sous 7 jours
          </h2>
          <p className="chiffres mt-2 text-3xl font-bold text-ardoise-900">
            {formaterEuros(data.attendu.semaine_montant)}
          </p>
          <p className="mt-1 text-xs text-ardoise-500">
            {data.attendu.semaine_nb} échéance{data.attendu.semaine_nb > 1 ? 's' : ''} à venir.
          </p>
        </div>
      </section>

      <CourbeMensuelle mois={data.mensuel} />

      <CourbeParCentre donnees={data.mensuel_par_centre} />

      <section className="grid gap-4 lg:grid-cols-2">
        <Repartition
          titre="Signé par centre"
          format={formaterEuros}
          vide="Aucune cure signée sur cette période"
          lignes={data.par_centre.map((c) => ({
            libelle: c.centre,
            valeur: Number(c.montant),
            detail: `· ${c.nb}`,
          }))}
        />

        <Repartition
          titre="Signé par thérapeute"
          format={formaterEuros}
          vide="Aucune cure signée sur cette période"
          lignes={data.par_therapeute.map((t) => ({
            libelle: t.therapeute,
            valeur: Number(t.montant),
            detail: `· ${t.nb}`,
          }))}
        />
      </section>

      <TableauCroise croise={data.croise} />

      <DernieresVentes ventes={data.dernieres_ventes} />

      {/* Le détail ------------------------------------------------- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Repartition
          titre="D’où vient l’argent encaissé"
          format={formaterEuros}
          vide="Rien encaissé sur cette période"
          lignes={[
            { libelle: 'Échéances de cure', valeur: data.encaisse.cures },
            { libelle: 'Compléments alimentaires', valeur: data.encaisse.complements },
            { libelle: 'Bilans facturés', valeur: data.encaisse.bilans },
          ].filter((l) => l.valeur > 0)}
        />

        <Repartition
          titre="Encaissé par moyen de paiement"
          format={formaterEuros}
          lignes={data.encaisse.par_moyen.map((m) => ({
            libelle: LIBELLES_MOYEN[m.moyen] ?? m.moyen,
            valeur: Number(m.montant),
            detail: `· ${m.nb}`,
          }))}
        />

        <Repartition
          titre="Cures signées, par règlement"
          format={formaterEuros}
          vide="Aucune cure validée sur cette période"
          lignes={data.signe.par_mode.map((m) => ({
            libelle: LIBELLES_MODE[m.mode] ?? m.mode,
            valeur: Number(m.montant),
            detail: `· ${m.nb}`,
          }))}
        />

        <Repartition
          titre="Séances réalisées, par soin"
          vide="Aucune séance clôturée sur cette période"
          lignes={data.activite.par_technologie.map((t) => ({
            libelle:
              LIBELLES_TECHNOLOGIE[t.technologie as keyof typeof LIBELLES_TECHNOLOGIE] ??
              t.technologie,
            valeur: Number(t.nb),
          }))}
        />

        <Repartition
          titre="Profils BioPortrait des bilans"
          vide="Aucun bilan sur cette période"
          lignes={data.empreinte.profils.map((p) => ({
            libelle: nomAxe(p.code),
            valeur: Number(p.nb),
          }))}
        />

        <Repartition
          titre="Terrains BioPortrait des bilans"
          vide="Aucun bilan sur cette période"
          lignes={data.empreinte.terrains.map((t) => ({
            libelle: nomAxe(t.code),
            valeur: Number(t.nb),
          }))}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="carte p-5">
          <h2 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
            Panier moyen
          </h2>
          <p className="chiffres mt-2 text-3xl font-bold text-ardoise-900">
            {formaterEuros(data.signe.panier_moyen)}
          </p>
          {libelleEvolution(evolution(data.signe.panier_moyen, data.signe.panier_precedent)) && (
            <p className="mt-0.5 text-xs font-semibold text-ardoise-500">
              {libelleEvolution(evolution(data.signe.panier_moyen, data.signe.panier_precedent))}{' '}
              <span className="font-normal">sur la période précédente</span>
            </p>
          )}
          <p className="mt-1 text-xs text-ardoise-500">
            {data.signe.premieres} première{data.signe.premieres > 1 ? 's' : ''} cure
            {data.signe.premieres > 1 ? 's' : ''} · {data.signe.suivantes} cure
            {data.signe.suivantes > 1 ? 's' : ''} suivante{data.signe.suivantes > 1 ? 's' : ''}
          </p>
        </div>

        <div className="carte p-5">
          <h2 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
            <Gift className="h-3.5 w-3.5" />
            Parrainage
          </h2>
          <p className="chiffres mt-2 text-3xl font-bold text-ardoise-900">
            {data.parrainage.a_poser}
          </p>
          <p className="mt-1 text-xs text-ardoise-500">
            séance{data.parrainage.a_poser > 1 ? 's' : ''} offerte
            {data.parrainage.a_poser > 1 ? 's' : ''} à poser, chez {data.parrainage.marraines}{' '}
            marraine{data.parrainage.marraines > 1 ? 's' : ''}.
          </p>
        </div>

        <div className="carte p-5">
          <h2 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
            <Package className="h-3.5 w-3.5" />
            Stock à recommander
          </h2>
          {data.stock.alertes.length === 0 ? (
            <p className="mt-2 text-sm text-ardoise-500">Aucun produit sous son seuil.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {data.stock.alertes.map((a, i) => (
                <li key={`${a.centre_id}-${a.nom}-${i}`} className="flex justify-between text-sm">
                  <span className="truncate text-ardoise-700">
                    {a.nom}
                    {tousCentres && (
                      <span className="ml-1.5 text-xs text-ardoise-400">{a.centre_id}</span>
                    )}
                  </span>
                  <span
                    className={`chiffres shrink-0 font-semibold ${
                      a.quantite <= a.seuil_critique ? 'text-rose-700' : 'text-amber-700'
                    }`}
                  >
                    {a.quantite}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Tuile({
  libelle,
  valeur,
  detail,
  evolution: pct,
  accent = false,
}: {
  libelle: string;
  valeur: string;
  detail: string;
  /** Variation contre la période précédente. Null : pas de comparaison possible. */
  evolution?: number | null;
  accent?: boolean;
}) {
  const badge = libelleEvolution(pct ?? null);
  return (
    <div className={`carte px-5 py-4 ${accent ? 'border-marine-300 bg-marine-50' : ''}`}>
      <div
        className={`text-2xs font-semibold uppercase tracking-widest ${
          accent ? 'text-marine-700' : 'text-ardoise-400'
        }`}
      >
        {libelle}
      </div>
      <div
        className={`chiffres mt-1 text-3xl font-bold tracking-tight ${
          accent ? 'text-marine-900' : 'text-ardoise-900'
        }`}
      >
        {valeur}
      </div>
      <div className={`mt-0.5 flex flex-wrap items-baseline gap-2 text-xs ${accent ? 'text-marine-700' : 'text-ardoise-500'}`}>
        <span>{detail}</span>
        {badge && (
          <span
            className={`rounded-full px-1.5 py-px text-[11px] font-semibold ${
              badge === 'stable'
                ? 'bg-ardoise-100 text-ardoise-600'
                : badge.startsWith('+')
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
            }`}
            title="Comparé à la période précédente, de même durée"
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
