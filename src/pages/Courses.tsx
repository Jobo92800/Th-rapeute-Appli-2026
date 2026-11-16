import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, ExternalLink, Minus, Plus, Settings2, ShoppingCart, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSession } from '../lib/session';
import {
  ajouter,
  cocher,
  lireLaListe,
  marquerCommandee,
  retirer,
  valider,
} from '../services/courses';
import {
  estHabituelle,
  lundiDeLaSemaine,
  rangerParCategorie,
  type Fourniture,
} from '../domain/courses';

/*
  LA LISTE DE COURSES D'UN CENTRE.

  Toutes les thérapeutes du centre cochent la même liste au fil de la
  semaine. La direction la valide, et c'est elle qui achète.

  La liste de la semaine passée se consulte mais ne se modifie plus : on ne
  retouche pas une liste qu'on est en train d'acheter.
*/

export default function Courses() {
  const { centre, centresAccessibles, role, tousCentres } = useSession();
  const client = useQueryClient();
  const [centreChoisi, setCentreChoisi] = useState<string | null>(centre?.id ?? null);
  const [quoi, setQuoi] = useState('');

  const centreId = tousCentres ? centreChoisi : (centre?.id ?? null);
  const semaine = lundiDeLaSemaine(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ['liste-de-courses', centreId, semaine],
    queryFn: () => lireLaListe(centreId!),
    enabled: !!centreId,
  });

  const rafraichir = () => client.invalidateQueries({ queryKey: ['liste-de-courses'] });
  const alerter = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "L'enregistrement n'est pas passé.");

  const mCocher = useMutation({
    mutationFn: ({ id, quantite }: { id: string; quantite: number }) =>
      cocher(centreId!, id, quantite),
    onSuccess: rafraichir,
    onError: alerter,
  });

  const mAjouter = useMutation({
    mutationFn: (libelle: string) => ajouter(centreId!, libelle),
    onSuccess: () => {
      setQuoi('');
      rafraichir();
    },
    onError: alerter,
  });

  const mRetirer = useMutation({
    mutationFn: retirer,
    onSuccess: rafraichir,
    onError: alerter,
  });

  const mValider = useMutation({
    mutationFn: (validee: boolean) => valider(centreId!, semaine, validee),
    onSuccess: rafraichir,
    onError: alerter,
  });

  const mCommandee = useMutation({
    mutationFn: () => marquerCommandee(centreId!, semaine),
    onSuccess: rafraichir,
    onError: alerter,
  });

  if (tousCentres && !centreId) {
    return (
      <div className="carte p-6">
        <h1 className="text-lg font-semibold text-ardoise-900">Liste de courses</h1>
        <p className="mt-2 text-sm text-ardoise-600">
          Une liste par centre. Choisissez celui dont vous voulez voir la liste.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {centresAccessibles.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCentreChoisi(c.id)}
              className="bouton-discret"
            >
              {c.nom}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const modifiable = data?.ouverte ?? false;
  const aAcheter = (data?.catalogue ?? []).filter((f) => f.quantite > 0);
  const total = aAcheter.length + (data?.libres.length ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ardoise-900">Liste de courses</h1>
          <p className="text-sm text-ardoise-600">
            Semaine du {format(new Date(`${semaine}T12:00:00`), 'd MMMM', { locale: fr })}
            {tousCentres && centreChoisi && ` · ${centresAccessibles.find((c) => c.id === centreChoisi)?.nom ?? ''}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tousCentres && (
            <button type="button" onClick={() => setCentreChoisi(null)} className="bouton-discret">
              Changer de centre
            </button>
          )}
          {role === 'direction' && (
            <Link to="/courses/catalogue" className="bouton-discret">
              <Settings2 className="h-4 w-4" />
              Gérer le catalogue
            </Link>
          )}
        </div>
      </div>

      {isLoading && <div className="carte p-6 text-sm text-ardoise-500">Lecture de la liste…</div>}

      {data && (
        <>
          {/* L'état de la liste, et ce que la direction peut en faire */}
          <div className="carte flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-marine-600" />
              <div>
                <div className="text-sm font-semibold text-ardoise-900">
                  {total === 0
                    ? 'Rien de coché pour le moment'
                    : `${total} article${total > 1 ? 's' : ''} à acheter`}
                </div>
                <div className="text-2xs text-ardoise-500">
                  {data.commandee_le
                    ? `Commandée le ${format(new Date(data.commandee_le), 'd MMMM', { locale: fr })}`
                    : data.validee_le
                      ? `Validée par ${data.validee_par ?? 'la direction'} — elle ne se modifie plus`
                      : 'Les thérapeutes du centre cochent, la direction valide'}
                </div>
              </div>
            </div>

            {role === 'direction' && (
              <div className="flex flex-wrap gap-2">
                {!data.validee_le && total > 0 && (
                  <button
                    type="button"
                    onClick={() => mValider.mutate(true)}
                    disabled={mValider.isPending}
                    className="bouton-fort"
                  >
                    <Check className="h-4 w-4" />
                    Valider la liste
                  </button>
                )}
                {data.validee_le && !data.commandee_le && (
                  <>
                    <button
                      type="button"
                      onClick={() => mCommandee.mutate()}
                      disabled={mCommandee.isPending}
                      className="bouton-fort"
                    >
                      Marquer commandée
                    </button>
                    <button
                      type="button"
                      onClick={() => mValider.mutate(false)}
                      className="bouton-discret"
                    >
                      Rouvrir
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Ce qui est coché, rassemblé : c'est ça qu'on achète */}
          {total > 0 && (
            <section className="carte p-5">
              <h2 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                À acheter
              </h2>
              <ul className="mt-3 flex flex-col divide-y divide-dotted divide-ardoise-200">
                {aAcheter.map((f) => (
                  <li key={f.id} className="flex items-baseline gap-3 py-2 text-sm">
                    <span className="tabular-nums font-semibold text-marine-700">{f.quantite}</span>
                    <span className="flex-1 text-ardoise-900">
                      {f.nom}
                      <span className="ml-1.5 text-2xs text-ardoise-400">{f.unite}</span>
                    </span>
                    {f.liens.length > 0 && (
                      <span className="flex items-center gap-2">
                        <a
                          href={f.liens[0]}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-2xs font-medium text-marine-700 hover:underline"
                        >
                          Acheter
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        {/* Les replis, pour le jour où le premier est en rupture. */}
                        {f.liens.slice(1).map((lien, i) => (
                          <a
                            key={lien}
                            href={lien}
                            target="_blank"
                            rel="noreferrer"
                            title="Autre adresse, si le premier est en rupture"
                            className="text-2xs text-ardoise-400 hover:text-marine-700 hover:underline"
                          >
                            {i + 2}
                          </a>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
                {data.libres.map((l) => (
                  <li key={l.id} className="flex items-baseline gap-3 py-2 text-sm">
                    <span className="tabular-nums font-semibold text-marine-700">{l.quantite}</span>
                    <span className="flex-1 text-ardoise-900">
                      {l.libelle}
                      {l.demandee_par && (
                        <span className="ml-1.5 text-2xs text-ardoise-400">
                          demandé par {l.demandee_par}
                        </span>
                      )}
                    </span>
                    {modifiable && (
                      <button
                        type="button"
                        onClick={() => mRetirer.mutate(l.id)}
                        aria-label={`Retirer ${l.libelle}`}
                        className="text-ardoise-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Le catalogue, rayon par rayon */}
          {rangerParCategorie(data.catalogue).map((rayon) => (
            <section key={rayon.id} className="carte p-5">
              <h2 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">
                {rayon.libelle}
              </h2>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                {rayon.fournitures.map((f) => (
                  <LigneDeCatalogue
                    key={f.id}
                    fourniture={f}
                    modifiable={modifiable}
                    surChangement={(quantite) => mCocher.mutate({ id: f.id, quantite })}
                  />
                ))}
              </ul>
            </section>
          ))}

          {/* La ligne « Autre » */}
          {modifiable && (
            <form
              className="carte flex flex-wrap items-end gap-3 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (quoi.trim()) mAjouter.mutate(quoi.trim());
              }}
            >
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="etiquette">Autre chose à acheter</span>
                <input
                  id="courses-autre"
                  type="text"
                  className="champ"
                  placeholder="Ce qui n'est pas dans la liste"
                  value={quoi}
                  onChange={(e) => setQuoi(e.target.value)}
                />
              </label>
              <button type="submit" disabled={!quoi.trim() || mAjouter.isPending} className="bouton-fort">
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            </form>
          )}

          {!modifiable && !data.validee_le && (
            <p className="text-sm text-ardoise-500">
              La semaine est passée : cette liste est close. Les courses se cochent sur la semaine
              en cours.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* Une case à cocher qui devient un compteur dès qu'on en veut. */
function LigneDeCatalogue({
  fourniture,
  modifiable,
  surChangement,
}: {
  fourniture: Fourniture;
  modifiable: boolean;
  surChangement: (quantite: number) => void;
}) {
  const coche = fourniture.quantite > 0;

  return (
    <li
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        coche ? 'bg-marine-50' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => modifiable && surChangement(coche ? 0 : 1)}
        disabled={!modifiable}
        aria-pressed={coche}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          coche
            ? 'border-marine-600 bg-marine-600 text-white'
            : 'border-ardoise-300 bg-white hover:border-marine-400'
        } ${modifiable ? '' : 'cursor-default opacity-60'}`}
      >
        {coche && <Check className="h-3.5 w-3.5" />}
      </button>

      <span className="min-w-0 flex-1 text-sm text-ardoise-800">
        {fourniture.nom}
        {estHabituelle(fourniture) && (
          <span className="ml-1.5 text-2xs text-ardoise-400">habituel</span>
        )}
      </span>

      {coche && (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => surChangement(fourniture.quantite - 1)}
            disabled={!modifiable}
            aria-label={`Un ${fourniture.unite} de moins de ${fourniture.nom}`}
            className="flex h-6 w-6 items-center justify-center rounded border border-ardoise-200 text-ardoise-600 hover:bg-white disabled:opacity-50"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-5 text-center text-sm font-semibold tabular-nums text-marine-800">
            {fourniture.quantite}
          </span>
          <button
            type="button"
            onClick={() => surChangement(fourniture.quantite + 1)}
            disabled={!modifiable}
            aria-label={`Un ${fourniture.unite} de plus de ${fourniture.nom}`}
            className="flex h-6 w-6 items-center justify-center rounded border border-ardoise-200 text-ardoise-600 hover:bg-white disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
          </button>
        </span>
      )}
    </li>
  );
}
