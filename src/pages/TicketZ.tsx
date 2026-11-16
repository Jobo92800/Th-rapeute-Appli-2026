import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronDown, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/session';
import { lireTicketZ } from '../services/caisse';
import {
  arreterLaCaisse,
  libelleDuMoyen,
  regrouperLesReglements,
  totauxParMoyen,
  type EntreeDeCaisse,
  type MoyenDeReglement,
} from '../domain/caisse';

/*
  L'ÉDITEUR DE TICKETS Z.

  Un ticket Z par caisse, sur la période qu'on veut. Il dit ce qui est
  entré, par quel moyen, au nom de qui — et ce qui aurait dû entrer et
  n'est pas pointé, parce que c'est là que se voit un centre qui encaisse
  sans le noter.

  Réservé à la direction : le lien ne s'affiche pas ailleurs, et la base
  refuse de répondre à qui n'est pas de la direction.
*/

type Periode = 'semaine_derniere' | 'cette_semaine' | 'hier' | 'mois_dernier' | 'ce_mois' | 'perso';

const PERIODES: { id: Periode; libelle: string }[] = [
  { id: 'semaine_derniere', libelle: 'Semaine dernière' },
  { id: 'cette_semaine', libelle: 'Cette semaine' },
  { id: 'hier', libelle: 'Hier' },
  { id: 'mois_dernier', libelle: 'Mois dernier' },
  { id: 'ce_mois', libelle: 'Ce mois' },
  { id: 'perso', libelle: 'Dates au choix' },
];

const jour = (d: Date) => format(d, 'yyyy-MM-dd');
/* La semaine de caisse commence le lundi et finit le dimanche. */
const semaine = { locale: fr, weekStartsOn: 1 as const };

function bornes(p: Periode, perso: { du: string; au: string }): { du: string; au: string } {
  const maintenant = new Date();

  switch (p) {
    case 'semaine_derniere': {
      const s = subWeeks(maintenant, 1);
      return { du: jour(startOfWeek(s, semaine)), au: jour(endOfWeek(s, semaine)) };
    }
    case 'cette_semaine':
      return { du: jour(startOfWeek(maintenant, semaine)), au: jour(maintenant) };
    case 'hier': {
      const h = subDays(maintenant, 1);
      return { du: jour(h), au: jour(h) };
    }
    case 'mois_dernier': {
      const m = subMonths(maintenant, 1);
      return { du: jour(startOfMonth(m)), au: jour(endOfMonth(m)) };
    }
    case 'ce_mois':
      return { du: jour(startOfMonth(maintenant)), au: jour(maintenant) };
    case 'perso':
      return perso;
  }
}

/*
  UNE COULEUR PAR MOYEN DE RÈGLEMENT.

  Les quatre premières viennent de la charte : les deux teals pour l'argent
  qui dort en caisse, le violet pour la carte, le gris pour le virement.
  L'ambre est à part, pour Alma — c'est la seule rentrée qui vient de
  l'extérieur et dont une part repart aussitôt. Le magenta reste ce qu'il
  est partout ailleurs dans l'application : ce qu'il faut aller corriger.
*/
const COULEUR_DU_MOYEN: Record<string, string> = {
  especes: 'bg-marine-800',
  cheque: 'bg-marine-500',
  cb: 'bg-violet-500',
  virement: 'bg-ardoise-400',
  alma: 'bg-amber-500',
  sans: 'bg-rose-500',
};

