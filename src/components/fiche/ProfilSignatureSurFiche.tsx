import { useState } from 'react';
import { useQuery, type useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ListChecks, Sparkles, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { laCliente } from '../../domain/civilite';
import {
  AXES_SIGNATURE,
  COULEUR_COTATION,
  LIBELLES_COTATION,
  nomDuTerrainSignature,
  relireLesReponsesSignature,
  type AxeSignature,
  type CarteDesZones,
  type Cotation,
  type ProfilSignature,
  type ReponsesSignature,
  type TerrainSignature,
} from '../../domain/profilSignature';
import { lireBaremeSignature } from '../../services/metier';
import { texteErreur } from '../../lib/erreurs';
import type { Bilan, Civilite } from '../../types/db';
import { LeBioPortraitSeul, Recapitulatif } from './DocumentsDuBilan';

/*
  Le Profil Signature, tel qu'il se relit sur la fiche.

  Il porte une chose que les deux autres bilans n'ont pas : LA CARTE DES
  ZONES, ce que la thérapeute a vu ce jour-là. Elle se relit ici telle
  qu'elle a été cotée — c'est la moitié de chaque axe, et c'est elle qui a
  décidé de la cure. Six mois plus tard, la comparer à une nouvelle
  observation est tout l'intérêt du suivi.
*/

const LIBELLES_AXES: Record<AxeSignature, string> = {
  fermete: 'Fermeté',
  rides: 'Rides',
  hydratation: 'Hydratation / Qualité',
  densite: 'Densité',
};

export default function ProfilSignatureSurFiche({
  bilan,
  bilans,
  clienteId,
  civilite,
  qc,
  confirme,
  setConfirme,
  onChoisir,
}: {
  bilan: Bilan;
  bilans: Bilan[];
  clienteId: string;
  civilite: Civilite;
  qc: ReturnType<typeof useQueryClient>;
  confirme: boolean;
  setConfirme: (v: boolean) => void;
  onChoisir: (id: string) => void;
}) {
  const [reponsesOuvertes, setReponsesOuvertes] = useState(false);
  const { data: bareme, error } = useQuery({
    queryKey: ['bareme-signature', bilan.bareme_version],
    queryFn: () => lireBaremeSignature(bilan.bareme_version),
    staleTime: Infinity,
  });

  if (error) {
    return (
      <p className="carte px-5 py-6 text-sm text-rose-700">
        Le questionnaire du Profil Signature n’a pas pu être lu : {texteErreur(error)}
      </p>
    );
  }
  if (!bareme) {
    return <p className="carte px-5 py-10 text-center text-sm text-ardoise-400">Chargement…</p>;
  }

  const scores = (bilan.scores ?? {}) as Record<string, number>;
  const profil =
    bareme.PROFILS[(bilan.profil_dominant ?? 'global') as ProfilSignature] ?? bareme.PROFILS.global;
  const terrains = [bilan.terrain_dominant, ...(bilan.terrains_secondaires ?? [])].filter(
    (t): t is TerrainSignature => Boolean(t) && (t as string) in bareme.TERRAINS,
  );
  const carte = (bilan.observation ?? {}) as CarteDesZones;
  const relues = relireLesReponsesSignature(bareme, (bilan.reponses ?? {}) as ReponsesSignature);
  const cotees = bareme.ZONES.filter((z) => (carte[z.code] ?? 0) > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {bilans.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {bilans.map((b, rang) => {
              const actif = b.id === bilan.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onChoisir(b.id)}
                  aria-pressed={actif}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    actif
                      ? 'border-marine-600 bg-marine-600 text-white'
                      : 'border-ardoise-200 bg-white text-ardoise-600 hover:border-marine-400'
                  }`}
                >
                  {format(new Date(b.date_bilan), 'd MMM yyyy', { locale: fr })}
                  {b.famille === 'signature' && <span className="ml-1.5 opacity-70">· signature</span>}
                  {b.famille === 'anti_age' && <span className="ml-1.5 opacity-70">· anti-âge</span>}
                  {rang === 0 && <span className="ml-1.5 opacity-70">· le dernier</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReponsesOuvertes((o) => !o)}
            aria-pressed={reponsesOuvertes}
            className="bouton-discret"
          >
            <ListChecks className="h-4 w-4" />
            Ses réponses
          </button>
          <Link to={`/bilan-signature?cliente=${clienteId}`} className="bouton-discret">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Refaire le point
          </Link>
          <Link
            to={`/bilan?cliente=${clienteId}`}
            className="bouton-discret"
            title="Le BioPortrait de la perte de poids, sur cette même fiche"
          >
            <Sparkles className="h-4 w-4 text-marine-700" />
            Bilan perte de poids
          </Link>
        </div>
      </div>

      {reponsesOuvertes && (
        <section className="carte">
          <div className="flex items-start justify-between gap-3 border-b border-ardoise-100 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-ardoise-900">Ses réponses au questionnaire</h2>
              <p className="text-xs text-ardoise-500">
                Profil Signature du {format(new Date(bilan.date_bilan), 'd MMMM yyyy', { locale: fr })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReponsesOuvertes(false)}
              className="bouton-discret text-xs"
            >
              <X className="h-4 w-4" />
              Fermer
            </button>
          </div>
          <dl className="p-4 sm:columns-2 sm:gap-4">
            {relues.map((r) => (
              <div key={r.code} className="mb-3 break-inside-avoid">
                <dt className="text-[13px] leading-snug text-ardoise-600">{r.question}</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.reponses.length === 0 ? (
                    <span className="text-xs text-ardoise-400">Sans réponse</span>
                  ) : (
                    r.reponses.map((rep) => (
                      <span
                        key={rep}
                        className="inline-block rounded-full bg-violet-50 px-2.5 py-1 text-[13px] font-semibold leading-tight text-violet-600"
                      >
                        {rep}
                      </span>
                    ))
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="carte px-6 py-7 text-center">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          Profil Signature du {format(new Date(bilan.date_bilan), 'd MMMM yyyy', { locale: fr })}
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xl font-bold">
          <span className="text-violet-600">{profil.nom}</span>
          <span className="text-ardoise-300">×</span>
          <span className="text-marine-700">{nomDuTerrainSignature(bareme, terrains)}</span>
        </p>
        <p className="mt-2 text-xs text-ardoise-500">
          {bilan.facturation === 'offert'
            ? `Premier rendez-vous compris dans la cure — ${laCliente(civilite)} a démarré`
            : bilan.facturation === 'facture'
              ? `Premier rendez-vous facturé ${Number(bilan.montant_facture ?? 0).toLocaleString('fr-FR')} €`
              : 'Facturation à trancher'}
        </p>
        <Recapitulatif
          bilan={bilan}
          clienteId={clienteId}
          qc={qc}
          confirme={confirme}
          setConfirme={setConfirme}
        />
        <LeBioPortraitSeul bilan={bilan} clienteId={clienteId} qc={qc} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="carte p-5">
          <h2 className="text-sm font-semibold text-ardoise-900">Profil Signature</h2>
          <p className="mt-1 text-lg font-bold text-violet-600">{profil.nom}</p>
          <p className="mt-2 text-sm leading-relaxed text-ardoise-700">{profil.texte}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profil.besoins.map((b) => (
              <span
                key={b}
                className="rounded-md border border-ardoise-200 bg-white px-2 py-1 text-xs text-ardoise-600"
              >
                {b}
              </span>
            ))}
          </div>
          <p className="mt-3 border-t border-ardoise-100 pt-3 text-[13px] text-ardoise-600">
            {profil.radiofrequence}
          </p>

          <div className="mt-4 space-y-2">
            {AXES_SIGNATURE.map((a) => (
              <div key={a} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-xs text-ardoise-600">{LIBELLES_AXES[a]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-ardoise-100">
                  <span
                    className="block h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.min(100, scores[a] ?? 0)}%` }}
                  />
                </span>
                <span className="chiffres w-10 shrink-0 text-right text-xs font-bold text-ardoise-900">
                  {Math.min(100, Math.round(scores[a] ?? 0))} %
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="carte p-5">
          <h2 className="text-sm font-semibold text-ardoise-900">Terrain cutané</h2>
          <p className="mt-1 text-lg font-bold text-marine-700">
            {nomDuTerrainSignature(bareme, terrains)}
          </p>
          {terrains.map((t) => (
            <p key={t} className="mt-2 text-sm leading-relaxed text-ardoise-700">
              {bareme.TERRAINS[t].texte}
              {bareme.TERRAINS[t].consigne ? ` ${bareme.TERRAINS[t].consigne}` : ''}
            </p>
          ))}

          {/*
            Ce que la thérapeute a vu ce jour-là. C'est la moitié de chaque
            axe et toute la cure : sans cette carte, on ne saurait pas
            pourquoi dix séances plutôt que quatre.
          */}
          <h3 className="mt-5 text-sm font-semibold text-ardoise-900">Les zones observées</h3>
          {cotees.length === 0 ? (
            <p className="mt-1 text-sm text-ardoise-500">Aucune zone cotée sur ce bilan.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {cotees.map((z) => (
                <li key={z.code} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ardoise-700">{z.nom}</span>
                  <span
                    style={{
                      background: COULEUR_COTATION[(carte[z.code] ?? 0) as Cotation].fond,
                      color: COULEUR_COTATION[(carte[z.code] ?? 0) as Cotation].texte,
                    }}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
                  >
                    {LIBELLES_COTATION[(carte[z.code] ?? 0) as Cotation]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-ardoise-400">{bareme.MENTION}</p>
    </div>
  );
}
