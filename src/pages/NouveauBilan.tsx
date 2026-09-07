import { useMemo, useState } from 'react';
import { useVilleAutomatique } from '../lib/villeAutomatique';
import ChoixDeVille from '../components/ChoixDeVille';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  ChevronLeft,
  Clock,
  HeartHandshake,
  ListChecks,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ChoisirUnCentre from '../components/ChoisirUnCentre';
import { useCentre, useSession } from '../lib/session';
import { lireBaremeActif, lireGrilleTarifaire } from '../services/metier';
import { creerCliente } from '../services/clientes';
import { laCliente } from '../domain/civilite';
import { formaterEuros } from '../domain/tarification';
import { envoyerRecap, rangerBioPortrait } from '../services/recap';
import { enregistrerBilan, creerProgramme } from '../services/metier';
import {
  choix,
  calculerBioPortrait,
  complementRecommande,
  mesuresInbody,
  phraseSynthese,
  type Reponses,
} from '../domain/bioportrait';
import Restitution from '../components/bilan/Restitution';
import { depouiller } from '../domain/prescription';
import QuestionBioPortrait from '../components/bilan/QuestionBioPortrait';
import Progression from '../components/bilan/Progression';
import CureEtDevis, { type PrescriptionValidee } from '../components/bilan/CureEtDevis';

type Vue = 'accueil' | 'intro' | 'questions' | 'restitution' | 'devis' | 'fini';

/** L'âge se calcule : on ne le demande pas deux fois. */
function ageDepuis(naissance: string): string {
  if (!naissance) return '';
  const d = new Date(naissance);
  if (Number.isNaN(d.getTime())) return '';

  const maintenant = new Date();
  let age = maintenant.getFullYear() - d.getFullYear();
  const m = maintenant.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && maintenant.getDate() < d.getDate())) age--;

  return age > 0 && age < 120 ? String(age) : '';
}

const CONTACT_VIDE = {
  civilite: 'Mme' as 'Mme' | 'M.',
  date_naissance: '',
  prenom: '',
  nom: '',
  email: '',
  telephone: '',
  adresse: '',
  code_postal: '',
  ville: '',
  age: '',
};

