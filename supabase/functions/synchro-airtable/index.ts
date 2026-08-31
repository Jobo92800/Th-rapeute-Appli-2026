/*
  Synchronisation vers Airtable.

  Dépile la table `airtable_sync` et écrit dans la table Clients du CRM.
  Tourne côté serveur : le jeton Airtable ne descend jamais dans le
  navigateur, contrairement à l'ancienne application.

  Deux différences de fond avec la V1 :
    · le rapprochement se fait sur l'identifiant Airtable, stocké dès la
      première création. Plus aucune recherche par nom + prénom + centre,
      donc plus de lien perdu quand une cliente est renommée.
    · les échecs ne sont plus silencieux : ils restent dans la file, avec
      leur message, et l'application les affiche.

  Secrets attendus (Supabase → Edge Functions → Secrets) :
    AIRTABLE_TOKEN   le jeton d'accès personnel
    AIRTABLE_BASE    appI97jEL2mSCg3Wc
    AIRTABLE_TABLE   tblfqxwGePzeiWqqY
*/

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const enTetesCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/** Nombre de tâches traitées par appel : Airtable limite à 5 requêtes/seconde. */
const LOT = 15;

const LIBELLE_TECHNO: Record<string, string> = {
  luxo: 'Luxothérapie',
  ishape: 'I-Shape',
  presso: 'Pressodynamie',
  dome: 'Dôme',
};

const LIBELLE_MODE: Record<string, string> = {
  comptant: 'Comptant',
  '4x_maison': '4 fois sans frais',
  '10x_alma': '10 fois Alma',
};

const LIBELLE_STATUT: Record<string, string> = {
  propose: 'Proposé',
  valide: 'Validé',
  en_cours: 'En cours',
  termine: 'Terminé',
  abandonne: 'Abandonné',
};

const NOM_PROFIL: Record<string, string> = {
  P1: 'Réconfort',
  P2: 'Sous Pression',
  P3: 'Rupture',
  P4: 'En Veille',
  P5: 'Résistance',
};

const NOM_TERRAIN: Record<string, string> = {
  T1: 'Hormonal',
  T2: 'Inflammatoire',
  T3: 'Circulatoire',
  T4: 'Métabolique Lent',
  T5: 'Digestif',
};

/** Champs pièces jointes de la table Clients. */
const CHAMP_CONTRAT = 'fldxJHrZBuFN75wMr';
const CHAMP_CONSENTEMENTS = 'fldn4f3NScLrXj31C';

