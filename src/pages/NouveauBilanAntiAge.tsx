import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ChevronLeft, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import ChoisirUnCentre from '../components/ChoisirUnCentre';
import { useCentre, useSession } from '../lib/session';
import { useVilleAutomatique } from '../lib/villeAutomatique';
import {
  creerProgramme,
  enregistrerBilan,
  lireBaremeAntiAgeActif,
  lireGrilleTarifaire,
} from '../services/metier';
import { creerCliente, lireCliente, modifierCliente } from '../services/clientes';
import { envoyerDocumentRecap, rangerDocumentBioPortrait } from '../services/recap';
import { construireRecapAntiAge } from '../domain/recapitulatif';
import { formaterEuros } from '../domain/tarification';
import {
  CENTRE_ANTI_AGE,
  calculerAntiAge,
  choixAntiAge,
  questionsAPoser,
  type ReponsesAntiAge,
} from '../domain/antiAge';
import type { EtapeBareme } from '../domain/bioportrait';
import {
  CONTACT_VIDE,
  FormulaireCoordonnees,
  coordonneesPourLaFiche,
  type Contact,
} from '../components/bilan/Coordonnees';
import QuestionBioPortrait from '../components/bilan/QuestionBioPortrait';
import Progression from '../components/bilan/Progression';
import RestitutionAntiAge from '../components/bilan/RestitutionAntiAge';
import DevisAntiAge from '../components/bilan/DevisAntiAge';
import type { PrescriptionValidee } from '../components/bilan/CureEtDevis';

/*
  Le Bio-Portrait Anti-Âge — le second bilan, au Grau-du-Roi.

  Même déroulé que le BioPortrait : les coordonnées, une page d'intention,
  les questions, la restitution, puis la cure. Ce qui change : le
  questionnaire (quatorze questions sur la peau), le résultat (un profil
  anti-âge et un terrain cutané, sans pourcentage), et la cure — de
  l'Advance Lift, dont la thérapeute fixe elle-même le nombre de séances.
*/

type Vue = 'accueil' | 'intro' | 'questions' | 'restitution' | 'devis';

