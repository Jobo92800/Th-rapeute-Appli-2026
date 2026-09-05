import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  LogOut,
  ChevronDown,
  Sparkles,
  BarChart3,
  BookOpen,
  MessageSquare,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { messagesEnAttente } from '../services/messages';
import { TOUS_LES_CENTRES, useSession } from '../lib/session';

const LIENS = [
  { to: '/', libelle: 'Accueil', icone: LayoutDashboard, exact: true, direction: false },
  { to: '/clientes', libelle: 'Clientes', icone: Users, exact: false, direction: false },
  { to: '/bilan', libelle: 'Nouveau bilan', icone: Sparkles, exact: false, direction: false },
  { to: '/stock', libelle: 'Stock', icone: Package, exact: false, direction: false },
  { to: '/messages', libelle: 'Messages', icone: MessageSquare, exact: false, direction: false },
  // Les chiffres ne concernent pas les thérapeutes : le lien ne leur est
  // même pas montré, et la base refuserait de répondre.
  { to: '/tableau-de-bord', libelle: 'Tableau de bord', icone: BarChart3, exact: false, direction: true },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { centre, centresAccessibles, choisirCentre, deconnexion, role, therapeute, tousCentres } =
    useSession();
  const navigate = useNavigate();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const plusieursCentres = centresAccessibles.length > 1 || role === 'direction';

  /*
    La pastille du menu. Elle compte ce qui attend *ce* compte : les
    annonces non lues pour une thérapeute, les signalements ouverts pour la
    direction. Rafraîchie à chaque minute — un carnet de liaison n'a pas
    besoin d'être instantané, et interroger la base en continu pour ça
    serait du gâchis.
  */
  const { data: enAttente } = useQuery({
    queryKey: ['messages-en-attente'],
    queryFn: messagesEnAttente,
    refetchInterval: 60_000,
  });
  const aLire =
    (enAttente?.annonces_non_lues ?? 0) + (enAttente?.signalements_a_traiter ?? 0);
  const liens = LIENS.filter((l) => !l.direction || role === 'direction');

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ardoise-200 bg-white lg:flex">
        <div className="border-b border-ardoise-200 px-5 py-5">
          {/*
            Le logo vectorisé, recadré sur son contenu.

            Le fichier d'origine était fait aux deux tiers de vide : le
            dessin n'occupait qu'un tiers de la hauteur, si bien que le nom
            restait minuscule quelle que soit la taille donnée à l'image.
            Recadré, c'est une enseigne large — deux fois et demie plus
            large que haute — qui remplit la barre et se lit du premier coup.
          */}
          <img src="/logo.svg" alt="MAbeautyplus" width={215} height={85} className="block w-full" />
          <div className="mt-2 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
            Suivi client
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {liens.map(({ to, libelle, icone: Icone, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-marine-50 text-marine-800'
                    : 'text-ardoise-600 hover:bg-ardoise-50 hover:text-ardoise-900'
                }`
              }
            >
              <Icone className="h-4 w-4" />
              {libelle}
              {to === '/messages' && aLire > 0 && (
                <span className="ml-auto rounded-full bg-rose-600 px-1.5 py-0.5 text-2xs font-bold text-white">
                  {aLire}
                </span>
              )}
            </NavLink>
          ))}

          {/*
            Le guide des thérapeutes. Un lien, pas un onglet : on ne le
            consulte pas au fil de la journée, on l'ouvre quand on bloque.
            Il s'ouvre à côté pour ne pas faire perdre à la thérapeute ce
            qu'elle était en train de saisir.
          */}
          <a
            href="/guide.html"
            target="_blank"
            rel="noreferrer"
            className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ardoise-500 transition-colors hover:bg-ardoise-50 hover:text-ardoise-900"
          >
            <BookOpen className="h-4 w-4" />
            Tuto
          </a>
        </nav>

        <div className="relative border-t border-ardoise-200 p-3">
          {therapeute && (
            <div className="mb-1 flex items-center gap-2.5 px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marine-100 text-xs font-bold text-marine-800">
                {therapeute.prenom.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ardoise-900">
                  {therapeute.prenom}
                </span>
                <span className="block text-2xs uppercase tracking-widest text-ardoise-400">
                  {therapeute.role === 'direction' ? 'Direction' : 'Thérapeute'}
                </span>
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => plusieursCentres && setMenuOuvert((o) => !o)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left ${
              plusieursCentres ? 'hover:bg-ardoise-50' : 'cursor-default'
            }`}
          >
            <span className="min-w-0">
              <span className="block text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                Centre
              </span>
              <span className="block truncate text-sm font-semibold text-ardoise-900">
                {tousCentres ? 'Tous les centres' : (centre?.nom ?? '—')}
              </span>
            </span>
            {plusieursCentres && <ChevronDown className="h-4 w-4 shrink-0 text-ardoise-400" />}
          </button>

          {menuOuvert && plusieursCentres && (
            <div className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-lg border border-ardoise-200 bg-white shadow-carte">
              {/* La direction peut tout regarder d'un coup. Les écrans qui
                  demandent un centre précis — bilan, stock — le disent. */}
              {role === 'direction' && (
                <button
                  type="button"
                  onClick={() => {
                    choisirCentre(TOUS_LES_CENTRES);
                    setMenuOuvert(false);
                    navigate('/');
                  }}
                  className={`block w-full border-b border-ardoise-100 px-3 py-2 text-left text-sm hover:bg-ardoise-50 ${
                    tousCentres ? 'font-semibold text-marine-800' : 'text-ardoise-700'
                  }`}
                >
                  Tous les centres
                </button>
              )}

              {centresAccessibles.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    choisirCentre(c.id);
                    setMenuOuvert(false);
                    navigate('/');
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-ardoise-50 ${
                    !tousCentres && c.id === centre?.id
                      ? 'font-semibold text-marine-800'
                      : 'text-ardoise-700'
                  }`}
                >
                  {c.nom}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={deconnexion}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ardoise-500 hover:bg-ardoise-50 hover:text-ardoise-900"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ardoise-200 bg-white px-5 py-3 lg:hidden">
          <img src="/logo.svg" alt="MAbeautyplus" width={86} height={34} className="h-[34px] w-auto" />
          <span className="text-sm font-medium text-ardoise-600">
            {therapeute?.prenom ? `${therapeute.prenom} · ` : ''}
            {tousCentres ? 'Tous les centres' : centre?.nom}
          </span>
        </header>

        <nav className="flex gap-1 border-b border-ardoise-200 bg-white px-3 py-2 lg:hidden">
          {liens.map(({ to, libelle, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-marine-50 text-marine-800' : 'text-ardoise-600'
                }`
              }
            >
              {libelle}
              {to === '/messages' && aLire > 0 && (
                <span className="ml-1 rounded-full bg-rose-600 px-1.5 text-2xs font-bold text-white">
                  {aLire}
                </span>
              )}
            </NavLink>
          ))}
          <a
            href="/guide.html"
            target="_blank"
            rel="noreferrer"
            className="ml-auto rounded-lg px-3 py-1.5 text-sm font-medium text-ardoise-500"
          >
            Tuto
          </a>
        </nav>

        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>

        {role === 'direction' && (
          <div className="border-t border-ardoise-200 bg-white px-5 py-1.5 text-2xs font-semibold uppercase tracking-widest text-rose-600 lg:px-8">
            Accès direction — tous les centres
          </div>
        )}
      </div>
    </div>
  );
}
