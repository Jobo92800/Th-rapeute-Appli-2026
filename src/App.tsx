import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { FournisseurSession, useSession } from './lib/session';
import Layout from './components/Layout';
import Connexion from './pages/Connexion';
import Accueil from './pages/Accueil';
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
        <div className="carte max-w-md p-6 text-center">
          <h1 className="text-base font-semibold text-ardoise-900">Compte non rattaché</h1>
          <p className="mt-2 text-sm text-ardoise-600">
            Ce compte n'est associé à aucun centre. Ajoutez une ligne dans la table
            <code className="mx-1 rounded bg-ardoise-100 px-1.5 py-0.5 text-xs">comptes_centre</code>
            pour lui attribuer un centre, puis reconnectez-vous.
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
        <Route path="/stock" element={<AVenir titre="Stock" lot="lot 5" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function AVenir({ titre, lot }: { titre: string; lot: string }) {
  return (
    <div className="carte px-5 py-12 text-center">
      <h1 className="text-lg font-semibold text-ardoise-900">{titre}</h1>
      <p className="mt-1.5 text-sm text-ardoise-500">Cet écran arrive avec le {lot}.</p>
    </div>
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