/** « Montant Cure » pour la première, « Montant cure N » ensuite. */
function champMontantCure(numero: number): string {
  return numero <= 1 ? 'Montant Cure' : `Montant cure ${Math.min(numero, 9)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: enTetesCors });
  }

  const json = (corps: unknown, status = 200) =>
    new Response(JSON.stringify(corps), {
      status,
      headers: { ...enTetesCors, 'Content-Type': 'application/json' },
    });

  const jeton = Deno.env.get('AIRTABLE_TOKEN');
  const base = Deno.env.get('AIRTABLE_BASE');
  const table = Deno.env.get('AIRTABLE_TABLE');

  if (!jeton || !base || !table) {
    return json(
      { error: 'AIRTABLE_TOKEN, AIRTABLE_BASE ou AIRTABLE_TABLE manquant dans les secrets.' },
      500,
    );
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const enTetesAirtable = {
    Authorization: `Bearer ${jeton}`,
    'Content-Type': 'application/json',
  };

  async function airtable(chemin: string, init?: RequestInit) {
    const r = await fetch(`https://api.airtable.com/v0/${base}/${table}${chemin}`, {
      ...init,
      headers: enTetesAirtable,
    });
    const corps = await r.json();
    if (!r.ok) {
      throw new Error(
        `Airtable ${r.status} : ${corps?.error?.message ?? JSON.stringify(corps).slice(0, 300)}`,
      );
    }
    return corps;
  }

  /**
   * Dépose un PDF dans un champ pièce jointe.
   *
   * L'API de contenu d'Airtable accepte le fichier en base64 : pas besoin
   * d'exposer le document derrière une URL publique. Chaque appel ajoute
   * une pièce jointe, il n'écrase pas les précédentes.
   */
  async function joindrePdf(
    recordId: string,
    champId: string,
    nomFichier: string,
    pdfBase64: string,
  ) {
    const r = await fetch(
      `https://content.airtable.com/v0/${base}/${recordId}/${champId}/uploadAttachment`,
      {
        method: 'POST',
        headers: enTetesAirtable,
        body: JSON.stringify({
          contentType: 'application/pdf',
          filename: nomFichier,
          file: pdfBase64,
        }),
      },
    );

    const corps = await r.json();
    if (!r.ok) {
      throw new Error(
        `Airtable pièce jointe ${r.status} : ${corps?.error?.message ?? JSON.stringify(corps).slice(0, 200)}`,
      );
    }
  }

  /**
   * Envoie le contrat signé et ses consentements.
   *
   * La fiche cliente doit déjà exister dans Airtable : sinon on renvoie la
   * tâche en file, elle passera après la création.
   */
  async function traiterContrat(contratId: string) {
    const { data: c } = await db
      .from('contrats')
      .select('id, cliente_id, nom_cliente, pdf_base64, airtable_le')
      .eq('id', contratId)
      .maybeSingle();

    if (!c) throw new Error('Contrat introuvable.');
    if (c.airtable_le) return; // déjà envoyé

    const { data: cliente } = await db
      .from('clientes')
      .select('prenom, nom, airtable_record_id')
      .eq('id', c.cliente_id)
      .maybeSingle();

    if (!cliente) throw new Error('Cliente introuvable.');
    if (!cliente.airtable_record_id) {
      throw new Error("La fiche cliente n'est pas encore dans Airtable, nouvelle tentative plus tard.");
    }

    const suffixe = `${cliente.nom}_${cliente.prenom}`.replace(/[^\w\-]+/g, '_');
    await joindrePdf(
      cliente.airtable_record_id,
      CHAMP_CONTRAT,
      `Contrat_${suffixe}.pdf`,
      c.pdf_base64,
    );

    const { data: consentements } = await db
      .from('consentements')
      .select('nom_fichier, pdf_base64')
      .eq('contrat_id', contratId)
      .order('nom_fichier');

    for (const cs of consentements ?? []) {
      await new Promise((r) => setTimeout(r, 220));
      await joindrePdf(
        cliente.airtable_record_id,
        CHAMP_CONSENTEMENTS,
        cs.nom_fichier,
        cs.pdf_base64,
      );
    }

    await db.from('contrats').update({ airtable_le: new Date().toISOString() }).eq('id', contratId);
  }

  // ---------------------------------------------------------------------------
  // Construction des champs, par type d'événement
  // ---------------------------------------------------------------------------

  /** Les champs de situation financière, communs à plusieurs événements. */
  async function champsReglement(clienteId: string): Promise<Record<string, unknown>> {
    const { data } = await db
      .from('situation_reglement')
      .select('*')
      .eq('cliente_id', clienteId)
      .maybeSingle();

    if (!data) return {};
    return {
      'Reste à encaisser': Number(data.montant_restant) || 0,
      'Échéances en retard': Number(data.nb_en_retard) || 0,
      'Montant en retard': Number(data.montant_en_retard) || 0,
    };
  }

  async function champsCliente(clienteId: string) {
    const { data: c } = await db.from('clientes').select('*').eq('id', clienteId).maybeSingle();
    if (!c) return null;

    const { data: centre } = await db
      .from('centres')
      .select('nom_airtable')
      .eq('id', c.centre_id)
      .maybeSingle();

    const champs: Record<string, unknown> = {
      Nom: c.nom,
      Prénom: c.prenom,
      Centre: centre?.nom_airtable ?? c.centre_id,
      'Source appli': 'V2',
    };

    if (c.email) champs['Email'] = c.email;
    if (c.telephone) champs['Téléphone'] = c.telephone;
    if (c.date_naissance) champs['Né(e) le'] = c.date_naissance;
    if (typeof c.age === 'number') champs['Age'] = c.age;
    if (c.adresse) champs['Adresse'] = c.adresse;
    if (c.code_postal) champs['Code postal'] = c.code_postal;
    if (c.ville) champs['Ville'] = c.ville;
    if (c.source) champs['Comment nous avez-vous connu ?'] = c.source;
    if (c.therapeutes?.length) champs['Thérapeute'] = c.therapeutes.join(', ');

    return { cliente: c, champs };
  }

  async function champsBilan(bilanId: string) {
    const { data: b } = await db.from('bilans').select('*').eq('id', bilanId).maybeSingle();
    if (!b?.cliente_id) return null;

    const champs: Record<string, unknown> = { 'Date bilan': b.date_bilan };
    if (b.profil_dominant) champs['Profil Empreinte'] = NOM_PROFIL[b.profil_dominant];
    if (b.terrain_dominant) champs['Terrain Empreinte'] = NOM_TERRAIN[b.terrain_dominant];

    // Le bilan seul n'est facturé que si la cliente ne démarre pas.
    if (b.facturation === 'facture') champs['Bilan seul'] = Number(b.montant_facture) || 0;
    if (b.facturation === 'offert') champs['Bilan seul'] = 0;

    return { clienteId: b.cliente_id as string, champs };
  }

  async function champsProgramme(programmeId: string) {
    const { data: p } = await db
      .from('programmes')
      .select('*')
      .eq('id', programmeId)
      .maybeSingle();
    if (!p) return null;

    const { data: lignes } = await db
      .from('programme_lignes')
      .select('*')
      .eq('programme_id', programmeId);

    const utiles = (lignes ?? []).filter((l) => l.seances_prevues > 0);
    const totalSeances = utiles.reduce((n, l) => n + l.seances_prevues, 0);

    const champs: Record<string, unknown> = {
      [champMontantCure(p.numero)]: Number(p.montant_total) || 0,
      'Nb séances': totalSeances,
      'Détail prescription': utiles
        .map((l) => `${LIBELLE_TECHNO[l.technologie] ?? l.technologie} ${l.seances_prevues}`)
        .join(' · '),
      Électrostimulation: Boolean(p.electro),
      'Mode de règlement': LIBELLE_MODE[p.mode_reglement] ?? p.mode_reglement,
      'Statut programme': LIBELLE_STATUT[p.statut] ?? p.statut,
      Soins: 'Perte de poids',
    };

    if (p.date_validation) champs['Date validation'] = p.date_validation;

    return { clienteId: p.cliente_id as string, champs };
  }

  // ---------------------------------------------------------------------------
  // Traitement d'une tâche
  // ---------------------------------------------------------------------------

  async function traiter(tache: { id: string; entite: string; entite_id: string }) {
    // Les contrats suivent un chemin à part : ce sont des pièces jointes,
    // pas des champs de la fiche.
    if (tache.entite === 'contrat') {
      await traiterContrat(tache.entite_id);
      return;
    }

    let clienteId: string;
    let champs: Record<string, unknown>;

    if (tache.entite === 'cliente') {
      const r = await champsCliente(tache.entite_id);
      if (!r) throw new Error('Cliente introuvable.');
      clienteId = tache.entite_id;
      champs = r.champs;
    } else if (tache.entite === 'bilan') {
      const r = await champsBilan(tache.entite_id);
      if (!r) throw new Error('Bilan introuvable ou non rattaché à une cliente.');
      clienteId = r.clienteId;
      champs = r.champs;
    } else if (tache.entite === 'programme') {
      const r = await champsProgramme(tache.entite_id);
      if (!r) throw new Error('Programme introuvable.');
      clienteId = r.clienteId;
      champs = r.champs;
    } else {
      throw new Error(`Type d'entité inconnu : ${tache.entite}`);
    }

    champs = { ...champs, ...(await champsReglement(clienteId)) };

    // L'identifiant Airtable est la clé de rapprochement. S'il manque, on crée
    // l'enregistrement et on le retient définitivement.
    const { data: cliente } = await db
      .from('clientes')
      .select('id, prenom, nom, centre_id, airtable_record_id')
      .eq('id', clienteId)
      .maybeSingle();

    if (!cliente) throw new Error('Cliente introuvable.');

    if (cliente.airtable_record_id) {
      await airtable(`/${cliente.airtable_record_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: champs, typecast: true }),
      });
      return;
    }

    // Aucune fiche Airtable encore : il faut la créer. Mais plusieurs tâches
    // d'une même cliente peuvent arriver en parallèle (cliente, bilan, cure).
    // Un verrou en base garantit qu'une seule crée réellement l'enregistrement.
    const { data: reserve } = await db.rpc('reserver_creation_airtable', {
      p_cliente: clienteId,
    });

    if (!reserve) {
      // Un autre appel s'en occupe. On laisse la tâche revenir plus tard,
      // elle trouvera alors l'identifiant et fera une simple mise à jour.
      throw new Error('Création déjà en cours pour cette cliente, nouvelle tentative plus tard.');
    }

    // Première synchro : on complète avec l'identité, même si l'événement
    // portait sur un bilan ou un programme.
    if (tache.entite !== 'cliente') {
      const base = await champsCliente(clienteId);
      if (base) champs = { ...base.champs, ...champs };
    }

    try {
      const cree = await airtable('', {
        method: 'POST',
        body: JSON.stringify({ records: [{ fields: champs }], typecast: true }),
      });

      const recordId = cree?.records?.[0]?.id;
      if (!recordId) throw new Error("Airtable n'a pas renvoyé d'identifiant.");

      await db
        .from('clientes')
        .update({ airtable_record_id: recordId, airtable_verrou: null })
        .eq('id', clienteId);
    } catch (err) {
      // La création a échoué : on rend la main pour que la prochaine
      // tentative puisse réessayer sans attendre l'expiration du verrou.
      await db.from('clientes').update({ airtable_verrou: null }).eq('id', clienteId);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------

  try {
    // Remet en file les tâches d'une exécution interrompue.
    await db.rpc('debloquer_taches_airtable');

    // Réclamation atomique : deux appels simultanés ne peuvent pas prendre
    // la même tâche, ce qui évitait jusqu'ici les créations en double.
    const { data: taches, error: erreurLot } = await db.rpc('reclamer_taches_airtable', {
      p_lot: LOT,
    });

    if (erreurLot) return json({ error: erreurLot.message }, 500);
    if (!taches?.length) return json({ traitees: 0, echecs: 0 });

    let traitees = 0;
    let echecs = 0;

    for (const t of taches as Array<{ id: string; entite: string; entite_id: string; tentatives: number }>) {
      try {
        await traiter(t);
        await db
          .from('airtable_sync')
          .update({ statut: 'ok', traite_le: new Date().toISOString(), derniere_erreur: null })
          .eq('id', t.id);
        traitees++;
      } catch (err) {
        echecs++;
        await db
          .from('airtable_sync')
          .update({
            statut: 'erreur',
            tentatives: (t.tentatives ?? 0) + 1,
            derniere_erreur: String(err).slice(0, 500),
          })
          .eq('id', t.id);
      }

      // Airtable plafonne à 5 requêtes par seconde et par base.
      await new Promise((r) => setTimeout(r, 220));
    }

    return json({ traitees, echecs });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