export default function NouveauBilan() {
  const centre = useCentre();
  const { therapeute, tousCentres } = useSession();
  const navigate = useNavigate();

  const { data: baremeData, isLoading, error } = useQuery({
    queryKey: ['bareme'],
    queryFn: lireBaremeActif,
    staleTime: Infinity,
  });

  const { data: grille } = useQuery({
    queryKey: ['tarifs'],
    queryFn: lireGrilleTarifaire,
    staleTime: 5 * 60_000,
  });

  const [vue, setVue] = useState<Vue>('accueil');
  const [etape, setEtape] = useState(0);
  const [reponses, setReponses] = useState<Reponses>({});
  const [curseur, setCurseur] = useState(50);
  const [texte, setTexte] = useState('');
  const [contact, setContact] = useState({ ...CONTACT_VIDE });

  // La ville se déduit du code postal quand il n'y a qu'une commune. Les deux
  // écrans de coordonnées — l'accueil du bilan et l'étape finale — remplissent
  // le même objet : un seul branchement suffit.
  const villes = useVilleAutomatique(contact.code_postal, contact.ville, (v) =>
    setContact((c) => ({ ...c, ville: v })),
  );
  const [enregistrement, setEnregistrement] = useState(false);

  const bareme = baremeData?.bareme;

  const bioportrait = useMemo(
    () => (bareme ? calculerBioPortrait(bareme, reponses) : null),
    [bareme, reponses],
  );

  if (tousCentres) {
    return (
      <ChoisirUnCentre quoi="Un bilan crée une fiche cliente, et une fiche appartient à un centre." />
    );
  }

  if (isLoading) {
    return (
      <p className="carte px-5 py-12 text-center text-sm text-ardoise-400">
        Chargement du questionnaire…
      </p>
    );
  }

  if (error || !bareme) {
    return (
      <div className="carte px-5 py-10 text-center">
        <p className="text-sm text-rose-700">
          Le questionnaire n'a pas pu être chargé. Vérifiez que la migration 005 a bien été
          exécutée dans Supabase.
        </p>
      </div>
    );
  }

  const steps = bareme.STEPS;
  /*
    L'étape est bornée à la dernière : une question à choix unique enchaîne
    toute seule après 220 ms, et deux clics rapprochés faisaient avancer
    deux fois — l'écran cherchait alors une étape qui n'existe pas et se
    vidait, en plein rendez-vous.
  */
  const indexEtape = Math.min(Math.max(0, etape), Math.max(0, steps.length - 1));
  const s = steps[indexEtape];
  const derniere = indexEtape >= steps.length - 1;
  const prenomAffiche = contact.prenom.trim() || 'vous';

  // -------------------------------------------------------------------------

  function suivant() {
    window.scrollTo(0, 0);

    if (derniere) {
      setVue('restitution');
      return;
    }

    // Jamais au-delà de la dernière étape, quels que soient les clics reçus.
    setEtape((e) => Math.min(e + 1, steps.length - 1));
  }

  function precedent() {
    if (etape === 0) {
      /* La page d'intention se relit : on y revient, pas au formulaire. */
      setVue('intro');
    } else {
      setEtape((e) => e - 1);
    }
    window.scrollTo(0, 0);
  }

  function repondre(index: number) {
    const courante = steps[indexEtape];

    if (courante?.type === 'multi') {
      /*
        « Aucune de ces situations » ne se coche pas avec le reste : une
        personne qui a un pacemaker n'a pas « aucune » situation de santé.
        On considère la dernière option comme l'exclusive — c'est ainsi que
        le questionnaire est écrit.
      */
      const exclusive = (courante.o?.length ?? 0) - 1;

      setReponses((r) => {
        const actuels = choix(r, indexEtape);
        const bascule = actuels.includes(index)
          ? actuels.filter((i) => i !== index)
          : [...actuels, index];

        const nettoyes =
          index === exclusive
            ? bascule.filter((i) => i === exclusive)
            : bascule.filter((i) => i !== exclusive);

        return { ...r, [indexEtape]: nettoyes };
      });
      return;
    }

    setReponses((r) => ({ ...r, [indexEtape]: index }));
    // On enchaîne tout seul : le rythme du questionnaire compte.
    setTimeout(suivant, 220);
  }

  /**
   * L'enregistrement de fin de bilan, dans ses deux issues : elle démarre,
   * ou elle repart avec son BioPortrait et la proposition.
   *
   * `proposition` est toujours ce qui était à l'écran — on l'écrit sur le
   * bilan quoi qu'il arrive. Sans elle, un récapitulatif renvoyé trois
   * semaines plus tard annoncerait un autre prix que celui prononcé devant
   * la cliente, parce que la thérapeute ajuste et que les ajustements ne se
   * recalculent pas.
   */
  async function enregistrerTout(
    proposition: PrescriptionValidee,
    issue: { valider: boolean; recap: boolean },
  ) {
    const prescription = issue.valider ? proposition : null;
    if (!contact.prenom.trim() || !contact.nom.trim()) {
      toast.error('Le nom et le prénom sont nécessaires pour enregistrer.');
      return;
    }
    if (!bioportrait || !grille || !bareme || !baremeData) return;

    setEnregistrement(true);
    try {
      const cliente = await creerCliente(centre.id, {
        civilite: contact.civilite,
        prenom: contact.prenom.trim(),
        nom: contact.nom.trim(),
        email: contact.email || null,
        telephone: contact.telephone || null,
        date_naissance: contact.date_naissance || null,
        age: contact.age ? Number(contact.age) : null,
        adresse: contact.adresse || null,
        code_postal: contact.code_postal || null,
        ville: contact.ville || null,
        source: null,
        therapeutes: therapeute && therapeute.role !== 'direction' ? [therapeute.prenom] : [],
      });

      const bilan = await enregistrerBilan({
        cliente_id: cliente.id,
        centre_id: centre.id,
        statut: 'termine',
        bareme_version: baremeData.version,
        reponses: reponses as unknown as Record<string, number>,
        curseur,
        texte_libre: texte,
        inbody: { mesures: mesuresInbody(bareme, reponses) },
        scores: bioportrait.pourcentages,
        profil_dominant: bioportrait.profilDominant,
        terrain_dominant: bioportrait.terrainDominant,
        profils_secondaires: bioportrait.profilsSecondaires,
        terrains_secondaires: bioportrait.terrainsSecondaires,
        facturation: prescription ? 'offert' : 'facture',
        montant_facture: prescription ? 0 : grille.bilan,
        proposition: {
          ...proposition,
          prixGuide: grille.guide,
          prixTenue: grille.tenue,
        } as unknown as Record<string, unknown>,
      });

      if (prescription) {
        const complement = complementRecommande(bareme, bioportrait);
        await creerProgramme({
          clienteId: cliente.id,
          bilanId: bilan.id,
          centreId: centre.id,
          lignes: prescription.lignes,
          electro: prescription.electro,
          guide: prescription.guide,
          tenue: prescription.tenue,
          prixGuide: grille.guide,
          prixTenue: grille.tenue,
          montantTotal: prescription.montantTotal,
          modeReglement: prescription.modeReglement,
          fraisFinancement: prescription.frais,
          echeances: prescription.echeances,
          complementRecommande: complement?.nom ?? null,
        });
      }

      /*
        Le BioPortrait seul est rangé pour CHAQUE bilan, quoi que la cliente
        décide : cure validée, bilan seul, ou récapitulatif envoyé. C'est un
        document qu'on garde au dossier, pas un envoi — aucun mail ne part.

        Son échec est avalé exprès. Un PDF qui n'arrive pas dans le CRM ne
        doit pas faire croire à la thérapeute que le bilan ne s'est pas
        enregistré : il l'est, la tâche reste en file, et la synchro la
        reprendra toute seule.
      */
      try {
        await rangerBioPortrait({
          bilanId: bilan.id,
          bareme,
          bioportrait,
          inbody: mesuresInbody(bareme, reponses),
          proposition: {
            ...proposition,
            prixGuide: grille.guide,
            prixTenue: grille.tenue,
          },
          cliente: {
            civilite: contact.civilite,
            prenom: contact.prenom.trim(),
            nom: contact.nom.trim(),
          },
          centre,
          dateBilan: new Date().toISOString().slice(0, 10),
        });
      } catch (err) {
        console.error(err);
      }

      /*
        Le récapitulatif part après l'enregistrement, jamais avant : s'il
        échouait, le bilan serait quand même sauvé, et la thérapeute pourra
        le renvoyer depuis la fiche.
      */
      if (issue.recap) {
        try {
          await envoyerRecap({
            bilanId: bilan.id,
            bareme,
            bioportrait,
            inbody: mesuresInbody(bareme, reponses),
            proposition: {
              ...proposition,
              prixGuide: grille.guide,
              prixTenue: grille.tenue,
            },
            cliente: {
              civilite: contact.civilite,
              prenom: contact.prenom.trim(),
              nom: contact.nom.trim(),
            },
            centre,
            dateBilan: new Date().toISOString().slice(0, 10),
          });
          toast.success(
            `Bilan enregistré (${formaterEuros(grille.bilan)} à facturer) · le récapitulatif part par mail`,
          );
        } catch (err) {
          console.error(err);
          toast.error(
            "Le bilan est enregistré, mais le récapitulatif n'a pas pu partir. Renvoyez-le depuis sa fiche.",
          );
        }
      } else {
        // Le montant vient de la grille, jamais d'un nombre écrit ici : sinon
        // le message et la facture se contrediraient au prochain changement.
        toast.success(
          prescription
            ? 'Cure validée et enregistrée'
            : `Bilan enregistré (${formaterEuros(grille.bilan)} à facturer)`,
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
  // Accueil
  // -------------------------------------------------------------------------

  if (vue === 'accueil') {
    return (
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate('/clientes')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ardoise-500 hover:text-ardoise-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </button>

        <div className="carte px-8 py-10 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-marine-50">
            <Sparkles className="h-6 w-6 text-marine-700" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-ardoise-900">
            Bilan BioPortrait
          </h1>

          <div className="mt-8 text-left">
            <div className="surtitre mb-3">Ses coordonnées</div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="etiquette">Civilité</span>
                <div className="flex gap-2">
                  {(['Mme', 'M.'] as const).map((civ) => (
                    <button
                      key={civ}
                      type="button"
                      onClick={() => setContact((c) => ({ ...c, civilite: civ }))}
                      aria-pressed={contact.civilite === civ}
                      className={`flex-1 rounded-xl border-[1.5px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                        contact.civilite === civ
                          ? 'border-marine-500 bg-marine-500 text-white'
                          : 'border-ardoise-200 bg-white text-ardoise-700 hover:border-marine-300'
                      }`}
                    >
                      {civ === 'Mme' ? 'Madame' : 'Monsieur'}
                    </button>
                  ))}
                </div>
              </div>

              <ChampContact id="a_prenom" libelle="Prénom" v={contact.prenom} on={(v) => setContact((c) => ({ ...c, prenom: v }))} />
              <ChampContact id="a_nom" libelle="Nom" v={contact.nom} on={(v) => setContact((c) => ({ ...c, nom: v }))} />
              <ChampContact id="a_naissance" libelle="Date de naissance" type="date" v={contact.date_naissance} on={(v) => setContact((c) => ({ ...c, date_naissance: v, age: ageDepuis(v) || c.age }))} />
              <ChampContact id="a_age" libelle="Âge" type="number" v={contact.age} on={(v) => setContact((c) => ({ ...c, age: v }))} />
              <ChampContact id="a_tel" libelle="Téléphone" type="tel" v={contact.telephone} on={(v) => setContact((c) => ({ ...c, telephone: v }))} />
              <ChampContact id="a_mail" libelle="Email" type="email" v={contact.email} on={(v) => setContact((c) => ({ ...c, email: v }))} />
              <div className="sm:col-span-2">
                <ChampContact id="a_adr" libelle="Adresse" v={contact.adresse} on={(v) => setContact((c) => ({ ...c, adresse: v }))} />
              </div>
              <ChampContact id="a_cp" libelle="Code postal" v={contact.code_postal} on={(v) => setContact((c) => ({ ...c, code_postal: v }))} />
              <div>
                <ChampContact id="a_ville" libelle="Ville" v={contact.ville} on={(v) => setContact((c) => ({ ...c, ville: v }))} />
                <ChoixDeVille propositions={villes.propositions} onChoisir={villes.choisir} />
              </div>
            </div>
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

  // -------------------------------------------------------------------------
  // L'intention — la page que la cliente lit avant de répondre
  //
  // Elle ne fait pas partie du questionnaire : elle ne compte pas dans les
  // étapes, on ne peut pas y répondre, et elle ne coûte pas une barre de
  // progression qui n'avancerait pas. C'est le moment où on lui explique
  // pourquoi sa franchise décide de ce qu'on lui proposera.
  // -------------------------------------------------------------------------
  if (vue === 'intro') {
    const questionsClient = steps.filter((e) => e.phase === 'client').length;

    const consignes = [
      {
        icone: ShieldCheck,
        titre: 'Il n’y a ni bonne ni mauvaise réponse',
        texte:
          'Ce questionnaire ne vous juge pas, il vous décrit. Personne ne compare vos réponses à celles de quelqu’un d’autre.',
      },
      {
        icone: HeartHandshake,
        titre: 'Répondez en toute franchise',
        texte:
          'C’est la première étape de votre transformation, et c’est ce qui nous permet de vous proposer ce qui vous convient vraiment — pas ce qui convient à tout le monde.',
      },
      {
        icone: Target,
        titre: 'Plusieurs réponses vous ressemblent ? Choisissez la plus forte',
        texte:
          'Celle qui pèse le plus dans votre quotidien. C’est votre priorité qui oriente la cure. Quand une question invite à cocher plusieurs cases, elle le dit.',
      },
    ];

    const reperes = [
      { icone: ListChecks, texte: `${questionsClient} questions` },
      { icone: Clock, texte: 'À votre rythme' },
      { icone: Lock, texte: 'Réservé à votre centre' },
    ];

    return (
      <div className="mx-auto max-w-2xl">
        <div className="carte overflow-hidden">
          {/*
            La couverture. C'est l'écran qu'on tourne vers la cliente : il
            doit avoir l'air d'un début de programme, pas d'un formulaire
            administratif. Le halo teal et le rose du logo, rien de plus —
            la charte suffit, on n'invente pas une deuxième identité pour
            une seule page.
          */}
          <div className="bg-gradient-to-br from-marine-50 via-white to-rose-50/50 px-7 py-10 text-center sm:px-12">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-marine-100">
              <Sparkles className="h-6 w-6 text-marine-600" />
            </span>

            <p className="mt-5 text-2xs font-semibold uppercase tracking-[0.22em] text-marine-700">
              Bilan BioPortrait
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-ardoise-900">
              Avant de <span className="text-marine-700">commencer</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ardoise-600">
              Vous venez de faire le premier pas, et c’est souvent le plus difficile. La suite,
              nous la faisons avec vous.
            </p>

            {/*
              Ce qui attend la cliente, en trois mots. Savoir combien de
              questions et qu'on ne la chronomètre pas enlève l'essentiel de
              l'appréhension — bien plus qu'une phrase rassurante de plus.
            */}
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {reperes.map((r) => (
                <span
                  key={r.texte}
                  className="inline-flex items-center gap-1.5 rounded-full border border-marine-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-marine-800"
                >
                  <r.icone className="h-3.5 w-3.5 text-marine-600" />
                  {r.texte}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-ardoise-100 px-7 py-8 sm:px-12">
            <p className="text-[15px] leading-relaxed text-ardoise-700">
              Ce questionnaire est le cœur de la méthode MAbeautyplus. Vos réponses dessinent votre{' '}
              <strong className="font-semibold text-marine-800">BioPortrait</strong> : votre profil
              comportemental et votre terrain physiologique — ce qui explique pourquoi votre corps
              réagit comme il réagit. C’est lui qui orientera tout votre accompagnement.
            </p>

            <p className="mt-8 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
              Trois choses à savoir
            </p>

            <div className="mt-3 space-y-2.5">
              {consignes.map((c) => (
                <div
                  key={c.titre}
                  className="flex gap-4 rounded-2xl border border-ardoise-100 bg-white px-5 py-4"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-marine-50 text-marine-700">
                    <c.icone className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ardoise-900">{c.titre}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ardoise-600">
                      {c.texte}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setVue('questions')}
              className="bouton-fort mt-8 w-full justify-center py-3 text-[15px]"
            >
              Je commence
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setVue('accueil')}
              className="mt-3 w-full text-center text-xs text-ardoise-400 hover:text-ardoise-700"
            >
              Revenir aux coordonnées
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Restitution — aucun prix, aucune cure sur cet écran
  // -------------------------------------------------------------------------

  if (vue === 'restitution' && bioportrait) {
    return (
      <Restitution
        bareme={bareme}
        bioportrait={bioportrait}
        prenom={prenomAffiche}
        synthese={phraseSynthese(bareme, bioportrait)}
        mesures={mesuresInbody(bareme, reponses)}
        onRetour={() => {
          setVue('questions');
          setEtape(steps.length - 1);
        }}
        onSuite={() => {
          setVue('devis');
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Devis
  // -------------------------------------------------------------------------

  if (vue === 'devis' && bioportrait && grille) {
    return (
      <CureEtDevis
        bareme={bareme}
        depouillement={depouiller(bareme, reponses)}
        grille={grille}
        prenom={prenomAffiche}
        enregistrement={enregistrement}
        onRetour={() => setVue('restitution')}
        // « Bilan seul » envoie le récapitulatif : il n'y a plus qu'un
        // bouton pour la cliente qui ne démarre pas, et il fait les deux.
        onBilanSeul={(p) => enregistrerTout(p, { valider: false, recap: true })}
        onValider={(p) => enregistrerTout(p, { valider: true, recap: false })}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Questionnaire
  // -------------------------------------------------------------------------

  if (!s) {
    return (
      <div className="carte px-5 py-12 text-center">
        <h1 className="text-lg font-semibold text-ardoise-900">Questionnaire indisponible</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ardoise-500">
          Le barème actif ne contient aucune question. Vérifiez dans Supabase qu’une version est
          bien marquée « actif » dans la table <code>bareme_empreinte</code>.
        </p>
      </div>
    );
  }

  const libellePhase = s.major
    ? 'Question clé'
    : s.phase === 'analyse'
      ? 'Analyse corporelle'
      : s.type === 'contact'
        ? 'Coordonnées'
        : s.type === 'transition'
          ? 'Transition'
          : `Le profil de ${laCliente(contact.civilite)}`;

  const peutAvancer =
    s.type === 'multi' || s.type === 'yesno' || s.type === 'radio'
      ? choix(reponses, indexEtape).length > 0
      : true;

  const theme = s.phase === 'analyse' ? undefined : bareme.CAT?.[s.cat ?? ''];

  return (
    <div className="mx-auto max-w-2xl">
      <Progression
        libelle={theme ? theme[0] : libellePhase}
        etape={indexEtape}
        total={steps.length}
      />

      <div className="carte p-6 sm:p-8">

        {(s.type === 'radio' || s.type === 'multi' || s.type === 'yesno') && (
          <QuestionBioPortrait
            etape={s}
            theme={theme}
            choisis={choix(reponses, indexEtape)}
            onChoisir={repondre}
          />
        )}

        {s.type === 'slider' && (
          <>
            <h2 className="text-lg font-semibold leading-snug text-ardoise-900">{s.t}</h2>
            <div className="mt-6">
              <div className="mb-3 flex justify-between text-xs font-medium text-ardoise-500">
                <span>{s.left}</span>
                <span>{s.right}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={curseur}
                onChange={(e) => setCurseur(Number(e.target.value))}
                className="w-full accent-marine-600"
                aria-label={s.t}
              />
            </div>
          </>
        )}

        {s.type === 'text' && (
          <>
            <h2 className="text-lg font-semibold leading-snug text-ardoise-900">{s.t}</h2>
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={4}
              placeholder="Facultatif"
              className="champ mt-5 resize-y"
            />
          </>
        )}

        {s.type === 'transition' && (
          <div className="py-4 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-marine-50">
              <Activity className="h-6 w-6 text-marine-700" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-ardoise-900">
              Passons à l'analyse de composition corporelle
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ardoise-600">
              Rendez-vous sur la balance InBody. On mesure la composition corporelle en détail,
              puis on revient compléter le bilan ensemble.
            </p>
          </div>
        )}

        {s.type === 'contact' && (
          <>
            <h2 className="text-lg font-semibold text-ardoise-900">Pour finaliser le dossier</h2>
            <p className="mt-1 text-sm text-ardoise-500">
              Ces coordonnées créeront sa fiche.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="etiquette">Civilité</span>
                <div className="flex gap-2">
                  {(['Mme', 'M.'] as const).map((civ) => (
                    <button
                      key={civ}
                      type="button"
                      onClick={() => setContact((c) => ({ ...c, civilite: civ }))}
                      aria-pressed={contact.civilite === civ}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        contact.civilite === civ
                          ? 'border-marine-600 bg-marine-600 text-white'
                          : 'border-ardoise-300 bg-white text-ardoise-700 hover:border-marine-400'
                      }`}
                    >
                      {civ === 'Mme' ? 'Madame' : 'Monsieur'}
                    </button>
                  ))}
                </div>
              </div>
              <ChampContact id="c_nom" libelle="Nom" v={contact.nom} on={(v) => setContact((c) => ({ ...c, nom: v }))} />
              <ChampContact id="c_prenom" libelle="Prénom" v={contact.prenom} on={(v) => setContact((c) => ({ ...c, prenom: v }))} />
              <ChampContact id="c_tel" libelle="Téléphone" type="tel" v={contact.telephone} on={(v) => setContact((c) => ({ ...c, telephone: v }))} />
              <ChampContact id="c_mail" libelle="Email" type="email" v={contact.email} on={(v) => setContact((c) => ({ ...c, email: v }))} />
              <div className="sm:col-span-2">
                <ChampContact id="c_adr" libelle="Adresse" v={contact.adresse} on={(v) => setContact((c) => ({ ...c, adresse: v }))} />
              </div>
              <ChampContact id="c_cp" libelle="Code postal" v={contact.code_postal} on={(v) => setContact((c) => ({ ...c, code_postal: v }))} />
              <div>
                <ChampContact id="c_ville" libelle="Ville" v={contact.ville} on={(v) => setContact((c) => ({ ...c, ville: v }))} />
                <ChoixDeVille propositions={villes.propositions} onChoisir={villes.choisir} />
              </div>
              <ChampContact id="c_age" libelle="Âge" type="number" v={contact.age} on={(v) => setContact((c) => ({ ...c, age: v }))} />
            </div>
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button onClick={precedent} className="bouton-discret">
          <ChevronLeft className="h-4 w-4" />
          Retour
        </button>

        {s.type !== 'radio' && (
          <button onClick={suivant} className="bouton-principal">
            {derniere
              ? 'Voir la conclusion du bilan'
              : s.type === 'transition'
                ? "J'ai la feuille d'analyse, on continue"
                : 'Suivant'}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {s.type === 'radio' && peutAvancer && (
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

function ChampContact({
  id,
  libelle,
  v,
  on,
  type = 'text',
}: {
  id: string;
  libelle: string;
  v: string;
  on: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="etiquette">
        {libelle}
      </label>
      <input id={id} type={type} value={v} onChange={(e) => on(e.target.value)} className="champ" />
    </div>
  );
}
