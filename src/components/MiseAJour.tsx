import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * « Une nouvelle version est disponible » — le petit encart qui évite de
 * travailler sur une application dépassée.
 *
 * Netlify redéploie à chaque poussée, mais une page ouverte le matin reste
 * sur la version du matin toute la journée : les corrections livrées entre
 * temps n'y sont pas, et un morceau chargé à la demande peut même ne plus
 * exister sous son ancien nom (`estUnePageDepassee`). Jonathan veut le
 * savoir sans avoir à y penser (18 septembre 2026).
 *
 * Le principe : chaque construction donne au fichier principal un nom
 * unique (`assets/index-XXXX.js`), écrit dans la page d'accueil. On relit
 * cette page — toutes les cinq minutes, et chaque fois que l'onglet
 * redevient visible — et on compare le nom qu'elle annonce à celui qui
 * tourne ici. S'ils diffèrent, l'application a changé. Aucun serveur à
 * interroger, aucun numéro de version à tenir à la main.
 *
 * Un « Plus tard » referme l'encart jusqu'à la prochaine version, jamais
 * plus longtemps : une thérapeute en plein bilan ne doit pas être coupée,
 * mais elle ne doit pas non plus rester dépassée pour de bon.
 */

const INTERVALLE = 5 * 60_000;
const MOTIF = /assets\/index-[A-Za-z0-9_-]+\.js/;

/** Le nom du fichier principal qui tourne dans cette page. */
function versionCourante(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]');
  return script?.src.match(MOTIF)?.[0] ?? null;
}

/** Le nom du fichier principal que le serveur sert en ce moment. */
async function versionEnLigne(): Promise<string | null> {
  try {
    const r = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } });
    if (!r.ok) return null;
    return (await r.text()).match(MOTIF)?.[0] ?? null;
  } catch {
    return null;
  }
}

export default function MiseAJour() {
  const [nouvelle, setNouvelle] = useState<string | null>(null);
  const [ignoree, setIgnoree] = useState<string | null>(null);

  useEffect(() => {
    const ici = versionCourante();
    // En développement, la page ne porte pas de fichier construit : rien à comparer.
    if (!ici) return;

    let arretee = false;
    async function verifier() {
      const enLigne = await versionEnLigne();
      if (!arretee && enLigne && enLigne !== ici) setNouvelle(enLigne);
    }

    const minuterie = setInterval(verifier, INTERVALLE);
    const auRetour = () => {
      if (document.visibilityState === 'visible') verifier();
    };
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('focus', auRetour);

    return () => {
      arretee = true;
      clearInterval(minuterie);
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('focus', auRetour);
    };
  }, []);

  if (!nouvelle || nouvelle === ignoree) return null;

  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-marine-300 bg-white px-4 py-3 shadow-flottante"
    >
      <RefreshCw className="h-5 w-5 shrink-0 text-marine-700" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ardoise-900">Une nouvelle version est disponible</p>
        <p className="text-xs text-ardoise-500">
          Rechargez pour l’avoir — terminez d’abord ce que vous étiez en train de saisir.
        </p>
      </div>
      <button type="button" onClick={() => window.location.reload()} className="bouton-fort shrink-0">
        Mettre à jour
      </button>
      <button
        type="button"
        onClick={() => setIgnoree(nouvelle)}
        aria-label="Plus tard"
        title="Plus tard"
        className="shrink-0 rounded-lg p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
