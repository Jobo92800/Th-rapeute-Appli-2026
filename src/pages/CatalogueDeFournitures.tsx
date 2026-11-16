/*
  LE CATALOGUE DES FOURNITURES — direction seulement.

  Ce que les thérapeutes peuvent cocher sur la liste de courses, et où ça
  s'achète. Deux choses à faire ici, et l'écran les met dans cet ordre :
  compléter les produits qui n'ont pas d'adresse, et faire entrer au
  catalogue ce qui est tapé à la main chaque semaine.
*/

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Link2Off, Plus, Sparkles, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSession } from '../lib/session';
import { texteErreur } from '../lib/erreurs';
import { CATEGORIES } from '../domain/courses';
import {
  nettoyerLesLiens,
  normaliserLeLien,
  refusDEnregistrement,
  sansAdresse,
  type CategorieDeFourniture,
  type FournitureDuCatalogue,
} from '../domain/fournitures';
import {
  enregistrerLaFourniture,
  lireLeCatalogue,
  promouvoirLaCourse,
} from '../services/fournitures';

/** Ce que le formulaire manipule : des champs, pas encore une fourniture. */
interface Brouillon {
  id: string | null;
  nom: string;
  categorie: CategorieDeFourniture;
  unite: string;
  /** Toujours au moins un champ affiché, même vide. */
  liens: string[];
  /** Null = tous les centres. */
  centres: string[] | null;
  actif: boolean;
}

const VIERGE: Brouillon = {
  id: null,
  nom: '',
  categorie: 'hygiene',
  unite: 'unité',
  liens: [''],
  centres: null,
  actif: true,
};

function brouillonDe(f: FournitureDuCatalogue): Brouillon {
  return {
    id: f.id,
    nom: f.nom,
    categorie: f.categorie,
    unite: f.unite,
    liens: f.liens.length > 0 ? [...f.liens] : [''],
    centres: f.centres,
    actif: f.actif,
  };
}

