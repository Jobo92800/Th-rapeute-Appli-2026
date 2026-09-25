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

/**
 * La liste des questions et de ce qui a été répondu, pour les deux bilans
 * anti-âge — dont les questionnaires n'ont pas de thèmes colorés. Le
 * BioPortrait de la perte de poids a sa propre mise en page, rangée par
 * thème : `CorpsDesReponses`.
 */
export function ListeDesReponses({
  lignes,
  teinte = 'violet',
}: {
  lignes: Array<{ code: string; question: string; reponses: string[] }>;
  teinte?: 'violet' | 'marine';
}) {
  const pastille =
    teinte === 'marine'
      ? 'bg-marine-50 text-marine-700'
      : 'bg-violet-50 text-violet-600';

  return (
    <dl className="p-4 sm:columns-2 sm:gap-4">
      {lignes.map((l) => (
        <div key={l.code} className="mb-3 break-inside-avoid">
          <dt className="text-[13px] leading-snug text-ardoise-600">{l.question}</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {l.reponses.length === 0 ? (
              <span className="text-xs text-ardoise-400">Sans réponse</span>
            ) : (
              l.reponses.map((r) => (
                <span
                  key={r}
                  className={`inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold leading-tight ${pastille}`}
                >
                  {r}
                </span>
              ))
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
