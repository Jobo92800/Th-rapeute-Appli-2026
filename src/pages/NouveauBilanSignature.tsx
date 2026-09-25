import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import ChoisirUnCentre from '../components/ChoisirUnCentre';
import { useCentre, useSession } from '../lib/session';
import { useVilleAutomatique } from '../lib/villeAutomatique';
import {
  creerProgramme,
  enregistrerBilan,
  lireBaremeSignatureActif,
  lireGrilleTarifaire,
} from '../services/metier';
import { creerCliente, lireCliente, modifierCliente } from '../services/clientes';
import { etatDuCentre } from '../services/stock';
import { envoyerDocumentRecap, rangerDocumentBioPortrait } from '../services/recap';
import { construireRecapSignature } from '../domain/recapitulatif';
import { formaterEuros } from '../domain/tarification';
import {
  CODE_SECURITE,
  calculerProfilSignature,
  choixSignature,
  precoterLesZones,
  preconiserLaCure,
  questionsAPoser,
  securiteBloquante,
  signatureDisponible,
  soinRecent,
  type CarteDesZones,
  type Cotation,
  type ReponsesSignature,
} from '../domain/profilSignature';
import type { EtapeBareme } from '../domain/bioportrait';
import {
  CONTACT_VIDE,
  FormulaireCoordonnees,
  coordonneesPourLaFiche,
  type Contact,
} from '../components/bilan/Coordonnees';
import QuestionBioPortrait from '../components/bilan/QuestionBioPortrait';
import Progression from '../components/bilan/Progression';
import ObservationDesZones from '../components/bilan/ObservationDesZones';
import RestitutionSignature from '../components/bilan/RestitutionSignature';
import DevisSignature from '../components/bilan/DevisSignature';
import type { PrescriptionValidee } from '../components/bilan/CureEtDevis';

/*
  Le Bilan Profil Signature anti-âge — le troisième bilan, au Crès et à
  Sérignan.

  Son déroulé a un temps de plus que les deux autres : entre le
  questionnaire et la restitution, LA THÉRAPEUTE OBSERVE. Elle cote sept
  zones que les réponses ont déjà pré-cotées, et cette carte décide de la
  moitié de chaque axe et de la cure entière.

    coordonnées → sécurité → questions → observation → Profil Signature → cure

  L'écran de sécurité est le seul qui ne se tourne pas vers la cliente :
  six cases que la thérapeute coche, et dont une seule interdit la séance.
*/

type Vue = 'accueil' | 'securite' | 'questions' | 'observation' | 'restitution' | 'devis';

