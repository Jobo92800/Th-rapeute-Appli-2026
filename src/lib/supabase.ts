import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !cle) {
  throw new Error(
    "Configuration Supabase absente. Copiez .env.example en .env et renseignez " +
      'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(url, cle, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