export default function NouveauBilanAntiAge() {
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
    queryKey: ['bareme-anti-age'],
    queryFn: lireBaremeAntiAgeActif,
    staleTime: Infinity,
  });
  const { data: grille } = useQuery({
    queryKey: ['tarifs'],
    queryFn: lireGrilleTarifaire,
    staleTime: 5 * 60_000,
  });

  const [vue, setVue] = useState<Vue>('accueil');
  const [etape, setEtape] = useState(0);
  const [reponses, setReponses] = useState<ReponsesAntiAge>({});
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
  const resultat = useMemo(() => (bareme ? calculerAntiAge(bareme, reponses) : null), [bareme, reponses]);

  if (tousCentres) {
    return <ChoisirUnCentre quoi="Un bilan crée une fiche cliente, et une fiche appartient à un centre." />;
  }

  if (centre.id !== CENTRE_ANTI_AGE) {
    return (
      <div className="carte px-5 py-12 text-center">
        <h1 className="text-lg font-semibold text-ardoise-900">Réservé au Grau-du-Roi</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ardoise-500">
          Le Bio-Portrait Anti-Âge et l’Advance Lift ne se proposent qu’au Grau-du-Roi.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <p className="carte px-5 py-12 text-center text-sm text-ardoise-400">Chargement du questionnaire…</p>;
  }

  if (error || !bareme || !resultat) {
    return (
      <div className="carte px-5 py-10 text-center">
        <p className="text-sm text-rose-700">
          Le questionnaire anti-âge n’a pas pu être chargé. Vérifiez que la migration 056 a bien été
          exécutée dans Supabase.
        </p>
      </div>
    );
  }

  /*
    Les questions à poser dépendent des réponses — « Lesquels ? » ne vient
    qu'après un oui. La liste se recalcule à chaque réponse, et l'étape est
    bornée à la dernière : deux clics rapprochés ne mènent nulle part.
  */
  const questions = questionsAPoser(bareme, reponses);
  const indexEtape = Math.min(Math.max(0, etape), Math.max(0, questions.length - 1));
  const q = questions[indexEtape];
  const derniere = indexEtape >= questions.length - 1;
  const prenomAffiche = contact.prenom.trim() || 'vous';

  function suivant() {
    window.scrollTo(0, 0);
    if (derniere) {
      setVue('restitution');
      return;
    }
    setEtape((e) => Math.min(e + 1, questions.length - 1));
  }

  function precedent() {
    if (etape === 0) setVue('intro');
    else setEtape((e) => e - 1);
    window.scrollTo(0, 0);
  }

  function repondre(index: number) {
    if (!q) return;
    if (q.type === 'multi') {
      setReponses((r) => {
        const actuels = choixAntiAge(r, q.code);
        const suivants = actuels.includes(index) ? actuels.filter((i) => i !== index) : [...actuels, index];
        return { ...r, [q.code]: suivants };
      });
      return;
    }
    setReponses((r) => ({ ...r, [q.code]: index }));
    setTimeout(suivant, 220);
  }

  /**
   * L'enregistrement, dans ses trois issues : elle démarre une cure, elle
   * repart avec sa première séance et son Bio-Portrait par mail, ou — sur
   * une cliente déjà suivie — on refait le point sans rien facturer.
   */
  async function enregistrerTout(proposition: PrescriptionValidee | null, issue: 'valider' | 'seul' | 'suivi') {
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

      /*
        Sans cure, la cliente règle sa première séance — 85 €, le prix d'une
        séance d'Advance Lift. Il n'y a pas de bilan à part : c'est la
        séance qui se facture. Sur un point de suivi, rien.
      */
      const bilan = await enregistrerBilan({
        cliente_id: cliente.id,
        centre_id: centre.id,
        statut: 'termine',
        famille: 'anti_age',
        bareme_version: baremeData.version,
        reponses: reponses as unknown as Record<string, number>,
        curseur: 0,
        texte_libre: '',
        inbody: {},
        scores: { ...resultat.scores, ...Object.fromEntries(Object.entries(resultat.scoresTerrain).map(([k, v]) => [`terrain_${k}`, v])) },
        profil_dominant: resultat.profil,
        terrain_dominant: resultat.terrains[0] ?? null,
        profils_secondaires: [],
        terrains_secondaires: resultat.terrains.slice(1),
        facturation: issue === 'seul' ? 'facture' : 'offert',
        montant_facture: issue === 'seul' ? grille.advance_lift : 0,
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
        });
      }

      const donnees = construireRecapAntiAge({
        bareme,
        resultat,
        proposition: {
          lignes: proposition?.lignes ?? [],
          guide: false,
          tenue: false,
          prixGuide: 0,
          prixTenue: 0,
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

      /* Le Bio-Portrait seul, au dossier, quoi qu'elle décide. Son échec n'arrête rien. */
      try {
        await rangerDocumentBioPortrait(bilan.id, donnees);
      } catch (err) {
        console.error(err);
      }

      if (issue === 'seul' && proposition) {
        try {
          await envoyerDocumentRecap(bilan.id, donnees);
          toast.success(`Bilan enregistré (${formaterEuros(grille.advance_lift)} à facturer) · le récapitulatif part par mail`);
        } catch (err) {
          console.error(err);
          toast.error("Le bilan est enregistré, mais le récapitulatif n'a pas pu partir. Renvoyez-le depuis sa fiche.");
        }
      } else {
        toast.success(
          issue === 'suivi'
            ? 'Nouveau Bio-Portrait enregistré sur sa fiche'
            : issue === 'valider'
              ? 'Cure validée et enregistrée'
              : `Bilan enregistré (${formaterEuros(grille.advance_lift)} à facturer)`,
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
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate(clienteExistante ? `/clientes/${clienteExistante.id}` : '/clientes')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ardoise-500 hover:text-ardoise-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {clienteExistante ? `${clienteExistante.prenom} ${clienteExistante.nom}` : 'Clientes'}
        </button>

        <div className="carte px-8 py-10 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
            <Sparkles className="h-6 w-6 text-rose-600" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-ardoise-900">Bio-Portrait Anti-Âge</h1>
          <p className="mt-1 text-sm text-ardoise-500">Le Grau-du-Roi · Advance Lift</p>

          {clienteExistante && (
            <p className="mx-auto mt-4 max-w-md rounded-lg border border-marine-200 bg-marine-50 px-3 py-2 text-sm text-marine-900">
              Nouveau point pour <b>{clienteExistante.prenom} {clienteExistante.nom}</b>. Sa fiche et ses
              anciens bilans sont conservés — celui-ci s’ajoute.
            </p>
          )}

          <div className="mt-8 text-left">
            <div className="surtitre mb-3">Ses coordonnées</div>
            <FormulaireCoordonnees contact={contact} setContact={setContact} villes={villes} prefixe="aa" />
          </div>

          <button
            onClick={() => {
              if (!contact.prenom.trim() || !contact.nom.trim()) {
                toast.error('Le nom et le prénom sont nécessaires pour commencer.');
                return;
              }
              setVue('intro');
              setEtape(0);
            }}
            className="bouton-fort mt-7"
          >
            Commencer le bilan
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (vue === 'intro') {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="carte overflow-hidden">
          <div className="bg-gradient-to-br from-rose-50 via-white to-marine-50 px-7 py-10 text-center sm:px-12">
            <p className="text-2xs font-semibold uppercase tracking-widest text-rose-600">Avant de commencer</p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ardoise-900 sm:text-3xl">
              Votre Bio-Portrait <span className="text-rose-600">Anti-Âge</span>
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-ardoise-700">
              Quatorze questions sur votre peau : ce dont elle a besoin, et comment elle réagit. Vos
              réponses dessinent votre profil anti-âge et votre terrain cutané. Il n’y a ni bonne ni
              mauvaise réponse — quand plusieurs vous ressemblent, choisissez la plus forte.
            </p>
          </div>
          <div className="border-t border-ardoise-100 px-7 py-6 sm:px-12">
            <p className="text-xs text-ardoise-400">{bareme.MENTION}</p>
            <button onClick={() => setVue('questions')} className="bouton-fort mt-6 w-full justify-center py-3 text-[15px]">
              Je commence
              <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => setVue('accueil')} className="mt-3 w-full text-center text-xs text-ardoise-400 hover:text-ardoise-700">
              Revenir aux coordonnées
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (vue === 'restitution') {
    return (
      <RestitutionAntiAge
        bareme={bareme}
        resultat={resultat}
        prenom={prenomAffiche}
        onRetour={() => {
          setVue('questions');
          setEtape(questions.length - 1);
        }}
        onSuite={() => {
          setVue('devis');
          window.scrollTo(0, 0);
        }}
        onEnregistrerSeulement={clienteExistante ? () => enregistrerTout(null, 'suivi') : undefined}
        enregistrement={enregistrement}
      />
    );
  }

  if (vue === 'devis' && grille) {
    return (
      <DevisAntiAge
        grille={grille}
        prenom={prenomAffiche}
        enregistrement={enregistrement}
        onRetour={() => setVue('restitution')}
        onBilanSeul={() => enregistrerTout(null, 'seul')}
        onValider={(p) => enregistrerTout(p, 'valider')}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Questionnaire
  // -------------------------------------------------------------------------

  if (!q) {
    return (
      <div className="carte px-5 py-12 text-center">
        <h1 className="text-lg font-semibold text-ardoise-900">Questionnaire indisponible</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ardoise-500">
          Le barème anti-âge actif ne contient aucune question.
        </p>
      </div>
    );
  }

  /* QuestionBioPortrait lit une étape du barème perte de poids : on lui donne la forme qu'il attend. */
  const etapeAffichee: EtapeBareme = { type: q.type, t: q.t, o: q.o.map((o) => [o[0], {}]) };
  const peutAvancer = choixAntiAge(reponses, q.code).length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Progression libelle="Votre peau" etape={indexEtape} total={questions.length} />

      <div className="carte p-6 sm:p-8">
        <QuestionBioPortrait
          etape={etapeAffichee}
          theme={['Bio-Portrait Anti-Âge', '#FBE3EA', '#A24E6C']}
          choisis={choixAntiAge(reponses, q.code)}
          onChoisir={repondre}
        />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button onClick={precedent} className="bouton-discret">
          <ChevronLeft className="h-4 w-4" />
          Retour
        </button>
        {(q.type === 'multi' || peutAvancer) && (
          <button onClick={suivant} className="bouton-principal">
            {derniere ? 'Voir la conclusion du bilan' : 'Suivant'}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {enregistrement && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ardoise-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Enregistrement…
        </p>
      )}
    </div>
  );
}
