import { useState } from 'react';
import { useQuery, type useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ListChecks, Sparkles, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { laCliente } from '../../domain/civilite';
import {
  AXES_ANTI_AGE,
  TERRAINS_ANTI_AGE,
  nomDuTerrain,
  relireLesReponsesAntiAge,
  type AxeAntiAge,
  type ProfilAntiAge,
  type ReponsesAntiAge,
  type TerrainAntiAge,
} from '../../domain/antiAge';
import { lireBaremeAntiAge } from '../../services/metier';
import { texteErreur } from '../../lib/erreurs';
import type { Bilan, Civilite } from '../../types/db';
import { LeBioPortraitSeul, Recapitulatif } from './DocumentsDuBilan';

/*
  Le Bio-Portrait Anti-Âge, tel qu'il se relit sur la fiche.

  Même place que le BioPortrait de la perte de poids, autre lecture : un
  profil anti-âge et un terrain cutané, des scores en points plutôt qu'en
  pourcentages, pas d'InBody. Le récapitulatif, le document au dossier et
  la carte « Mes réponses » sont les mêmes gestes que sur l'autre bilan.
*/
export default function BioPortraitAntiAgeSurFiche({
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
    queryKey: ['bareme-anti-age', bilan.bareme_version],
    queryFn: () => lireBaremeAntiAge(bilan.bareme_version),
    staleTime: Infinity,
  });

  if (error) {
    return <p className="carte px-5 py-6 text-sm text-rose-700">Le barème anti-âge n’a pas pu être lu : {texteErreur(error)}</p>;
  }
  if (!bareme) {
    return <p className="carte px-5 py-10 text-center text-sm text-ardoise-400">Chargement…</p>;
  }

  const scores = (bilan.scores ?? {}) as Record<string, number>;
  const profil = bareme.PROFILS[(bilan.profil_dominant ?? 'global') as ProfilAntiAge] ?? bareme.PROFILS.global;
  const terrains = [bilan.terrain_dominant, ...(bilan.terrains_secondaires ?? [])].filter(
    (t): t is TerrainAntiAge => Boolean(t) && t! in bareme.TERRAINS,
  );
  const maxProfil = Math.max(1, ...AXES_ANTI_AGE.map((a) => scores[a] ?? 0));
  const maxTerrain = Math.max(1, ...TERRAINS_ANTI_AGE.map((t) => scores[`terrain_${t}`] ?? 0));
  const relues = relireLesReponsesAntiAge(bareme, (bilan.reponses ?? {}) as ReponsesAntiAge);

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
                    actif ? 'border-marine-600 bg-marine-600 text-white' : 'border-ardoise-200 bg-white text-ardoise-600 hover:border-marine-400'
                  }`}
                >
                  {format(new Date(b.date_bilan), 'd MMM yyyy', { locale: fr })}
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
          <button type="button" onClick={() => setReponsesOuvertes((o) => !o)} aria-pressed={reponsesOuvertes} className="bouton-discret">
            <ListChecks className="h-4 w-4" />
            Mes réponses
          </button>
          <Link to={`/bilan-anti-age?cliente=${clienteId}`} className="bouton-discret">
            <Sparkles className="h-4 w-4" />
            Refaire le point
          </Link>
          <Link to={`/bilan?cliente=${clienteId}`} className="bouton-discret" title="Le BioPortrait de la perte de poids, sur cette même fiche">
            <Sparkles className="h-4 w-4 text-marine-600" />
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
                Bio-Portrait Anti-Âge du {format(new Date(bilan.date_bilan), 'd MMMM yyyy', { locale: fr })}
              </p>
            </div>
            <button type="button" onClick={() => setReponsesOuvertes(false)} className="bouton-discret text-xs">
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
                      <span key={rep} className="inline-block rounded-full bg-rose-100 px-2.5 py-1 text-[13px] font-semibold leading-tight text-rose-800">
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
          Bio-Portrait Anti-Âge du {format(new Date(bilan.date_bilan), 'd MMMM yyyy', { locale: fr })}
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xl font-bold">
          <span className="text-marine-700">{profil.nom}</span>
          <span className="text-ardoise-300">×</span>
          <span className="text-rose-600">{nomDuTerrain(bareme, terrains)}</span>
        </p>
        <p className="mt-2 text-xs text-ardoise-500">
          {bilan.facturation === 'offert'
            ? `Bilan offert — ${laCliente(civilite)} a démarré son accompagnement`
            : bilan.facturation === 'facture'
              ? `Première séance facturée ${Number(bilan.montant_facture ?? 0).toLocaleString('fr-FR')} €`
              : 'Facturation à trancher'}
        </p>
        <Recapitulatif bilan={bilan} clienteId={clienteId} qc={qc} confirme={confirme} setConfirme={setConfirme} />
        <LeBioPortraitSeul bilan={bilan} clienteId={clienteId} qc={qc} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="carte p-5">
          <h2 className="text-sm font-semibold text-ardoise-900">Profil anti-âge</h2>
          <p className="mt-1 text-lg font-bold text-marine-700">{profil.nom}</p>
          <p className="mt-2 text-sm leading-relaxed text-ardoise-700">{profil.texte}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profil.besoins.map((b) => (
              <span key={b} className="rounded-md border border-ardoise-200 bg-white px-2 py-1 text-xs text-ardoise-600">{b}</span>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {AXES_ANTI_AGE.map((a: AxeAntiAge) => (
              <Barre key={a} nom={bareme.AXES[a]} valeur={scores[a] ?? 0} max={maxProfil} couleur="bg-marine-500" />
            ))}
          </div>
        </section>

        <section className="carte p-5">
          <h2 className="text-sm font-semibold text-ardoise-900">Terrain cutané</h2>
          <p className="mt-1 text-lg font-bold text-rose-600">{nomDuTerrain(bareme, terrains)}</p>
          {terrains.map((t) => (
            <p key={t} className="mt-2 text-sm leading-relaxed text-ardoise-700">{bareme.TERRAINS[t].texte}</p>
          ))}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...new Set(terrains.flatMap((t) => bareme.TERRAINS[t].besoins))].map((b) => (
              <span key={b} className="rounded-md border border-ardoise-200 bg-white px-2 py-1 text-xs text-ardoise-600">{b}</span>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {TERRAINS_ANTI_AGE.map((t) => (
              <Barre key={t} nom={bareme.TERRAINS[t].nom} valeur={scores[`terrain_${t}`] ?? 0} max={maxTerrain} couleur="bg-rose-500" />
            ))}
          </div>
        </section>
      </div>

      <p className="px-2 text-xs text-ardoise-400">{bareme.MENTION}</p>
    </div>
  );
}

function Barre({ nom, valeur, max, couleur }: { nom: string; valeur: number; max: number; couleur: string }) {
  const marque = valeur > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-sm ${marque ? 'font-semibold text-ardoise-800' : 'text-ardoise-400'}`}>{nom}</span>
        <span className={`chiffres text-sm font-semibold ${marque ? 'text-ardoise-700' : 'text-ardoise-400'}`}>
          {valeur} pt{valeur > 1 ? 's' : ''}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ardoise-200">
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${(valeur / max) * 100}%` }} />
      </div>
    </div>
  );
}
