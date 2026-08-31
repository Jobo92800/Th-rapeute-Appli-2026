import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  Check,
  ChevronLeft,
  Sparkles,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCentre, useSession } from '../lib/session';
import { lireBaremeActif, lireGrilleTarifaire } from '../services/metier';
import { creerCliente } from '../services/clientes';
import { enregistrerBilan, creerProgramme } from '../services/metier';
import {
  calculerEmpreinte,
  complementRecommande,
  mesuresInbody,
  phraseSynthese,
  prioriteCure,
  type Reponses,
} from '../domain/empreinte';
import Restitution from '../components/bilan/Restitution';
import Devis, { type Prescription } from '../components/bilan/Devis';

type Vue = 'accueil' | 'questions' | 'restitution' | 'devis' | 'fini';

const CONTACT_VIDE = {
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
  const { therapeute } = useSession();
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

  const empreinte = useMemo(
    () => (bareme ? calculerEmpreinte(bareme, reponses) : null),
    [bareme, reponses],
  );

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
  const s = steps[etape];
  const derniere = etape === steps.length - 1;
  const prenomAffiche = contact.prenom.trim() || 'vous';

  // -------------------------------------------------------------------------

  function suivant() {
    if (derniere) {
      setVue('restitution');
      window.scrollTo(0, 0);
    } else {
      setEtape((e) => e + 1);
      window.scrollTo(0, 0);
    }
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
    setReponses((r) => ({ ...r, [etape]: index }));
    // On enchaîne tout seul : le rythme du questionnaire compte.
    setTimeout(suivant, 220);
  }

  async function enregistrerTout(prescription: Prescription | null) {
    if (!contact.prenom.trim() || !contact.nom.trim()) {
      toast.error('Le nom et le prénom de la cliente sont nécessaires pour enregistrer.');
      return;
    }
    if (!empreinte || !grille || !bareme || !baremeData) return;

    setEnregistrement(true);
    try {
      const cliente = await creerCliente(centre.id, {
        prenom: contact.prenom.trim(),
        nom: contact.nom.trim(),
        email: contact.email || null,
        telephone: contact.telephone || null,
        date_naissance: null,
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
        scores: empreinte.pourcentages,
        profil_dominant: empreinte.profilDominant,
        terrain_dominant: empreinte.terrainDominant,
        profils_secondaires: empreinte.profilsSecondaires,
        terrains_secondaires: empreinte.terrainsSecondaires,
        facturation: prescription ? 'offert' : 'facture',
        montant_facture: prescription ? 0 : grille.bilan,
      });

      if (prescription) {
        const complement = complementRecommande(bareme, empreinte);
        await creerProgramme({
          clienteId: cliente.id,
          bilanId: bilan.id,
          centreId: centre.id,
          lignes: prescription.lignes,
          electro: prescription.electro,
          prixGuide: grille.guide,
          prixTenue: grille.tenue,
          montantTotal: prescription.montantTotal,
          modeReglement: prescription.modeReglement,
          fraisFinancement: prescription.frais,
          echeances: prescription.echeances,
          complementRecommande: complement?.nom ?? null,
        });
      }

      toast.success(
        prescription ? 'Cure validée et enregistrée' : 'Bilan enregistré (87 € à facturer)',
      );
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
            Bilan Empreinte
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ardoise-600">
            Le questionnaire se remplit par la cliente, seule, sur tablette — une dizaine de
            minutes. Vous reprenez ensuite la main pour saisir l'analyse InBody, puis vous
            restituez son Empreinte ensemble.
          </p>

          <div className="mt-7">
            <label htmlFor="prenom-accueil" className="etiquette text-center">
              Prénom de la cliente
            </label>
            <input
              id="prenom-accueil"
              value={contact.prenom}
              onChange={(e) => setContact((c) => ({ ...c, prenom: e.target.value }))}
              className="champ mx-auto max-w-xs text-center"
              placeholder="Sophie"
            />
          </div>

          <button
            onClick={() => {
              setVue('questions');
              setEtape(0);
            }}
            className="bouton-principal mt-6"
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

  if (vue === 'restitution' && empreinte) {
    return (
      <Restitution
        bareme={bareme}
        empreinte={empreinte}
        prenom={prenomAffiche}
        synthese={phraseSynthese(bareme, empreinte)}
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

  if (vue === 'devis' && empreinte && grille) {
    return (
      <Devis
        grille={grille}
        prenom={prenomAffiche}
        priorite={prioriteCure(bareme, empreinte)}
        complement={complementRecommande(bareme, empreinte)}
        profil={bareme.AX[empreinte.profilDominant].name}
        terrain={bareme.AX[empreinte.terrainDominant].name}
        contact={contact}
        onContact={setContact}
        enregistrement={enregistrement}
        onRetour={() => setVue('restitution')}
        onBilanSeul={() => enregistrerTout(null)}
        onValider={(p) => enregistrerTout(p)}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Questionnaire
  // -------------------------------------------------------------------------

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
    s.type !== 'radio' || reponses[etape] != null || s.type === undefined;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progression */}
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-2xs font-semibold uppercase tracking-widest text-ardoise-500">
            {libellePhase}
          </span>
          <span className="chiffres text-2xs font-semibold text-ardoise-400">
            {etape + 1} / {steps.length}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-ardoise-200">
          <div
            className="h-full rounded-full bg-marine-600 transition-all duration-300"
            style={{ width: `${((etape + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="carte p-6 sm:p-8">
        {s.phase === 'analyse' && (
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-2xs font-semibold uppercase tracking-widest text-rose-700">
            <Activity className="h-3 w-3" />
            Saisie thérapeute · InBody
          </span>
        )}

        {s.type === 'radio' && (
          <>
            {s.major && (
              <p className="mb-2 text-2xs font-semibold uppercase tracking-widest text-marine-700">
                Choisissez ce qui est le plus vrai
              </p>
            )}
            <h2 className="text-lg font-semibold leading-snug text-ardoise-900">{s.t}</h2>
            <div className="mt-5 flex flex-col gap-2.5">
              {s.o!.map(([libelle], i) => {
                const choisi = reponses[etape] === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => repondre(i)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-colors ${
                      choisi
                        ? 'border-marine-600 bg-marine-50 font-semibold text-marine-900'
                        : 'border-ardoise-200 bg-white text-ardoise-700 hover:border-marine-400 hover:bg-ardoise-50'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        choisi ? 'border-marine-600 bg-marine-600' : 'border-ardoise-300'
                      }`}
                    >
                      {choisi && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
                    </span>
                    {libelle}
                  </button>
                );
              })}
            </div>
          </>
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
