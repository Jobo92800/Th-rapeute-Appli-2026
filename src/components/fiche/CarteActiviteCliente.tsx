import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Activity, CalendarCheck, CheckCircle2, Headphones, Loader2, Scale, Smartphone } from 'lucide-react';
import { activiteCliente, type ActiviteCliente } from '../../services/metier';
import { laCliente, pronom } from '../../domain/civilite';
import type { Cliente } from '../../types/db';

/**
 * Ce que la cliente fait dans son application, entre deux rendez-vous.
 *
 * La fiche sait tout de ce qui se passe au centre et rien de ce qui se passe
 * chez elle. On accueillait donc une cliente pour sa sixième séance sans
 * savoir qu'elle avait arrêté le parcours à l'étape 2, ou qu'elle ne s'était
 * pas pesée depuis trois semaines. Ces quatre chiffres permettent d'ouvrir la
 * séance sur du réel.
 *
 * **Lecture seule, et discrète** : rien ne s'affiche tant que l'application
 * cliente ne répond pas ou que la cliente n'a pas de compte. On ne reproche
 * rien — on signale en ambre ce qui mérite une question, pas une remontrance.
 */

const JOURS_SANS_NOUVELLES = 10;
const JOURS_SANS_PESEE = 14;

function Chiffre({
  icone: Icone,
  libelle,
  valeur,
  detail,
  alerte = false,
}: {
  icone: typeof Scale;
  libelle: string;
  valeur: string;
  detail?: string;
  alerte?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${alerte ? 'border-amber-200 bg-amber-50' : 'border-ardoise-200 bg-white'}`}>
      <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
        <Icone className="h-3.5 w-3.5" />
        {libelle}
      </p>
      <p className={`mt-1.5 text-lg font-semibold ${alerte ? 'text-amber-900' : 'text-ardoise-900'}`}>{valeur}</p>
      {detail && <p className={`text-xs ${alerte ? 'text-amber-700' : 'text-ardoise-500'}`}>{detail}</p>}
    </div>
  );
}

const ilYA = (jours: number | null) =>
  jours == null ? '—' : jours === 0 ? "aujourd'hui" : jours === 1 ? 'hier' : `il y a ${jours} jours`;

export default function CarteActiviteCliente({ cliente }: { cliente: Cliente }) {
  const { data, isLoading } = useQuery({
    queryKey: ['activite-nutrition', cliente.id],
    queryFn: () => activiteCliente(cliente.id),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <section className="carte px-5 py-6 text-center text-sm text-ardoise-400">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
      </section>
    );
  }

  /* Pas de compte, ou l'application ne répond pas : on n'encombre pas la fiche. */
  if (!data) return null;

  const a: ActiviteCliente = data;

  /*
    TANT QUE LES CLIENTES SONT SUR MON PARCOURS, ON NE DIT RIEN DE CELLE-CI
    (Jonathan, 21 octobre 2026).

    Cette carte lit l'application nutrition, qui n'est pas encore ouverte au
    public : aucune cliente n'y va, et toutes auraient donc eu le bandeau
    « elle n'a encore jamais ouvert l'application ». Il est exact — et il se
    lit pourtant comme « elle n'a rien ouvert du tout », juste à côté de son
    avancement sur Mon Parcours, où elle écoute vraiment. Reprocher au
    comptoir une absence qui n'en est pas une, c'est pire que de se taire.

    On le remettra le jour de la bascule : il redeviendra vrai au sens où on
    l'entend.
  */
  if (a.jamaisVenue) return null;
  const silencieuse = a.jamaisVenue || (a.joursDepuisOuverture ?? 0) > JOURS_SANS_NOUVELLES;

  return (
    <section className="carte p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="surtitre flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Dans son application
        </h2>
        <span className="text-xs text-ardoise-400">
          {a.jamaisVenue
            ? "n'a jamais ouvert l'application"
            : `dernière visite ${ilYA(a.joursDepuisOuverture)}`}
        </span>
      </div>

      {a.jamaisVenue ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Son compte existe, mais {laCliente(cliente.civilite)} n'a encore jamais ouvert l'application.
          C'est le moment de l'installer avec {pronom(cliente.civilite) === 'il' ? 'lui' : 'elle'} : un
          accès depuis l'écran d'accueil change tout.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {a.parcours && (
            <Chiffre
              icone={Headphones}
              libelle="Parcours"
              valeur={`${a.parcours.terminees} / ${a.parcours.total}`}
              detail={
                a.parcours.titreEnCours
                  ? `${a.parcours.titreEnCours} · ${a.parcours.tauxEnCours} % écouté`
                  : undefined
              }
              alerte={(a.parcours.joursDepuisEcoute ?? 0) > JOURS_SANS_NOUVELLES}
            />
          )}

          <Chiffre
            icone={Scale}
            libelle="Ses pesées"
            valeur={a.poids.dernier != null ? `${a.poids.dernier} kg` : 'aucune'}
            detail={
              a.poids.dernierLe
                ? `${format(new Date(a.poids.dernierLe), 'd MMM', { locale: fr })}${
                    a.poids.ecart != null && a.poids.nombre > 1
                      ? ` · ${a.poids.ecart > 0 ? '+' : ''}${a.poids.ecart} kg depuis la 1ʳᵉ`
                      : ''
                  }`
                : 'elle ne se pèse pas dans l’application'
            }
            alerte={a.poids.nombre > 0 && (a.poids.joursDepuis ?? 0) > JOURS_SANS_PESEE}
          />

          <Chiffre
            icone={CheckCircle2}
            libelle="Ses objectifs"
            valeur={`${a.objectifs.cochees} / ${a.objectifs.total}`}
            detail={`cette semaine · ${a.objectifs.joursParfaits7} jour${
              a.objectifs.joursParfaits7 > 1 ? 's' : ''
            } parfait${a.objectifs.joursParfaits7 > 1 ? 's' : ''} sur 7`}
          />

          <Chiffre
            icone={CalendarCheck}
            libelle="Repas planifiés"
            valeur={String(a.repas.planifiesCetteSemaine)}
            detail="cette semaine"
          />
        </div>
      )}

      {silencieuse && !a.jamaisVenue && (
        <p className="mt-3 flex items-start gap-2 text-xs text-amber-800">
          <Smartphone className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Sans nouvelles depuis {a.joursDepuisOuverture} jours. Une question ouverte en début de
          séance vaut mieux qu'un rappel.
        </p>
      )}
    </section>
  );
}
