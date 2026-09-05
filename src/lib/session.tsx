import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Centre, RoleCompte, Therapeute } from '../types/db';

interface EtatSession {
  chargement: boolean;
  session: Session | null;
  /** La personne connectée. Null si son compte n'est rattaché à aucune fiche. */
  therapeute: Therapeute | null;
  centre: Centre | null;
  /**
   * Vue d'ensemble : la direction regarde les cinq centres à la fois. Les
   * écrans qui filtrent par centre passent alors null au lieu d'un
   * identifiant, et la RLS fait le reste — une thérapeute ne verrait que le
   * sien de toute façon.
   */
  tousCentres: boolean;
  role: RoleCompte | null;
  /** Direction : tous les centres. Thérapeute : uniquement le sien. */
  centresAccessibles: Centre[];
  choisirCentre: (centreId: string) => void;
  deconnexion: () => Promise<void>;
}

const Contexte = createContext<EtatSession | null>(null);



/** Valeur du sélecteur quand la direction regarde les cinq centres. */
export const TOUS_LES_CENTRES = 'tous';
const TOUS = TOUS_LES_CENTRES;

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);
  const [therapeute, setTherapeute] = useState<Therapeute | null>(null);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [centreId, setCentreId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setTherapeute(null);
      setCentres([]);
      setCentreId(null);
      setChargement(false);
      return;
    }

    let annule = false;

    (async () => {
      setChargement(true);

      const { data: personne } = await supabase
        .from('therapeutes')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      // Les policies filtrent déjà : une thérapeute ne verra que son centre.
      const { data: liste } = await supabase
        .from('centres')
        .select('*')
        .eq('actif', true)
        .order('nom');

      if (annule) return;

      const moi = (personne as Therapeute | null) ?? null;
      const tous = (liste ?? []) as Centre[];
      const accessibles =
        moi?.role === 'direction' ? tous : tous.filter((c) => c.id === moi?.centre_id);

      setTherapeute(moi);
      setCentres(accessibles);

      const memorise = localStorage.getItem('centre_actif');
      const globalMemorise = memorise === TOUS && moi?.role === 'direction';
      const valide = accessibles.find((c) => c.id === memorise);
      setCentreId(
        globalMemorise ? TOUS : (valide?.id ?? moi?.centre_id ?? accessibles[0]?.id ?? null),
      );
      setChargement(false);
    })();

    return () => {
      annule = true;
    };
  }, [session]);

  const valeur = useMemo<EtatSession>(() => {
    const estDirection = therapeute?.role === 'direction';

    const choisirCentre = (id: string) => {
      if (id === TOUS) {
        if (!estDirection) return;
      } else if (!centres.some((c) => c.id === id)) {
        return;
      }
      localStorage.setItem('centre_actif', id);
      setCentreId(id);
    };

    return {
      chargement,
      session,
      therapeute,
      role: therapeute?.role ?? null,
      centre: centreId === TOUS ? (centres[0] ?? null) : (centres.find((c) => c.id === centreId) ?? null),
      tousCentres: centreId === TOUS && estDirection,
      centresAccessibles: centres,
      choisirCentre,
      deconnexion: async () => {
        localStorage.removeItem('centre_actif');
        await supabase.auth.signOut();
      },
    };
  }, [chargement, session, therapeute, centres, centreId]);

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

/**
 * L'identifiant à passer aux services : null quand la direction regarde les
 * cinq centres, l'identifiant du centre sinon.
 */
export function usePerimetre(): string | null {
  const { centre, tousCentres } = useSession();
  return tousCentres ? null : (centre?.id ?? null);
}
