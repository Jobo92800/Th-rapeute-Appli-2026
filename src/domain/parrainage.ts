/**
 * Le parrainage : « Parrainez et gagnez ».
 *
 * Une filleule qui s'engage dans une cure — c'est-à-dire qui signe son
 * contrat — vaut 2 séances offertes à sa marraine, jusqu'à 10.
 *
 * Ces séances ne touchent jamais la cure en cours : elle est déjà signée,
 * réglée et facturée. Elles attendent la cure suivante, où elles s'ajoutent
 * au décompte sans rien changer au montant.
 */

export const SEANCES_PAR_FILLEULE = 2;
export const PLAFOND_SEANCES = 10;

export interface Filleule {
  id: string;
  prenom: string;
  nom: string;
  centre_id: string;
  centre: string;
  /** Date de signature de son premier contrat. Null : elle n'a pas encore signé. */
  engagee_le: string | null;
}

export interface SoldeParrainage {
  /** Filleules déclarées, engagées ou non. */
  total: number;
  engagees: number;
  /** Ce que le parrainage a rapporté, plafond compris. */
  gagnees: number;
  /** Ce qui a déjà été posé sur des cures. */
  utilisees: number;
  /** Ce qui reste à poser sur la prochaine cure. */
  disponibles: number;
  plafondAtteint: boolean;
}

export function calculerSolde(filleules: Filleule[], utilisees: number): SoldeParrainage {
  const engagees = filleules.filter((f) => f.engagee_le !== null).length;
  const brut = engagees * SEANCES_PAR_FILLEULE;
  const gagnees = Math.min(brut, PLAFOND_SEANCES);

  return {
    total: filleules.length,
    engagees,
    gagnees,
    utilisees,
    disponibles: Math.max(0, gagnees - utilisees),
    plafondAtteint: brut >= PLAFOND_SEANCES,
  };
}

/** « 3 filleules engagées, 6 séances gagnées » — la phrase de l'écran. */
export function libelleSolde(s: SoldeParrainage): string {
  if (s.total === 0) return 'Aucune filleule pour l’instant';

  if (s.engagees === 0) {
    return s.total === 1
      ? '1 filleule déclarée, qui n’a pas encore signé sa cure'
      : `${s.total} filleules déclarées, aucune n’a encore signé sa cure`;
  }

  const gagnees = `${s.gagnees} séance${s.gagnees > 1 ? 's' : ''} gagnée${s.gagnees > 1 ? 's' : ''}`;
  const engagees = `${s.engagees} filleule${s.engagees > 1 ? 's' : ''} engagée${s.engagees > 1 ? 's' : ''}`;
  return `${engagees}, ${gagnees}`;
}
