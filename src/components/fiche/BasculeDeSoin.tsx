/*
  Changer de soin en cours de cure.

  Une cliente arrête la relaxation au bout de deux séances et veut de
  l'I-Shape à la place (Jonathan, 22 octobre 2026). Il fallait sinon arrêter
  la cure et la refaire — un geste qui crée un avoir, déplace la date de
  validation et fausse le tableau de bord, pour un échange qui ne coûte rien
  à personne.

  LE BLOC EST RANGÉ PAR DÉFAUT, comme les réglages du devis : ce n'est pas le
  geste du quotidien, et trois menus déroulants ouverts sous les boutons de
  démarrage encombreraient l'écran qu'on regarde dix fois par jour.
*/
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { basculerLesSeances } from '../../services/metier';
import { maximumBasculable, refusDeBasculer } from '../../domain/basculeDeSeances';
import { soinsDuCentre } from '../../domain/soins';
import { LIBELLES_TECHNOLOGIE } from '../../domain/tarification';
import { texteErreur } from '../../lib/erreurs';
import type { SuiviSeances, Technologie } from '../../types/db';

export default function BasculeDeSoin({
  programmeId,
  clienteId,
  centreId,
  suivi,
  cureArretee,
}: {
  programmeId: string;
  clienteId: string;
  /** Le centre de la fiche : il décide des soins où l'on peut basculer. */
  centreId: string;
  suivi: SuiviSeances[];
  cureArretee: boolean;
}) {
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [de, setDe] = useState<Technologie | ''>('');
  const [vers, setVers] = useState<Technologie | ''>('');
  const [nombre, setNombre] = useState('1');
  const [enCours, setEnCours] = useState(false);

  /*
    Les soins d'où l'on peut partir : ceux de la cure sur lesquels il reste
    des séances vendues. Un soin terminé, ou dont le restant n'est que du
    parrainage, n'a rien à céder.
  */
  const sources = suivi
    .map((s) => ({
      technologie: s.technologie,
      restantes: s.seances_restantes,
      vendues: s.seances_prevues - s.seances_offertes,
    }))
    .filter((s) => maximumBasculable(s) > 0);

  const source = sources.find((s) => s.technologie === de);
  const maxi = source ? maximumBasculable(source) : 0;

  /* Les soins que le centre tient, celui de départ mis à part. */
  const destinations = soinsDuCentre(centreId).filter((t) => t !== de);

  const refus = refusDeBasculer({
    source,
    vers: vers === '' ? null : vers,
    nombre: Number(nombre),
    cureArretee,
  });

  if (!ouvert) {
    /* Rien à proposer : aucune séance ne peut partir. */
    if (sources.length === 0 || cureArretee) return null;
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-marine-700 hover:underline"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        Changer de soin
      </button>
    );
  }

  async function basculer() {
    if (refus || !source || vers === '') return;
    setEnCours(true);
    try {
      await basculerLesSeances({
        programmeId,
        de: source.technologie,
        vers,
        nombre: Number(nombre),
      });
      await qc.invalidateQueries({ queryKey: ['programmes', clienteId] });
      await qc.invalidateQueries({ queryKey: ['seances'] });
      toast.success(
        `${nombre} séance${Number(nombre) > 1 ? 's' : ''} ${LIBELLES_TECHNOLOGIE[source.technologie]} → ${LIBELLES_TECHNOLOGIE[vers]}`,
      );
      setOuvert(false);
      setDe('');
      setVers('');
      setNombre('1');
    } catch (e) {
      toast.error(texteErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-ardoise-200 bg-ardoise-50/60 p-4">
      <p className="surtitre">Changer de soin</p>
      <p className="mt-1 text-xs text-ardoise-500">
        Déplace des séances qui restent à faire. <b className="font-semibold">Le montant de la
        cure ne change pas</b> — elle est vendue, on échange des séances, pas de l’argent.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="etiquette" htmlFor="bascule-nombre">
            Combien
          </label>
          <input
            id="bascule-nombre"
            type="number"
            min={1}
            max={maxi || undefined}
            className="champ chiffres w-20"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div>
          <label className="etiquette" htmlFor="bascule-de">
            De
          </label>
          <select
            id="bascule-de"
            className="champ"
            value={de}
            onChange={(e) => {
              setDe(e.target.value as Technologie);
              setVers('');
            }}
          >
            <option value="">Choisir…</option>
            {sources.map((s) => (
              <option key={s.technologie} value={s.technologie}>
                {LIBELLES_TECHNOLOGIE[s.technologie]} · {maximumBasculable(s)} déplaçables
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="etiquette" htmlFor="bascule-vers">
            Vers
          </label>
          <select
            id="bascule-vers"
            className="champ"
            value={vers}
            onChange={(e) => setVers(e.target.value as Technologie)}
            disabled={de === ''}
          >
            <option value="">Choisir…</option>
            {destinations.map((t) => (
              <option key={t} value={t}>
                {LIBELLES_TECHNOLOGIE[t]}
              </option>
            ))}
          </select>
        </div>

        <button onClick={basculer} disabled={Boolean(refus) || enCours} className="bouton-principal">
          {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
          Basculer
        </button>
        <button onClick={() => setOuvert(false)} disabled={enCours} className="bouton-discret">
          Annuler
        </button>
      </div>

      {/*
        Le refus se lit sous les champs, et il dit ce qui reste possible :
        « on ne peut en déplacer que 4 au plus » se corrige sans réfléchir.
        Tant que rien n'est choisi, on ne reproche rien.
      */}
      {refus && de !== '' && (
        <p className="mt-2 text-xs font-semibold text-amber-700">{refus}</p>
      )}
    </div>
  );
}
