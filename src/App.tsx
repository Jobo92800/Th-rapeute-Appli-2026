import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { FournisseurSession, useSession } from './lib/session';
import Layout from './components/Layout';
import Connexion from './pages/Connexion';
import Accueil from './pages/Accueil';
import Stock from './pages/Stock';
import TableauDeBord from './pages/TableauDeBord';
import Clientes from './pages/Clientes';
import FicheCliente from './pages/FicheCliente';
import NouveauBilan from './pages/NouveauBilan';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

function Application() {
  const { chargement, session, centre } = useSession();

  if (chargement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ardoise-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ardoise-300 border-t-marine-600" />
      </div>
    );
  }

  if (!session) return <Connexion />;

  if (!centre) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ardoise-100 px-4">
        <div className="carte max-w-lg p-6 text-center">
          <h1 className="text-base font-semibold text-ardoise-900">Compte non rattaché</h1>
          <p className="mt-2 text-sm text-ardoise-600">
            Ce compte de connexion n'est associé à aucune thérapeute. Exécutez ce SQL dans
            Supabase, puis rechargez la page.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-ardoise-950 px-4 py-3 text-left text-xs leading-relaxed text-ardoise-100">{`update therapeutes t set user_id = u.id
from auth.users u
where lower(u.email) = lower(t.email)
  and t.user_id is distinct from u.id;`}</pre>
          <p className="mt-3 text-xs text-ardoise-400">
            Le lien se fait sur l'adresse email : elle doit être identique dans
            Authentication &gt; Users et dans la colonne email de la table therapeutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/nouvelle" element={<FicheCliente />} />
        <Route path="/bilan" element={<NouveauBilan />} />
        <Route path="/clientes/:id" element={<FicheCliente />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/tableau-de-bord" element={<TableauDeBord />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FournisseurSession>
        <BrowserRouter>
          <Application />
          <Toaster
            position="top-right"
            toastOptions={{ style: { fontSize: '14px' }, duration: 3500 }}
          />
        </BrowserRouter>
      </FournisseurSession>
    </QueryClientProvider>
  );
}
