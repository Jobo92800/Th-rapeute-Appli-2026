import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Centre, RoleCompte } from '../types/db';

interface EtatSession {
  chargement: boolean;
  session: Session | null;
  centre: Centre | null;
  role: RoleCompte | null;
  /** Direction : liste complète. Compte de centre : uniquement le sien. */
  centresAccessibles: Centre[];
  choisirCentre: (centreId: string) => void;
  deconnexion: () => Promise<void>;
}

const Contexte = createContext<EtatSession | null>(null);

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);
  const [role, setRole] = useState<RoleCompte | null>(null);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [centreId, setCentreId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setRole(null);
      setCentres([]);
      setCentreId(null);
      setChargement(false);
      return;
    }

    let annule = false;

    (async () => {
      setChargement(true);

      const { data: compte } = await supabase
        .from('comptes_centre')
        .select('centre_id, role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      // Les policies filtrent déjà : un compte de centre ne verra que le sien.
      const { data: liste } = await supabase
        .from('centres')
        .select('*')
        .eq('actif', true)
        .order('nom');

      if (annule) return;

      const tous = (liste ?? []) as Centre[];
      const roleCompte = (compte?.role ?? null) as RoleCompte | null;
      const accessibles =
        roleCompte === 'direction' ? tous : tous.filter((c) => c.id === compte?.centre_id);

      setRole(roleCompte);
      setCentres(accessibles);

      const memorise = localStorage.getItem('centre_actif');
      const valide = accessibles.find((c) => c.id === memorise);
      setCentreId(valide?.id ?? compte?.centre_id ?? accessibles[0]?.id ?? null);
      setChargement(false);
    })();

    return () => {
      annule = true;
    };
  }, [session]);

  const valeur = useMemo<EtatSession>(() => {
    const choisirCentre = (id: string) => {
      if (!centres.some((c) => c.id === id)) return;
      localStorage.setItem('centre_actif', id);
      setCentreId(id);
    };

    return {
      chargement,
      session,
      role,
      centre: centres.find((c) => c.id === centreId) ?? null,
      centresAccessibles: centres,
      choisirCentre,
      deconnexion: async () => {
        localStorage.removeItem('centre_actif');
        await supabase.auth.signOut();
      },
    };
  }, [chargement, session, role, centres, centreId]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession(): EtatSession {
  const ctx = useContext(Contexte);
  if (!ctx) throw new Error('useSession doit être utilisé dans FournisseurSession');
  return ctx;
}

/** Raccourci pour les écrans qui exigent un centre actif. */
export function useCentre(): Centre {
  const { centre } = useSession();
  if (!centre) throw new Error('Aucun centre actif');
  return centre;
}
