import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Le filet.
 *
 * Une erreur de rendu non rattrapée vide la page : la personne se retrouve
 * devant un écran blanc, en rendez-vous, sans savoir si elle a perdu son
 * travail. C'est le pire des messages d'erreur — il n'en donne aucun.
 *
 * La cause la plus fréquente n'est pas un défaut du code : c'est un onglet
 * resté ouvert pendant un déploiement. Les fichiers de l'application ont
 * changé de nom, la page cherche encore les anciens. Recharger suffit, mais
 * encore faut-il le dire.
 */
export default class Filet extends Component<
  { children: ReactNode },
  { erreur: Error | null }
> {
  state = { erreur: null as Error | null };

  static getDerivedStateFromError(erreur: Error) {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error('Erreur de rendu :', erreur, info.componentStack);
  }

  render() {
    if (!this.state.erreur) return this.props.children;

    const texte = String(this.state.erreur?.message ?? '');
    const miseAJour =
      /dynamically imported module|Importing a module script failed|Failed to fetch|Loading chunk/i.test(
        texte,
      );

    return (
      <div className="flex min-h-screen items-center justify-center bg-ardoise-100 px-4">
        <div className="carte max-w-lg p-8 text-center">
          <h1 className="text-lg font-semibold text-ardoise-900">
            {miseAJour ? 'L’application a été mise à jour' : 'Quelque chose s’est mal passé'}
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ardoise-600">
            {miseAJour
              ? 'Cette page était ouverte pendant la mise à jour. Rechargez-la pour repartir sur la nouvelle version : rien n’est perdu.'
              : 'L’écran n’a pas pu s’afficher. Rechargez la page ; si cela recommence, notez ce que vous étiez en train de faire et signalez-le.'}
          </p>

          <button onClick={() => window.location.reload()} className="bouton-fort mt-6">
            Recharger la page
          </button>

          {!miseAJour && texte && (
            <p className="mt-5 break-words rounded-lg bg-ardoise-100 px-3 py-2 text-left text-xs text-ardoise-600">
              {texte.slice(0, 300)}
            </p>
          )}
        </div>
      </div>
    );
  }
}
