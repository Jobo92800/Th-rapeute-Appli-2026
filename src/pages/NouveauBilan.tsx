import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  ChevronLeft,
  Sparkles,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ChoisirUnCentre from '../components/ChoisirUnCentre';
import { useCentre, useSession } from '../lib/session';
import { lireBaremeActif, lireGrilleTarifaire } from '../services/metier';
import { creerCliente } from '../services/clientes';
import { formaterEuros } from '../domain/tarification';
import { envoyerRecap } from '../services/recap';
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

type Vue = 'accueil' | 'questions' | 'restitution' | 'devis' | 'fini';

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
      setVue('accueil');
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
   * L'enregistrement de fin de bilan, dans ses trois issues.
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
          toast.success('Bilan enregistré · le récapitulatif part par mail');
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
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ardoise-600">
            Le questionnaire se remplit par la cliente, seule, sur tablette — une dizaine de
            minutes. Vous reprenez ensuite la main pour saisir l'analyse InBody, puis vous
            restituez son BioPortrait ensemble.
          </p>

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
              <ChampContact id="a_ville" libelle="Ville" v={contact.ville} on={(v) => setContact((c) => ({ ...c, ville: v }))} />
            </div>
          </div>

          <button
            onClick={() => {
              if (!contact.prenom.trim() || !contact.nom.trim()) {
                toast.error('Le nom et le prénom sont nécessaires pour commencer.');
                return;
              }
              setVue('questions');
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
        onBilanSeul={(p) => enregistrerTout(p, { valider: false, recap: false })}
        onRecap={(p) => enregistrerTout(p, { valider: false, recap: true })}
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
          : 'Le profil de la cliente';

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
              Ces coordonnées créeront la fiche de la cliente.
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
              <ChampContact id="c_ville" libelle="Ville" v={contact.ville} on={(v) => setContact((c) => ({ ...c, ville: v }))} />
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