export default function CatalogueDeFournitures() {
  const { role } = useSession();
  const client = useQueryClient();
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['catalogue-fournitures'],
    queryFn: lireLeCatalogue,
    enabled: role === 'direction',
  });

  const rafraichir = () => {
    client.invalidateQueries({ queryKey: ['catalogue-fournitures'] });
    /* La liste de courses affiche le même catalogue : elle doit suivre. */
    client.invalidateQueries({ queryKey: ['liste-de-courses'] });
  };
  const alerter = (e: unknown) =>
    /* `texteErreur` sait lire une erreur Supabase, qui n'est pas un `Error` :
       sans elle, la cause réelle était remplacée par une phrase creuse. */
    toast.error(texteErreur(e));

  const mEnregistrer = useMutation({
    mutationFn: (b: Brouillon) =>
      enregistrerLaFourniture({
        id: b.id,
        nom: b.nom.trim(),
        categorie: b.categorie,
        unite: b.unite.trim(),
        liens: nettoyerLesLiens(b.liens),
        centres: b.centres,
        actif: b.actif,
      }),
    onSuccess: (_id, b) => {
      toast.success(b.id ? 'Fourniture modifiée.' : `« ${b.nom.trim()} » est au catalogue.`);
      setBrouillon(null);
      rafraichir();
    },
    onError: alerter,
  });

  const mPromouvoir = useMutation({
    mutationFn: (libelle: string) => promouvoirLaCourse(libelle),
    onSuccess: (_id, libelle) => {
      toast.success(`« ${libelle} » est au catalogue. Ajoutez-lui son adresse d'achat.`);
      rafraichir();
    },
    onError: alerter,
  });

  const rayons = useMemo(() => {
    const tout = data?.fournitures ?? [];
    return CATEGORIES.map((c) => ({
      ...c,
      fournitures: tout.filter((f) => f.categorie === c.id),
    })).filter((r) => r.fournitures.length > 0);
  }, [data]);

  const sansLien = (data?.fournitures ?? []).filter((f) => f.actif && sansAdresse(f));

  if (role !== 'direction') {
    return (
      <div className="carte p-6">
        <h1 className="text-lg font-semibold text-ardoise-900">Catalogue des fournitures</h1>
        <p className="mt-2 text-sm text-ardoise-600">
          Le catalogue se modifie depuis un compte de direction. Votre liste de courses, elle,
          est <Link to="/courses" className="font-semibold text-marine-700 hover:underline">par ici</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/courses"
            className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-ardoise-500 hover:text-marine-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Liste de courses
          </Link>
          <h1 className="text-xl font-semibold text-ardoise-900">Catalogue des fournitures</h1>
          <p className="text-sm text-ardoise-600">
            Ce que les thérapeutes peuvent cocher, et où ça s'achète.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBrouillon(VIERGE)}
          className="bouton-principal"
        >
          <Plus className="h-4 w-4" />
          Nouvelle fourniture
        </button>
      </div>

      {isLoading && <p className="text-sm text-ardoise-500">Lecture du catalogue…</p>}

      {/* ------------------------------------------------------------------ */}
      {/* 1. Ce qui revient chaque semaine et n'est pas encore au catalogue  */}
      {/* ------------------------------------------------------------------ */}
      {(data?.a_promouvoir.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-marine-200 bg-marine-50/60 p-5">
          <h2 className="surtitre flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Demandé plusieurs fois à la main
          </h2>
          <p className="mt-1.5 text-sm text-ardoise-600">
            Ce n'est plus un achat de circonstance. Faites-le entrer au catalogue : les
            thérapeutes n'auront plus à le retaper, et vous pourrez lui donner son adresse.
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-dotted divide-marine-200">
            {data!.a_promouvoir.map((c) => (
              <li key={c.libelle} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="flex-1 text-sm font-semibold text-ardoise-900">
                  {c.libelle}
                  <span className="ml-2 text-2xs font-normal text-ardoise-500">
                    {c.demandes} fois · {c.centres.length === 1 ? '1 centre' : `${c.centres.length} centres`}
                    {c.en_cours && ' · demandé cette semaine'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => mPromouvoir.mutate(c.libelle)}
                  disabled={mPromouvoir.isPending}
                  className="bouton-discret !px-4 !py-1.5 !text-xs"
                >
                  Ajouter au catalogue
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Les produits sans adresse : c'est ce qui bloque la commande     */}
      {/* ------------------------------------------------------------------ */}
      {sansLien.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/70 p-5">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            <Link2Off className="h-3.5 w-3.5" />
            {sansLien.length === 1
              ? '1 fourniture sans adresse d’achat'
              : `${sansLien.length} fournitures sans adresse d’achat`}
          </h2>
          <p className="mt-1.5 text-sm text-ardoise-600">
            Celles-là, il faudra les acheter à la main. Collez-leur un lien et elles
            partiront avec le reste.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sansLien.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setBrouillon(brouillonDe(f))}
                className="rounded-full border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-medium text-ardoise-700 hover:border-marine-400 hover:text-marine-700"
              >
                {f.nom}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. Le catalogue, rayon par rayon                                    */}
      {/* ------------------------------------------------------------------ */}
      {rayons.map((rayon) => (
        <section key={rayon.id} className="carte p-5">
          <h2 className="surtitre">{rayon.libelle}</h2>
          <ul className="mt-3 flex flex-col divide-y divide-dotted divide-ardoise-200">
            {rayon.fournitures.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <button
                  type="button"
                  onClick={() => setBrouillon(brouillonDe(f))}
                  className="flex-1 min-w-[12rem] text-left text-sm font-semibold text-ardoise-900 hover:text-marine-700 hover:underline"
                >
                  {f.nom}
                  <span className="ml-1.5 text-2xs font-normal text-ardoise-400">{f.unite}</span>
                  {!f.actif && (
                    <span className="ml-2 rounded-full bg-ardoise-100 px-2 py-0.5 text-2xs font-medium text-ardoise-500">
                      retirée
                    </span>
                  )}
                </button>

                <span className="text-2xs text-ardoise-400">
                  {f.centres === null ? 'tous les centres' : `${f.centres.length} centre${f.centres.length > 1 ? 's' : ''}`}
                  {f.demandes > 0 && ` · ${f.demandes} demandes`}
                </span>

                {f.liens.length === 0 ? (
                  <span className="flex items-center gap-1 text-2xs font-medium text-amber-700">
                    <Link2Off className="h-3 w-3" />
                    sans adresse
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <a
                      href={f.liens[0]}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-2xs font-medium text-marine-700 hover:underline"
                    >
                      Voir
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {f.liens.length > 1 && (
                      <span className="text-2xs text-ardoise-400">
                        +{f.liens.length - 1} repli{f.liens.length > 2 ? 's' : ''}
                      </span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {brouillon && (
        <Formulaire
          brouillon={brouillon}
          centres={data?.centres ?? []}
          enCours={mEnregistrer.isPending}
          onChange={setBrouillon}
          onFermer={() => setBrouillon(null)}
          onEnregistrer={() => mEnregistrer.mutate(brouillon)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LE FORMULAIRE                                                              */
/* -------------------------------------------------------------------------- */

function Formulaire({
  brouillon,
  centres,
  enCours,
  onChange,
  onFermer,
  onEnregistrer,
}: {
  brouillon: Brouillon;
  centres: Array<{ id: string; nom: string }>;
  enCours: boolean;
  onChange: (b: Brouillon) => void;
  onFermer: () => void;
  onEnregistrer: () => void;
}) {
  /* Un formulaire vierge n'a encore rien fait de mal : on ne le gronde
     qu'une fois qu'on y a touché. Le bouton, lui, reste désactivé. */
  const [touche, setTouche] = useState(brouillon.id !== null);

  const modifie = (champs: Partial<Brouillon>) => {
    setTouche(true);
    onChange({ ...brouillon, ...champs });
  };

  const refus = refusDEnregistrement({
    nom: brouillon.nom,
    unite: brouillon.unite,
    liens: brouillon.liens,
    centres: brouillon.centres,
  });

  const changerLien = (i: number, valeur: string) => {
    const liens = [...brouillon.liens];
    liens[i] = valeur;
    modifie({ liens });
  };

  /* Au moment de quitter le champ, l'adresse se réduit sous les yeux :
     on voit ce qui a été gardé, plutôt que de le découvrir après coup. */
  const nettoyerLeLien = (i: number) => {
    const propre = normaliserLeLien(brouillon.liens[i] ?? '');
    if (propre === brouillon.liens[i]) return;
    const liens = [...brouillon.liens];
    liens[i] = propre;
    modifie({ liens });
  };

  const retirerLien = (i: number) => {
    const liens = brouillon.liens.filter((_, j) => j !== i);
    modifie({ liens: liens.length > 0 ? liens : [''] });
  };

  const basculerCentre = (id: string) => {
    /* « Tous les centres » est l'état par défaut ; cocher un centre le quitte. */
    const actuels = brouillon.centres ?? centres.map((c) => c.id);
    const suivants = actuels.includes(id)
      ? actuels.filter((c) => c !== id)
      : [...actuels, id];
    modifie({ centres: suivants.length === centres.length ? null : suivants });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ardoise-900/40 p-4 py-10">
      <div className="carte w-full max-w-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-ardoise-900">
            {brouillon.id ? brouillon.nom || 'Fourniture' : 'Nouvelle fourniture'}
          </h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-ardoise-400 hover:bg-ardoise-100 hover:text-ardoise-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label className="etiquette" htmlFor="nom">
              Nom
            </label>
            <input
              id="nom"
              className="champ"
              value={brouillon.nom}
              onChange={(e) => modifie({ nom: e.target.value })}
              placeholder="Papier toilette"
            />
            <p className="mt-1 text-2xs text-ardoise-400">
              C'est ce que la thérapeute lira sur sa liste.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="etiquette" htmlFor="categorie">
                Rayon
              </label>
              <select
                id="categorie"
                className="champ"
                value={brouillon.categorie}
                onChange={(e) => modifie({ categorie: e.target.value as CategorieDeFourniture })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="etiquette" htmlFor="unite">
                Unité
              </label>
              <input
                id="unite"
                className="champ"
                value={brouillon.unite}
                onChange={(e) => modifie({ unite: e.target.value })}
                placeholder="paquet"
              />
            </div>
          </div>

          {/* Les adresses : la première s'achète, les suivantes sont des replis. */}
          <div>
            <span className="etiquette">Où l'acheter</span>
            <div className="flex flex-col gap-2">
              {brouillon.liens.map((lien, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-xs font-semibold text-ardoise-400">
                    {i + 1}
                  </span>
                  <input
                    className="champ"
                    value={lien}
                    onChange={(e) => changerLien(i, e.target.value)}
                    onBlur={() => nettoyerLeLien(i)}
                    placeholder={
                      i === 0
                        ? 'Collez le lien de la page du produit'
                        : 'Adresse de secours, si la première est en rupture'
                    }
                  />
                  {brouillon.liens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => retirerLien(i)}
                      aria-label={`Retirer l'adresse ${i + 1}`}
                      className="rounded-full p-2 text-ardoise-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => modifie({ liens: [...brouillon.liens, ''] })}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-marine-700 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une adresse de secours
            </button>
            <p className="mt-1.5 text-2xs text-ardoise-400">
              Collez le lien tel qu'il est : il sera nettoyé de tout son suivi. Laissez vide
              si la fourniture s'achète à la main — elle sera signalée comme telle.
            </p>
          </div>

          <div>
            <span className="etiquette">Dans quels centres</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => modifie({ centres: null })}
                className={
                  brouillon.centres === null
                    ? 'rounded-full bg-marine-600 px-3.5 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-full border border-ardoise-200 bg-white px-3.5 py-1.5 text-xs font-medium text-ardoise-600 hover:border-marine-400'
                }
              >
                Tous les centres
              </button>
              {centres.map((c) => {
                const coche = brouillon.centres === null || brouillon.centres.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => basculerCentre(c.id)}
                    className={
                      brouillon.centres !== null && coche
                        ? 'rounded-full bg-marine-600 px-3.5 py-1.5 text-xs font-semibold text-white'
                        : 'rounded-full border border-ardoise-200 bg-white px-3.5 py-1.5 text-xs font-medium text-ardoise-600 hover:border-marine-400'
                    }
                  >
                    {c.nom}
                  </button>
                );
              })}
            </div>
          </div>

          {brouillon.id && (
            <label className="flex items-center gap-2.5 text-sm text-ardoise-700">
              <input
                type="checkbox"
                checked={!brouillon.actif}
                onChange={(e) => modifie({ actif: !e.target.checked })}
                className="h-4 w-4 rounded border-ardoise-300 text-marine-600 focus:ring-0"
              />
              Retirer du catalogue
              <span className="text-2xs text-ardoise-400">
                — les listes passées la gardent
              </span>
            </label>
          )}
        </div>

        {touche && refus && <p className="mt-4 text-sm font-medium text-rose-600">{refus}</p>}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onFermer} className="bouton-discret">
            Annuler
          </button>
          <button
            type="button"
            onClick={onEnregistrer}
            disabled={!!refus || enCours}
            className="bouton-principal"
          >
            {enCours ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
