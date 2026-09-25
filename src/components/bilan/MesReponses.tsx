import { ListChecks, X } from 'lucide-react';

/*
  « Mes réponses », le bouton et sa carte.

  Il était sur l'écran de restitution seulement. Or la question « pourquoi
  ce profil ? » se repose UNE PAGE PLUS LOIN, devant la cure : la cliente a
  eu le temps de digérer son BioPortrait, et c'est au moment de parler des
  séances qu'elle demande d'où sort tout ça. Quitter l'écran du devis pour
  aller le vérifier, c'est perdre le fil de la conversation — et le
  « Retour » remet la cure à zéro.

  Le bouton et la carte vivent donc ici, à deux endroits près : l'état
  reste chez celui qui appelle, parce que le bouton se place dans un
  en-tête et la carte en dessous, et que chaque écran les range à sa façon.
*/

export function BoutonMesReponses({
  ouvert,
  onBascule,
  libelle = 'Mes réponses',
  className = 'bouton-discret',
}: {
  ouvert: boolean;
  onBascule: () => void;
  libelle?: string;
  className?: string;
}) {
  return (
    <button type="button" onClick={onBascule} aria-pressed={ouvert} className={className}>
      <ListChecks className="h-4 w-4" />
      {libelle}
    </button>
  );
}

export function CarteMesReponses({
  sousTitre,
  onFermer,
  children,
}: {
  sousTitre: string;
  onFermer: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="carte">
      <div className="flex items-start justify-between gap-3 border-b border-ardoise-100 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-ardoise-900">Ses réponses au questionnaire</h2>
          <p className="text-xs text-ardoise-500">{sousTitre}</p>
        </div>
        <button type="button" onClick={onFermer} className="bouton-discret text-xs" aria-label="Fermer">
          <X className="h-4 w-4" />
          Fermer
        </button>
      </div>
      {children}
    </section>
  );
}

export interface LigneDeReponse {
  code: string;
  /** Le groupe du questionnaire, quand il y en a un. */
  groupe?: string;
  question: string;
  reponses: string[];
}

/**
 * La liste des questions et de ce qui a été répondu, pour les deux bilans
 * anti-âge — dont les questionnaires n'ont pas de thèmes colorés. Le
 * BioPortrait de la perte de poids a la sienne, rangée par thème à sa
 * couleur : `CorpsDesReponses`.
 *
 * ELLE SE RANGE PAR GROUPE, comme le questionnaire l'a posée : « Ce que
 * vous ressentez au quotidien », « Ce que vous voyez dans le miroir »…
 * Sans eux, c'était un mur de trente lignes où l'œil ne se posait nulle
 * part, et la thérapeute devait relire tout le bloc pour retrouver une
 * réponse (Jonathan, 25 septembre 2026). Un questionnaire sans groupes —
 * l'Advance Lift — garde une seule liste, sans titre inventé.
 *
 * La mise en page est celle de la DA et de la carte du BioPortrait : des
 * blocs blancs à filet sur un fond lavé, le titre du groupe en sur-titre
 * aqua, la question en petit et la réponse en pastille juste en dessous.
 * Aligner la question à gauche et la réponse à droite faisait faire à
 * l'œil un aller-retour à chaque ligne.
 */
export function ListeDesReponses({
  lignes,
  groupes = [],
}: {
  lignes: LigneDeReponse[];
  groupes?: Array<{ id: string; titre: string }>;
}) {
  /*
    Les groupes dans l'ordre du questionnaire, puis ce qui n'appartient à
    aucun — une question ajoutée hors groupe ne doit pas disparaître.
  */
  const connus = groupes
    .map((g) => ({ titre: g.titre, lignes: lignes.filter((l) => l.groupe === g.id) }))
    .filter((b) => b.lignes.length > 0);
  const orphelines = lignes.filter((l) => !groupes.some((g) => g.id === l.groupe));
  const blocs = orphelines.length > 0 ? [...connus, { titre: '', lignes: orphelines }] : connus;

  return (
    <div className="bg-ardoise-50/60 px-4 py-4">
      <div className="sm:columns-2 sm:gap-4">
        {blocs.map((bloc, rang) => (
          <section
            key={bloc.titre || `bloc-${rang}`}
            className="mb-4 break-inside-avoid rounded-2xl border border-ardoise-100 bg-white p-4"
          >
            {bloc.titre && <h3 className="surtitre">{bloc.titre}</h3>}
            <dl className={bloc.titre ? 'mt-3 space-y-3' : 'space-y-3'}>
              {bloc.lignes.map((l) => (
                <div key={l.code}>
                  <dt className="text-[12.5px] leading-snug text-ardoise-500">{l.question}</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {l.reponses.length === 0 ? (
                      <span className="text-xs italic text-ardoise-400">Sans réponse</span>
                    ) : (
                      l.reponses.map((r) => (
                        <span
                          key={r}
                          className="inline-block rounded-full bg-marine-50 px-2.5 py-1 text-[13px] font-semibold leading-tight text-marine-700"
                        >
                          {r}
                        </span>
                      ))
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