function Pastille({ moyen }: { moyen: MoyenDeReglement | null }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${COULEUR_DU_MOYEN[moyen ?? 'sans']}`}
    />
  );
}

/* La légende : les six moyens, toujours tous, même à zéro. Une colonne qui
   disparaît d'un ticket à l'autre ne se retient pas. */
const TOUS_LES_MOYENS: Array<MoyenDeReglement | null> = [
  'especes',
  'cheque',
  'cb',
  'virement',
  'alma',
  null,
];

function Legende() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {TOUS_LES_MOYENS.map((m) => (
        <span key={m ?? 'sans'} className="flex items-center gap-1.5 text-2xs text-ardoise-600">
          <Pastille moyen={m} />
          {libelleDuMoyen(m)}
        </span>
      ))}
    </div>
  );
}

const euros = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const leJour = (iso: string) => format(new Date(`${iso}T12:00:00`), 'EEEE d MMMM', { locale: fr });
const leJourCourt = (iso: string) => format(new Date(`${iso}T12:00:00`), 'EEEE d', { locale: fr });

/** Ce que le règlement paie, dit en clair. */
function libelleDeLEntree(e: EntreeDeCaisse): string {
  if (e.moyen === 'alma') {
    return `cure de ${euros(e.montantCure)} · ${e.echeances} échéance${e.echeances > 1 ? 's' : ''} · encaissée à la signature`;
  }
  if (e.rang === 1 && e.nbEcheances <= 1) return `cure de ${euros(e.montantCure)}`;
  return `échéance ${e.rang} sur ${e.nbEcheances} · cure de ${euros(e.montantCure)}`;
}




export default function TicketZ() {
  const { role } = useSession();
  const aujourdhui = jour(new Date());
  const [periode, setPeriode] = useState<Periode>('semaine_derniere');
  const [perso, setPerso] = useState({ du: aujourdhui, au: aujourdhui });
  const [exclus, setExclus] = useState<string[]>([]);
  const [deplie, setDeplie] = useState<string[]>([]);

  const { du, au } = useMemo(() => bornes(periode, perso), [periode, perso]);
  const periodeAlEnvers = du > au;

  const { data, isLoading, error } = useQuery({
    queryKey: ['ticket-z', du, au],
    queryFn: () => lireTicketZ(du, au),
    enabled: role === 'direction' && !periodeAlEnvers,
  });

  /* Un ticket tout prêt par centre : l'écran n'a plus qu'à le lire. */
  const tickets = useMemo(() => {
    if (!data) return [];
    return data.centres.map((c) => {
      const entrees = regrouperLesReglements(
        data.reglements.filter((r) => r.centre_id === c.id),
      );
      const restant = data.restant.find((r) => r.centre_id === c.id);
      return {
        centre: c,
        entrees,
        moyens: totauxParMoyen(entrees),
        arrete: arreterLaCaisse(entrees),
        restant: { nb: restant?.nb ?? 0, montant: restant?.montant ?? 0 },
        activite: data.activite.find((a) => a.centre_id === c.id),
        bilansSeuls: data.bilans_seuls.filter((b) => b.centre_id === c.id),
        complements: data.complements.filter((v) => v.centre_id === c.id),
      };
    });
  }, [data]);

  const retenus = tickets.filter((t) => !exclus.includes(t.centre.id));
  const groupe = {
    encaisse: retenus.reduce((s, t) => s + t.arrete.encaisse, 0),
    frais: retenus.reduce((s, t) => s + t.arrete.frais, 0),
    net: retenus.reduce((s, t) => s + t.arrete.net, 0),
    attente: retenus.reduce((s, t) => s + t.restant.montant, 0),
  };

  if (role !== 'direction') {
    return (
      <div className="carte p-6">
        <h1 className="text-lg font-semibold text-ardoise-900">Tickets Z</h1>
        <p className="mt-2 text-sm text-ardoise-600">
          L'arrêté de caisse est réservé à la direction.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ardoise-900">Tickets Z</h1>
          <p className="text-sm text-ardoise-600">
            L'arrêté de caisse, une caisse par centre.
          </p>
        </div>
        <button type="button" onClick={() => window.print()} className="bouton-discret">
          <Printer className="h-4 w-4" />
          Imprimer
        </button>
      </div>

      {/* Le choix de la période et des caisses */}
      <div className="carte flex flex-col gap-4 p-4 print:hidden">
        <div className="flex flex-wrap gap-2">
          {PERIODES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriode(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                periode === p.id
                  ? 'bg-marine-600 text-white'
                  : 'bg-ardoise-50 text-ardoise-700 hover:bg-ardoise-100'
              }`}
            >
              {p.libelle}
            </button>
          ))}
        </div>

        {periode === 'perso' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="etiquette">Du</span>
              <input
                id="ticket-z-du"
                type="date"
                className="champ"
                value={perso.du}
                onChange={(e) => setPerso((v) => ({ ...v, du: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="etiquette">Au</span>
              <input
                id="ticket-z-au"
                type="date"
                className="champ"
                value={perso.au}
                onChange={(e) => setPerso((v) => ({ ...v, au: e.target.value }))}
              />
            </label>
          </div>
        )}

        {periodeAlEnvers && (
          <p className="text-sm font-medium text-rose-600">
            La période est à l'envers : le premier jour doit précéder le dernier.
          </p>
        )}

        {tickets.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-ardoise-200 pt-4">
            {tickets.map((t) => {
              const retenu = !exclus.includes(t.centre.id);
              return (
                <button
                  key={t.centre.id}
                  type="button"
                  onClick={() =>
                    setExclus((v) =>
                      retenu ? [...v, t.centre.id] : v.filter((x) => x !== t.centre.id),
                    )
                  }
                  aria-pressed={retenu}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    retenu
                      ? 'bg-marine-50 text-marine-800 ring-1 ring-marine-200'
                      : 'bg-white text-ardoise-400 ring-1 ring-ardoise-200'
                  }`}
                >
                  {t.centre.nom}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="carte p-4 text-sm text-rose-600">
          La caisse n'a pas pu être lue. Rechargez la page ; si ça recommence, c'est à signaler.
        </div>
      )}

      {isLoading && <div className="carte p-6 text-sm text-ardoise-500">Lecture de la caisse…</div>}

      {data && !periodeAlEnvers && (
        <>
          {/* L'arrêté de toutes les caisses retenues */}
          <div className="carte p-5">
            <div className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
              Du {leJour(du)} au {leJour(au)}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-10 gap-y-4">
              <Chiffre titre="Encaissé" valeur={euros(groupe.encaisse)} />
              <Chiffre titre="Frais Alma" valeur={`− ${euros(groupe.frais)}`} teinte="text-rose-600" />
              <Chiffre titre="Net" valeur={euros(groupe.net)} teinte="text-marine-700" gros />
              <Chiffre titre="En attente" valeur={euros(groupe.attente)} />
            </div>
            {retenus.length === 0 && (
              <p className="mt-3 text-sm text-ardoise-500">Aucune caisse retenue.</p>
            )}
            <div className="mt-4 border-t border-ardoise-200 pt-3">
              <Legende />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {retenus.map((t) => {
              const ouvert = deplie.includes(t.centre.id);
              return (
                <section key={t.centre.id} className="carte flex flex-col gap-4 p-5">
                  <div>
                    <h2 className="text-lg font-semibold text-ardoise-900">{t.centre.nom}</h2>
                    {t.activite && (
                      <p className="text-2xs uppercase tracking-wide text-ardoise-400">
                        {t.activite.seances} séances · {t.activite.bilans} bilans ·{' '}
                        {t.activite.cures} cure{t.activite.cures > 1 ? 's' : ''} signée
                        {t.activite.cures > 1 ? 's' : ''}
                        {t.activite.cures > 0 && ` · ${euros(t.activite.signe)}`}
                      </p>
                    )}
                  </div>

                  {t.moyens.length === 0 ? (
                    <p className="text-sm italic text-ardoise-500">
                      Aucun règlement pointé sur la période.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {t.moyens.map((m) => (
                        <div key={m.moyen ?? 'sans'} className="flex items-baseline gap-2 text-sm">
                          <Pastille moyen={m.moyen} />
                          <span className={m.moyen ? 'text-ardoise-700' : 'font-medium text-rose-600'}>
                            {libelleDuMoyen(m.moyen)}
                          </span>
                          <span className="text-2xs text-ardoise-400">
                            {m.nb} {m.moyen === 'alma' ? 'cure' : 'règlement'}
                            {m.nb > 1 ? 's' : ''}
                          </span>
                          <span className="flex-1 border-b border-dotted border-ardoise-200" />
                          <span className="tabular-nums text-ardoise-900">{euros(m.montant)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 border-t border-ardoise-200 pt-3">
                    <Total titre="Total encaissé" valeur={euros(t.arrete.encaisse)} />
                    {t.arrete.frais > 0 && (
                      <Total
                        titre="Frais Alma"
                        valeur={`− ${euros(t.arrete.frais)}`}
                        teinte="text-rose-600"
                      />
                    )}
                    <div className="mt-1 flex items-baseline gap-2 border-t-2 border-ardoise-900 pt-2">
                      <span className="text-sm font-bold text-ardoise-900">Net</span>
                      <span className="flex-1" />
                      <span className="text-xl font-bold tabular-nums text-marine-700">
                        {euros(t.arrete.net)}
                      </span>
                    </div>
                  </div>

                  {t.entrees.length > 0 && (
                    <div className="border-t border-dashed border-ardoise-200 pt-3">
                      <button
                        type="button"
                        onClick={() =>
                          setDeplie((v) =>
                            ouvert ? v.filter((x) => x !== t.centre.id) : [...v, t.centre.id],
                          )
                        }
                        aria-expanded={ouvert}
                        className="flex w-full items-center gap-2 text-sm font-medium text-marine-700 print:hidden"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${ouvert ? 'rotate-180' : ''}`}
                        />
                        Détail des règlements ({t.entrees.length})
                      </button>

                      <ul className={`mt-3 flex flex-col divide-y divide-dotted divide-ardoise-200 ${ouvert ? '' : 'hidden print:flex'}`}>
                        {t.entrees.map((e, i) => (
                          <li key={`${e.cliente}-${e.date}-${i}`} className="py-2">
                            <div className="flex items-baseline gap-2">
                              {/*
                                Le nom ouvre la fiche dans un nouvel onglet :
                                on vient vérifier une ligne, on revient au
                                ticket sans avoir perdu sa période ni ses
                                caisses.
                              */}
                              <Link
                                to={`/clientes/${e.clienteId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 text-sm font-semibold text-ardoise-900 transition-colors hover:text-marine-700 hover:underline"
                              >
                                {e.cliente}
                              </Link>
                              <span className="tabular-nums text-sm text-ardoise-900">
                                {euros(e.montant)}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-1.5 text-2xs text-ardoise-500">
                              <Pastille moyen={e.moyen} />
                              <span>
                              {leJourCourt(e.date)} · {libelleDuMoyen(e.moyen)} ·{' '}
                              {libelleDeLEntree(e)}
                              {e.frais > 0 && ` · dont ${euros(e.frais)} de frais`}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-baseline gap-2 border-t border-dashed border-ardoise-200 pt-3 text-sm text-ardoise-500">
                    <span>
                      Reste à encaisser
                      <span className="block text-2xs">
                        {t.restant.nb} échéance{t.restant.nb > 1 ? 's' : ''} échue
                        {t.restant.nb > 1 ? 's' : ''} non pointée{t.restant.nb > 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="flex-1" />
                    <span className="font-semibold tabular-nums text-ardoise-900">
                      {euros(t.restant.montant)}
                    </span>
                  </div>

                  {(t.bilansSeuls.length > 0 || t.complements.length > 0) && (
                    <div className="flex flex-col gap-2 border-t border-dashed border-ardoise-200 pt-3 text-2xs text-ardoise-500">
                      <span className="font-semibold uppercase tracking-wide text-ardoise-400">
                        Hors caisse
                      </span>
                      {t.bilansSeuls.map((b, i) => (
                        <span key={`b${i}`}>
                          Bilan de {b.cliente}, facturé {euros(b.montant)} : sans cure derrière, ni
                          sa date ni son moyen de règlement ne sont enregistrés.
                        </span>
                      ))}
                      {t.complements.length > 0 && (
                        <span>
                          {t.complements.reduce((s, v) => s + v.quantite, 0)} complément
                          {t.complements.reduce((s, v) => s + v.quantite, 0) > 1 ? 's' : ''} vendu
                          {t.complements.reduce((s, v) => s + v.quantite, 0) > 1 ? 's' : ''} pour{' '}
                          {euros(t.complements.reduce((s, v) => s + v.montant, 0))} : leur moyen de
                          règlement n'est pas enregistré.
                        </span>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <p className="text-2xs text-ardoise-400">
            Une échéance compte le jour où elle a été réglée, pas le jour où elle était due. Une
            cure Alma est encaissée en entier à la signature : l'organisme avance l'argent et
            porte le risque. Ses frais repartent chez lui et sont déduits du net.
          </p>
        </>
      )}
    </div>
  );
}

function Chiffre({
  titre,
  valeur,
  teinte = 'text-ardoise-900',
  gros = false,
}: {
  titre: string;
  valeur: string;
  teinte?: string;
  gros?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
        {titre}
      </span>
      <span className={`tabular-nums font-bold ${gros ? 'text-2xl' : 'text-lg'} ${teinte}`}>
        {valeur}
      </span>
    </div>
  );
}

function Total({
  titre,
  valeur,
  teinte = 'text-ardoise-900',
}: {
  titre: string;
  valeur: string;
  teinte?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-ardoise-700">{titre}</span>
      <span className="flex-1" />
      <span className={`tabular-nums ${teinte}`}>{valeur}</span>
    </div>
  );
}