export default function NouveauBilanSignature() {
  const centre = useCentre();
  const { therapeute, tousCentres } = useSession();
  const navigate = useNavigate();

  const [params] = useSearchParams();
  const clienteExistanteId = params.get('cliente');
  const { data: clienteExistante } = useQuery({
    queryKey: ['cliente', clienteExistanteId],
    queryFn: () => lireCliente(clienteExistanteId!),
    enabled: Boolean(clienteExistanteId),
  });

  const { data: baremeData, isLoading, error } = useQuery({
    queryKey: ['bareme-signature'],
    queryFn: lireBaremeSignatureActif,
    staleTime: Infinity,
  });
  const { data: grille } = useQuery({
    queryKey: ['tarifs'],
    queryFn: lireGrilleTarifaire,
    staleTime: 5 * 60_000,
  });
  const { data: rayon = [] } = useQuery({
    queryKey: ['stock', centre.id],
    queryFn: () => etatDuCentre(centre.id),
  });

  const [vue, setVue] = useState<Vue>('accueil');
  const [etape, setEtape] = useState(0);
  const [reponses, setReponses] = useState<ReponsesSignature>({});
  /* Ce que la thérapeute a coté elle-même : le questionnaire ne l'écrase jamais. */
  const [ajustees, setAjustees] = useState<CarteDesZones>({});
  const [contact, setContact] = useState<Contact>({ ...CONTACT_VIDE });
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    if (!clienteExistante) return;
    setContact({
      civilite: (clienteExistante.civilite ?? 'Mme') as 'Mme' | 'M.',
      date_naissance: clienteExistante.date_naissance ?? '',
      prenom: clienteExistante.prenom,
      nom: clienteExistante.nom,
      email: clienteExistante.email ?? '',
      telephone: clienteExistante.telephone ?? '',
      adresse: clienteExistante.adresse ?? '',
      code_postal: clienteExistante.code_postal ?? '',
      ville: clienteExistante.ville ?? '',
      age: clienteExistante.age != null ? String(clienteExistante.age) : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteExistante?.id]);

  const villes = useVilleAutomatique(contact.code_postal, contact.ville, (v) =>
    setContact((c) => ({ ...c, ville: v })),
  );

  const bareme = baremeData?.bareme;
  const carte = useMemo(
    () => (bareme ? precoterLesZones(bareme, reponses, ajustees) : {}),
    [bareme, reponses, ajustees],
  );
  const resultat = useMemo(
    () => (bareme ? calculerProfilSignature(bareme, reponses, carte) : null),
    [bareme, reponses, carte],
  );

  if (tousCentres) {
    return <ChoisirUnCentre quoi="Un bilan crée une fiche cliente, et une fiche appartient à un centre." />;
  }

  if (!signatureDisponible(centre.id)) {
    return (
      <div className="carte px-5 py-12 text-center">
        <h1 className="text-lg font-semibold text-ardoise-900">Au Crès et à Sérignan</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ardoise-500">
          Le Bilan Profil Signature et la radiofréquence ne se proposent que dans ces deux centres.
          Le Grau-du-Roi a son Profil Signature avec l’Advance Lift.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <p className="carte px-5 py-12 text-center text-sm text-ardoise-400">Chargement du questionnaire…</p>;
  }

  if (error || !bareme || !resultat || !baremeData) {
    return (
      <div className="carte px-5 py-10 text-center">
        <p className="text-sm text-rose-700">
          Le questionnaire du Profil Signature n’a pas pu être chargé. Vérifiez que la migration 071
          a bien été exécutée dans Supabase.
        </p>
      </div>
    );
  }

  /* La sécurité se coche à part : elle n'est pas une question de la cliente. */
  const questions = questionsAPoser(bareme, reponses).filter((q) => q.groupe !== 'secu');
  const indexEtape = Math.min(Math.max(0, etape), Math.max(0, questions.length - 1));
  const q = questions[indexEtape];
  const derniere = indexEtape >= questions.length - 1;
  const prenomAffiche = contact.prenom.trim() || 'vous';
  const bloque = securiteBloquante(bareme, reponses);
  const differee = soinRecent(bareme, reponses);
  const groupe = bareme.GROUPES.find((g) => g.id === q?.groupe);

  function suivant() {
    window.scrollTo(0, 0);
    if (derniere) {
      setVue('observation');
      return;
    }
    setEtape((e) => Math.min(e + 1, questions.length - 1));
  }

  function precedent() {
    if (etape === 0) setVue('securite');
    else setEtape((e) => e - 1);
    window.scrollTo(0, 0);
  }

  function repondre(index: number) {
    if (!q) return;
    if (q.multi) {
      setReponses((r) => {
        const actuels = choixSignature(r, q.code);
        const suivants = actuels.includes(index) ? actuels.filter((i) => i !== index) : [...actuels, index];
        return { ...r, [q.code]: suivants };
      });
      return;
    }
    setReponses((r) => ({ ...r, [q.code]: index }));
    setTimeout(suivant, 220);
  }

  /**
   * L'enregistrement.
   *
   * Le premier rendez-vous — le Profil Signature et le premier soin — se
   * règle dans tous les cas : 89 €, cure ou pas. La cure, si elle est
   * validée, s'ajoute pour ce qu'elle vaut ; elle ne rembourse ni ne
   * remplace ce qui a déjà été payé.
   */
  async function enregistrerTout(proposition: PrescriptionValidee | null, issue: 'valider' | 'seul') {
    if (!contact.prenom.trim() || !contact.nom.trim()) {
      toast.error('Le nom et le prénom sont nécessaires pour enregistrer.');
      return;
    }
    if (!bareme || !resultat || !grille || !baremeData) return;

    setEnregistrement(true);
    try {
      const coordonnees = coordonneesPourLaFiche(contact);
      const cliente = clienteExistante
        ? await modifierCliente(clienteExistante.id, coordonnees)
        : await creerCliente(centre.id, {
            ...coordonnees,
            source: null,
            therapeutes: therapeute && therapeute.role !== 'direction' ? [therapeute.prenom] : [],
          });

      const bilan = await enregistrerBilan({
        cliente_id: cliente.id,
        centre_id: centre.id,
        statut: 'termine',
        famille: 'signature',
        bareme_version: baremeData.version,
        reponses: reponses as unknown as Record<string, number>,
        curseur: 0,
        texte_libre: '',
        inbody: {},
        /* La carte des zones : sans elle, la moitié de chaque axe ne se relirait pas. */
        observation: carte as unknown as Record<string, number>,
        scores: {
          ...resultat.axes,
          ...Object.fromEntries(Object.entries(resultat.scoresTerrain).map(([k, v]) => [`terrain_${k}`, v])),
        },
        profil_dominant: resultat.profil,
        terrain_dominant: resultat.terrains[0] ?? null,
        profils_secondaires: [],
        terrains_secondaires: resultat.terrains.slice(1),
        /*
          LE PREMIER RENDEZ-VOUS SE FACTURE TOUJOURS, cure ou pas : elle a
          reçu son Profil Signature et son premier soin le jour même, et
          ce qu'elle décide ensuite n'y change rien. C'est la différence
          avec les deux autres bilans, où le bilan devient offert dès que
          la cure démarre.
        */
        facturation: 'facture',
        montant_facture: grille.bilan_signature,
        proposition: proposition ? (proposition as unknown as Record<string, unknown>) : null,
      });

      if (issue === 'valider' && proposition) {
        await creerProgramme({
          clienteId: cliente.id,
          bilanId: bilan.id,
          centreId: centre.id,
          lignes: proposition.lignes,
          electro: false,
          guide: false,
          tenue: false,
          prixGuide: 0,
          prixTenue: 0,
          montantTotal: proposition.montantTotal,
          modeReglement: proposition.modeReglement,
          fraisFinancement: proposition.frais,
          echeances: proposition.echeances,
          complementRecommande: null,
          complements: proposition.complements,
        });
      }

      const donnees = construireRecapSignature({
        bareme,
        resultat,
        carte,
        proposition: {
          lignes: proposition?.lignes ?? [],
          guide: false,
          tenue: false,
          prixGuide: 0,
          prixTenue: 0,
          complements: proposition?.complements ?? [],
          montantTotal: proposition?.montantTotal ?? 0,
          modeReglement: proposition?.modeReglement ?? 'inconnu',
          frais: proposition?.frais ?? 0,
          echeances: proposition?.echeances ?? [],
        },
        cliente: { civilite: contact.civilite, prenom: contact.prenom.trim(), nom: contact.nom.trim() },
        centre: {
          nom: centre.nom,
          adresse: centre.adresse,
          codePostal: centre.code_postal,
          ville: centre.ville,
          telephone: centre.telephone,
          email: centre.email,
        },
        dateBilan: new Date().toISOString().slice(0, 10),
      });

      /*
        Le Profil Signature seul part au dossier dans le CRM, quoi qu'elle
        décide — champ « Profil Signature », comme le BioPortrait a le sien.
        Son échec n'arrête rien : la tâche reste en file.
      */
      try {
        await rangerDocumentBioPortrait(bilan.id, donnees);
      } catch (err) {
        console.error(err);
      }

      /* Sans cure, elle repart avec son Profil Signature et la proposition, par mail. */
      if (issue === 'seul' && proposition) {
        try {
          await envoyerDocumentRecap(bilan.id, donnees);
          toast.success(
            `Premier rendez-vous enregistré (${formaterEuros(grille.bilan_signature)} à facturer) · le récapitulatif part par mail`,
          );
        } catch (err) {
          console.error(err);
          toast.error(
            "Le bilan est enregistré, mais le récapitulatif n'a pas pu partir. Renvoyez-le depuis sa fiche.",
          );
        }
      } else {
        toast.success(
          issue === 'valider'
            ? `Cure validée · ${formaterEuros(grille.bilan_signature)} du premier rendez-vous à facturer en plus`
            : `Premier rendez-vous enregistré (${formaterEuros(grille.bilan_signature)} à facturer)`,
        );
      }
      navigate(`/clientes/${cliente.id}`);
    } catch (e) {
      console.error(e);
      toast.error("L'enregistrement a échoué. Vérifiez les coordonnées et réessayez.");
      setEnregistrement(false);
    }
  }

  // -------------------------------------------------------------------------

  if (vue === 'accueil') {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <header>
          <div className="surtitre">Bilan Profil Signature anti-âge</div>
          <h1 className="mt-1 text-3xl font-light tracking-tight text-ardoise-900">
            Une cure de <b className="font-semibold">radiofréquence</b>
          </h1>
          <p className="mt-2 text-sm text-ardoise-500">
            Le questionnaire, votre observation zone par zone, le Profil Signature, puis la cure.
          </p>
        </header>

        <div className="carte p-5">
          <FormulaireCoordonnees contact={contact} setContact={setContact} villes={villes} prefixe="ps" />
        </div>

        <button
          onClick={() => {
            if (!contact.prenom.trim() || !contact.nom.trim()) {
              toast.error('Le nom et le prénom, au minimum.');
              return;
            }
            setVue('securite');
            window.scrollTo(0, 0);
          }}
          className="bouton-fort w-full justify-center py-3 text-[15px]"
        >
          <Sparkles className="h-4 w-4" />
          Commencer le bilan
        </button>
      </div>
    );
  }

  if (vue === 'securite') {
    const cochees = choixSignature(reponses, CODE_SECURITE);
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <header>
          <div className="surtitre">Avant tout</div>
          <h1 className="mt-1 text-3xl font-light tracking-tight text-ardoise-900">
            Ce qui <b className="font-semibold">interdit</b> la séance
          </h1>
          <p className="mt-2 text-sm text-ardoise-500">
            {bareme.GROUPES.find((g) => g.id === 'secu')?.detail}
          </p>
        </header>

        <section className="carte p-5">
          <p className="mb-3 text-sm font-semibold text-ardoise-900">
            Cochez ce qui concerne la cliente :
          </p>
          <div className="flex flex-col gap-2">
            {bareme.SECURITE.map((s, i) => {
              const actif = cochees.includes(i);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setReponses((r) => {
                      const a = choixSignature(r, CODE_SECURITE);
                      return {
                        ...r,
                        [CODE_SECURITE]: a.includes(i) ? a.filter((x) => x !== i) : [...a, i],
                      };
                    })
                  }
                  aria-pressed={actif}
                  className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-left text-sm transition-colors ${
                    actif
                      ? 'border-rose-400 bg-rose-50 text-rose-900'
                      : 'border-ardoise-200 bg-white hover:border-rose-200'
                  }`}
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded-md border-2 ${
                      actif ? 'border-rose-500 bg-rose-500' : 'border-ardoise-300'
                    }`}
                  />
                  {s}
                </button>
              );
            })}
          </div>

          {bloque && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Ne réalisez pas la séance : orientez la cliente vers un avis médical. Le bilan peut
              se faire, la cure ne se vend pas.
            </p>
          )}
        </section>

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setVue('accueil')} className="bouton-discret">
            <ChevronLeft className="h-4 w-4" />
            Les coordonnées
          </button>
          <button
            onClick={() => {
              setVue('questions');
              setEtape(0);
              window.scrollTo(0, 0);
            }}
            className="bouton-fort"
          >
            {cochees.length === 0 ? 'Rien à signaler, on continue' : 'Continuer le bilan'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (vue === 'questions' && q) {
    /* Le composant du BioPortrait sait afficher une question : on lui donne la nôtre. */
    const etapeAffichee: EtapeBareme = {
      type: q.multi ? 'multi' : 'radio',
      t: q.t,
      o: q.o.map((o) => [o[0]] as unknown as EtapeBareme['o'] extends (infer U)[] ? U : never),
    };

    return (
      <div className="mx-auto max-w-2xl">
        <Progression libelle="Votre peau" etape={indexEtape} total={questions.length} />

        <div className="carte mt-4 p-6 sm:p-8">
          <QuestionBioPortrait
            etape={etapeAffichee}
            theme={groupe ? [groupe.titre, '#F2EEFA', '#7A5CB5'] : undefined}
            choisis={choixSignature(reponses, q.code)}
            onChoisir={repondre}
          />
          {groupe?.detail && <p className="mt-4 text-xs text-ardoise-400">{groupe.detail}</p>}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button onClick={precedent} className="bouton-discret">
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </button>
          <button onClick={suivant} className="bouton-principal">
            {derniere ? 'Passer à l’observation' : 'Suivant'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (vue === 'observation') {
    return (
      <div className="space-y-5">
        <ObservationDesZones
          bareme={bareme}
          carte={carte}
          ajustees={ajustees}
          onCoter={(code, valeur: Cotation) => setAjustees((a) => ({ ...a, [code]: valeur }))}
        />
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 border-t border-ardoise-200 pt-5">
          <button
            onClick={() => {
              setVue('questions');
              setEtape(questions.length - 1);
              window.scrollTo(0, 0);
            }}
            className="bouton-discret"
          >
            <ChevronLeft className="h-4 w-4" />
            Les questions
          </button>
          <button
            onClick={() => {
              setVue('restitution');
              window.scrollTo(0, 0);
            }}
            className="bouton-fort"
          >
            Voir son Profil Signature
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (vue === 'restitution') {
    return (
      <RestitutionSignature
        bareme={bareme}
        resultat={resultat}
        carte={carte}
        reponses={reponses}
        prenom={prenomAffiche}
        onRetour={() => {
          setVue('observation');
          window.scrollTo(0, 0);
        }}
        onSuite={() => {
          setVue('devis');
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  if (vue === 'devis' && grille) {
    return (
      <DevisSignature
        bareme={bareme}
        carte={carte}
        reponses={reponses}
        grille={grille}
        prenom={prenomAffiche}
        catalogue={rayon}
        bloque={bloque}
        differee={differee}
        enregistrement={enregistrement}
        onRetour={() => {
          setVue('restitution');
          window.scrollTo(0, 0);
        }}
        onBilanSeul={(p) => enregistrerTout(p, 'seul')}
        onValider={(p) => enregistrerTout(p, 'valider')}
      />
    );
  }

  return (
    <p className="carte px-5 py-12 text-center text-sm text-ardoise-400">
      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
    </p>
  );
}

/** La cure que le bilan préconise, pour l'annoncer avant de l'ouvrir. */
export function curePreconisee(bareme: Parameters<typeof preconiserLaCure>[0], carte: CarteDesZones) {
  return preconiserLaCure(bareme, carte).cure.nom;
}
