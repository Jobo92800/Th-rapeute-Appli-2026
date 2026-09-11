import { ArrowRight, Check, ChevronLeft } from 'lucide-react';
import {
  AXES_ANTI_AGE,
  TERRAINS_ANTI_AGE,
  nomDuTerrain,
  type BaremeAntiAge,
  type BioPortraitAntiAge,
} from '../../domain/antiAge';

/*
  La restitution du Bio-Portrait Anti-Âge, tournée vers la cliente.

  Deux cartes — le profil, le terrain — avec les mots du document : signes,
  besoins, texte cliente. Les scores se lisent en barres, sans pourcentage :
  ce sont des points, pas des parts d'un tout, et un « 7 / 12 » n'aurait
  rien dit à personne. Aucun soin, aucun prix : l'offre vient après, et
  c'est la thérapeute qui la décide.
*/
export default function RestitutionAntiAge({
  bareme,
  resultat,
  prenom,
  onRetour,
  onSuite,
  onEnregistrerSeulement,
  enregistrement,
}: {
  bareme: BaremeAntiAge;
  resultat: BioPortraitAntiAge;
  prenom: string;
  onRetour: () => void;
  onSuite: () => void;
  onEnregistrerSeulement?: () => void;
  enregistrement?: boolean;
}) {
  const profil = bareme.PROFILS[resultat.profil];
  const terrainNom = nomDuTerrain(bareme, resultat.terrains);
  const maxProfil = Math.max(1, ...AXES_ANTI_AGE.map((a) => resultat.scores[a]));
  const maxTerrain = Math.max(1, ...TERRAINS_ANTI_AGE.map((t) => resultat.scoresTerrain[t]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="carte px-6 py-8 text-center sm:px-10">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
          La conclusion de votre bilan
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ardoise-900 sm:text-3xl">
          Le Bio-Portrait Anti-Âge de {prenom}
        </h1>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-3 text-lg font-semibold">
          <span className="text-marine-700">{profil.nom}</span>
          <span className="text-ardoise-300">×</span>
          <span className="text-rose-600">{terrainNom}</span>
        </p>
        {resultat.priorites.length > 0 && (
          <p className="mx-auto mt-4 max-w-xl text-sm text-ardoise-600">
            <span className="font-semibold text-ardoise-800">Vos priorités :</span>{' '}
            {resultat.priorites.map((a) => bareme.AXES[a]).join(' · ')}
          </p>
        )}
      </header>

      <section className="carte overflow-hidden">
        <div className="border-b border-ardoise-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ardoise-900">Profil anti-âge</h2>
          <p className="text-xs text-ardoise-500">Ce dont votre peau a besoin</p>
        </div>
        <div className="p-5">
          <span className="inline-block rounded-full bg-marine-50 px-2.5 py-1 text-2xs font-semibold uppercase tracking-widest text-marine-800">
            Profil
          </span>
          <div className="mt-2 text-xl font-bold tracking-tight text-marine-700">{profil.nom}</div>
          <div className="text-sm italic text-ardoise-500">{profil.signes}</div>

          <div className="mt-5 rounded-xl bg-ardoise-50 p-4">
            <p className="text-sm leading-relaxed text-ardoise-700">{profil.texte}</p>
            <p className="mt-3 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">Vos besoins</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profil.besoins.map((b) => (
                <span key={b} className="rounded-md border border-ardoise-200 bg-white px-2 py-1 text-xs text-ardoise-600">
                  {b}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-5 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">Ce que vos réponses ont marqué</p>
          <div className="mt-2 space-y-2">
            {AXES_ANTI_AGE.map((a) => (
              <Barre key={a} nom={bareme.AXES[a]} valeur={resultat.scores[a]} max={maxProfil} couleur="bg-marine-500" />
            ))}
          </div>
        </div>
      </section>

      <section className="carte overflow-hidden">
        <div className="border-b border-ardoise-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ardoise-900">Terrain cutané</h2>
          <p className="text-xs text-ardoise-500">Comment votre peau réagit</p>
        </div>
        <div className="p-5">
          <span className="inline-block rounded-full bg-rose-50 px-2.5 py-1 text-2xs font-semibold uppercase tracking-widest text-rose-700">
            Terrain
          </span>
          <div className="mt-2 text-xl font-bold tracking-tight text-rose-600">{terrainNom}</div>

          {resultat.terrains.length === 0 ? (
            <p className="mt-4 rounded-xl bg-ardoise-50 p-4 text-sm text-ardoise-600">
              Vos réponses ne signalent ni sensibilité, ni tiraillement, ni fragilité, ni épaississement
              particulier.
            </p>
          ) : (
            resultat.terrains.map((t) => {
              const d = bareme.TERRAINS[t];
              return (
                <div key={t} className="mt-4 rounded-xl bg-ardoise-50 p-4">
                  {resultat.terrains.length > 1 && (
                    <p className="mb-1 text-sm font-semibold text-rose-700">{d.nom}</p>
                  )}
                  <p className="text-sm italic text-ardoise-500">{d.caracteristiques}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ardoise-700">{d.texte}</p>
                  <p className="mt-3 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">Vos besoins</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.besoins.map((b) => (
                      <span key={b} className="rounded-md border border-ardoise-200 bg-white px-2 py-1 text-xs text-ardoise-600">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}

          <p className="mt-5 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">Ce que vos réponses ont marqué</p>
          <div className="mt-2 space-y-2">
            {TERRAINS_ANTI_AGE.map((t) => (
              <Barre key={t} nom={bareme.TERRAINS[t].nom} valeur={resultat.scoresTerrain[t]} max={maxTerrain} couleur="bg-rose-500" />
            ))}
          </div>
        </div>
      </section>

      <p className="px-2 text-xs text-ardoise-400">{bareme.MENTION}</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onRetour} className="bouton-discret">
          <ChevronLeft className="h-4 w-4" />
          Revenir au questionnaire
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {onEnregistrerSeulement && (
            <button
              onClick={onEnregistrerSeulement}
              disabled={enregistrement}
              className="bouton-discret"
              title="Le nouveau Bio-Portrait est enregistré sur sa fiche. Aucune cure n'est ouverte, rien n'est facturé."
            >
              <Check className="h-4 w-4" />
              Enregistrer ce Bio-Portrait
            </button>
          )}
          <button onClick={onSuite} disabled={enregistrement} className="bouton-fort">
            Composer la cure
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Barre({ nom, valeur, max, couleur }: { nom: string; valeur: number; max: number; couleur: string }) {
  const marque = valeur > 0;
  return (
    <div className={`rounded-lg border px-3 py-2 ${marque ? 'border-ardoise-200 bg-white' : 'border-ardoise-100 bg-ardoise-50/60'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-sm font-semibold ${marque ? 'text-ardoise-800' : 'text-ardoise-400'}`}>{nom}</span>
        <span className={`chiffres text-sm font-semibold ${marque ? 'text-ardoise-700' : 'text-ardoise-400'}`}>
          {valeur} pt{valeur > 1 ? 's' : ''}
        </span>
      </div>
      <div className="relative mt-1.5 h-1 overflow-hidden rounded-full bg-ardoise-200">
        <div className={`h-full rounded-full ${couleur} transition-[width] duration-500`} style={{ width: `${(valeur / max) * 100}%` }} />
      </div>
    </div>
  );
}
