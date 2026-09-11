import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { texteErreur } from '../lib/erreurs';
import { useSession } from '../lib/session';
import { reprendreHistoriqueV1, type RapportHistorique } from '../services/importFirebase';

/**
 * La reprise de l'historique de l'ancienne application : les pesées, les
 * mensurations, les notes et les exceptions cure des clientes déjà reprises
 * du CRM. Comme pour le CRM : on compte, on lit, puis on écrit.
 */
export default function ImportFirebase() {
  const { role } = useSession();
  const [rapport, setRapport] = useState<RapportHistorique | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [lu, setLu] = useState(false);

  if (role !== 'direction') {
    return (
      <div className="carte px-5 py-12 text-center">
        <h1 className="text-lg font-semibold text-ardoise-900">Reprise de l’historique</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ardoise-500">Cette opération est réservée à la direction.</p>
      </div>
    );
  }

  async function lancer(ecrire: boolean) {
    setEnCours(true);
    try {
      const r = await reprendreHistoriqueV1(ecrire);
      setRapport(r);
      setLu(false);
      if (ecrire) {
        toast.success(`${r.ecrit.seances} séances et ${r.ecrit.mensurations} mensurations reprises`, { duration: 8000 });
      }
    } catch (e) {
      toast.error(texteErreur(e) || 'La reprise a échoué.', { duration: 8000 });
    } finally {
      setEnCours(false);
    }
  }

  const fait = rapport?.mode === 'écriture';

  return (
    <div className="space-y-6">
      <div>
        <Link to="/tableau-de-bord" className="inline-flex items-center gap-1.5 text-sm text-ardoise-500 hover:text-marine-700">
          <ArrowLeft className="h-4 w-4" />
          Tableau de bord
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ardoise-900">Reprise de l’historique de l’ancienne application</h1>
        <p className="mt-0.5 text-sm text-ardoise-500">
          Les pesées, mensurations et notes enregistrées dans l’ancienne application rejoignent les fiches déjà reprises du CRM.
        </p>
      </div>

      <section className="carte p-5 text-sm leading-relaxed text-ardoise-700">
        <h2 className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">Ce qui va être repris</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Les pesées</strong>, une par séance de luxothérapie : la date, le poids, le commentaire. Elles apparaissent
            dans l’onglet Séances, avec la courbe de poids.
          </li>
          <li><strong>Les mensurations</strong>, les onze mesures, datées.</li>
          <li><strong>Les notes</strong>, signées « Ancienne application », et <strong>l’exception cure</strong> quand la fiche n’en a pas déjà une.</li>
          <li><strong>Le nombre de séances de la cure</strong>, quand l’ancienne application le connaissait : c’est lui qui fait le compteur de séances restantes.</li>
        </ul>
        <h2 className="mt-4 text-2xs font-semibold uppercase tracking-widest text-ardoise-400">Ce qui reste de côté</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Les séances des autres soins — I-Shape, presso, Advance Lift, mésojet… — pour le moment.</li>
          <li>Les clientes qui n’ont pas de cure dans la V2, et celles dont on ne retrouve pas la fiche à coup sûr.</li>
        </ul>
        <p className="mt-3 text-xs text-ardoise-500">
          La fiche se retrouve par le téléphone, à défaut par nom et prénom — un seul candidat, ou rien. Relancer ne double
          jamais : chaque ligne garde son identifiant d’origine.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => lancer(false)} disabled={enCours} className="bouton-principal">
          {enCours && !rapport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Compter, sans rien écrire
        </button>
      </div>

      {rapport && (
        <section className="carte overflow-hidden">
          <div className="border-b border-ardoise-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ardoise-900">
              {fait ? 'Ce qui a été repris' : 'Ce que la reprise ferait'}
            </h2>
          </div>

          <div className="grid gap-px bg-ardoise-100 sm:grid-cols-2 lg:grid-cols-4">
            <Tuile libelle="Fiches V2 avec une cure" valeur={rapport.v2.fiches_avec_cure} />
            <Tuile libelle="Clientes retrouvées" valeur={rapport.a_reprendre.clientes_reliees} detail={`${rapport.rapprochement.par_telephone} par téléphone · ${rapport.rapprochement.par_nom} par nom`} />
            <Tuile libelle={fait ? 'Séances écrites' : 'Séances à reprendre'} valeur={fait ? rapport.ecrit.seances : rapport.a_reprendre.seances} detail={`sur ${rapport.firebase.pesees} pesées lues`} accent />
            <Tuile libelle={fait ? 'Mensurations écrites' : 'Mensurations'} valeur={fait ? rapport.ecrit.mensurations : rapport.a_reprendre.mensurations} />
            <Tuile libelle={fait ? 'Notes écrites' : 'Notes'} valeur={fait ? rapport.ecrit.notes : rapport.a_reprendre.notes} />
            <Tuile libelle={fait ? 'Exceptions cure écrites' : 'Exceptions cure'} valeur={fait ? rapport.ecrit.exceptions : rapport.a_reprendre.exceptions} />
            <Tuile libelle="Cures avec nombre de séances" valeur={fait ? rapport.ecrit.cures_avec_nombre_de_seances : rapport.a_reprendre.cures_avec_nombre_de_seances} detail="le compteur de séances restantes, quand l’ancienne appli le connaissait" />
            <Tuile libelle="Pesées sans fiche ici" valeur={rapport.laisse_de_cote.pesees_sans_fiche} detail="clientes sans cure dans la V2, ou introuvables" />
            <Tuile libelle="Clientes ambiguës" valeur={rapport.rapprochement.ambigues} detail="deux fiches possibles : laissées de côté" />
          </div>

          {(rapport.laisse_de_cote.pesees_date_invalide > 0 || rapport.laisse_de_cote.pesees_sans_poids_plausible > 0) && (
            <p className="border-t border-ardoise-100 px-5 py-3 text-xs text-ardoise-500">
              {rapport.laisse_de_cote.pesees_date_invalide} pesée{rapport.laisse_de_cote.pesees_date_invalide > 1 ? 's' : ''} à la date illisible, écartée
              {rapport.laisse_de_cote.pesees_date_invalide > 1 ? 's' : ''} ; {rapport.laisse_de_cote.pesees_sans_poids_plausible} avec un poids hors de
              30–250 kg, reprise{rapport.laisse_de_cote.pesees_sans_poids_plausible > 1 ? 's' : ''} sans le poids.
            </p>
          )}

          {rapport.ambigues.length > 0 && (
            <div className="border-t border-ardoise-100 px-5 py-3 text-xs text-ardoise-600">
              <p className="font-semibold text-ardoise-800">Clientes laissées de côté parce que deux fiches leur correspondent</p>
              <p className="mt-1">{rapport.ambigues.join(' · ')}</p>
            </div>
          )}

          {rapport.erreurs.length > 0 && (
            <div className="border-t border-rose-200 bg-rose-50 px-5 py-3 text-xs text-rose-800">
              {rapport.erreurs.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}

          {!fait && (
            <div className="border-t border-ardoise-100 px-5 py-4">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ardoise-700">
                <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-ardoise-300" />
                J’ai lu le décompte. Les lignes seront écrites sur les fiches, et une relance ne les doublera pas.
              </label>
              <button onClick={() => lancer(true)} disabled={!lu || enCours} className="bouton-fort mt-3">
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Écrire l’historique sur les fiches
              </button>
            </div>
          )}

          {fait && rapport.erreurs.length === 0 && (
            <p className="flex items-center gap-2 border-t border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Terminé. Ouvrez la fiche d’une cliente reprise : sa courbe de poids est là.
            </p>
          )}
          {fait && rapport.erreurs.length > 0 && (
            <p className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Terminé avec des erreurs : relancez, ce qui est passé ne sera pas doublé.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Tuile({ libelle, valeur, detail, accent = false }: { libelle: string; valeur: number; detail?: string; accent?: boolean }) {
  return (
    <div className="bg-white px-5 py-3.5">
      <div className="text-2xs font-semibold uppercase tracking-widest text-ardoise-400">{libelle}</div>
      <div className={`chiffres mt-0.5 text-lg font-bold ${accent ? 'text-marine-700' : 'text-ardoise-900'}`}>
        {valeur.toLocaleString('fr-FR')}
      </div>
      {detail && <div className="mt-0.5 text-2xs text-ardoise-500">{detail}</div>}
    </div>
  );
}
