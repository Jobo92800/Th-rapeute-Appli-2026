/*
  Reprise des fiches du CRM Airtable dans la V2.

  Ce que cette fonction crée
    · une fiche cliente par enregistrement Airtable : identité, coordonnées,
      centre, source, date de création, et l'identifiant Airtable lui-même —
      c'est lui qui garantit qu'aucun doublon ne sera créé dans le CRM ;
    · une cure par montant renseigné (« Montant Cure », « Montant cure 2 »
      … jusqu'à 9), datée à la création de la fiche.

  Ce qu'elle ne peut pas créer, faute de données dans Airtable : le détail
  des séances, les échéanciers, les bilans Empreinte, les mensurations. Tout
  cela vit dans le Firebase de la V1, et c'est une autre migration.

  Deux sécurités
    · réservée à la direction : le jeton de la personne connectée est vérifié
      auprès de la base, pas simplement lu ;
    · un mode simulation qui compte tout et n'écrit rien. C'est le mode par
      défaut : il faut demander explicitement l'écriture.

  Secrets attendus : AIRTABLE_TOKEN, AIRTABLE_BASE, AIRTABLE_TABLE.
*/

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const enTetesCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/** Les champs Airtable qui portent un montant, dans l'ordre des cures. */
const CHAMPS_MONTANT = [
  'Montant Cure',
  'Montant cure 2',
  'Montant cure 3',
  'Montant cure 4',
  'Montant cure 5',
  'Montant cure 6',
  'Montant cure 7',
  'Montant cure 8',
  'Montant cure 9',
];

interface Fiche {
  id: string;
  fields: Record<string, unknown>;
}

function json(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...enTetesCors, 'Content-Type': 'application/json' },
  });
}

function texte(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  return s.length > 0 ? s : null;
}

function nombre(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** L'âge se recalcule : le CRM en contient à 0, ce que la V2 refuse. */
function ageDepuis(naissance: string | null): number | null {
  if (!naissance) return null;
  const d = new Date(naissance);
  if (Number.isNaN(d.getTime())) return null;

  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - d.getFullYear();
  const m = aujourdhui.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && aujourdhui.getDate() < d.getDate())) age--;

  return age > 0 && age < 120 ? age : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: enTetesCors });

  try {
    const jeton = Deno.env.get('AIRTABLE_TOKEN');
    const base = Deno.env.get('AIRTABLE_BASE');
    const table = Deno.env.get('AIRTABLE_TABLE');

    if (!jeton || !base || !table) {
      return json({ error: 'Secrets Airtable absents côté Supabase.' }, 500);
    }

    // --- La personne connectée est-elle bien la direction ? ----------------
    const autorisation = req.headers.get('Authorization') ?? '';
    if (!autorisation) return json({ error: 'Connexion requise.' }, 401);

    const dbAppelant = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: autorisation } } },
    );

    const { data: estDirection, error: erreurRole } = await dbAppelant.rpc('est_direction');

    if (erreurRole) return json({ error: `Vérification du compte impossible : ${erreurRole.message}` }, 401);
    if (estDirection !== true) {
      return json({ error: "La reprise des fiches est réservée à la direction." }, 403);
    }

    const corps = await req.json().catch(() => ({}));
    const ecrire = corps?.ecrire === true;

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // --- Les centres, pour traduire le nom Airtable en identifiant --------
    const { data: centres } = await db.from('centres').select('id, nom_airtable');
    const parNomAirtable = new Map(
      (centres ?? []).map((c) => [String(c.nom_airtable).trim().toLowerCase(), c.id as string]),
    );

    // --- Lire tout le CRM -------------------------------------------------
    const fiches: Fiche[] = [];
    let offset: string | undefined;

    do {
      const url = new URL(`https://api.airtable.com/v0/${base}/${table}`);
      url.searchParams.set('pageSize', '100');
      if (offset) url.searchParams.set('offset', offset);

      const r = await fetch(url, { headers: { Authorization: `Bearer ${jeton}` } });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        return json({ error: `Airtable ${r.status} : ${e?.error?.message ?? 'lecture refusée'}` }, 500);
      }

      const page = await r.json();
      fiches.push(...(page.records ?? []));
      offset = page.offset;
    } while (offset);

    // --- Ce qui est déjà dans la V2 ---------------------------------------
    const { data: deja } = await db
      .from('clientes')
      .select('airtable_record_id')
      .not('airtable_record_id', 'is', null);

    const connues = new Set((deja ?? []).map((c) => c.airtable_record_id as string));

    // --- Trier le bon grain de l'ivraie -----------------------------------
    const aCreer: Array<Record<string, unknown>> = [];
    const curesParRecord = new Map<string, Array<{ numero: number; montant: number }>>();

    const anomalies = {
      deja_presentes: 0,
      sans_nom: 0,
      sans_centre: 0,
      centre_inconnu: [] as string[],
      sans_therapeute: 0,
      sans_telephone: 0,
      age_recalcule: 0,
    };

    for (const f of fiches) {
      if (connues.has(f.id)) {
        anomalies.deja_presentes++;
        continue;
      }

      const nom = texte(f.fields['Nom']);
      const prenom = texte(f.fields['Prénom']);
      if (!nom && !prenom) {
        anomalies.sans_nom++;
        continue;
      }

      const nomCentre = texte(f.fields['Centre']);
      if (!nomCentre) {
        anomalies.sans_centre++;
        continue;
      }

      const centreId = parNomAirtable.get(nomCentre.toLowerCase());
      if (!centreId) {
        if (!anomalies.centre_inconnu.includes(nomCentre)) anomalies.centre_inconnu.push(nomCentre);
        continue;
      }

      const naissance = texte(f.fields['Né(e) le']);
      const age = ageDepuis(naissance);
      if (age !== null && nombre(f.fields['Age']) !== age) anomalies.age_recalcule++;

      const therapeute = texte(f.fields['Thérapeute']);
      if (!therapeute) anomalies.sans_therapeute++;
      if (!texte(f.fields['Téléphone'])) anomalies.sans_telephone++;

      const creation = texte(f.fields['date de création']);

      aCreer.push({
        centre_id: centreId,
        prenom: prenom ?? '—',
        nom: nom ?? '—',
        email: texte(f.fields['Email']),
        telephone: texte(f.fields['Téléphone']),
        date_naissance: naissance,
        age,
        adresse: texte(f.fields['Adresse']),
        code_postal: texte(f.fields['Code postal']),
        ville: texte(f.fields['Ville']),
        source: texte(f.fields['Comment nous avez-vous connu ?']),
        therapeutes: therapeute ? [therapeute] : [],
        airtable_record_id: f.id,
        origine: 'import_v1',
        cree_le: creation ?? new Date().toISOString(),
      });

      // Les cures : un montant renseigné vaut une cure. L'avoir se déduit de
      // la première, comme le faisait l'ancien tableau de bord.
      const avoir = nombre(f.fields['Avoir']);
      const cures: Array<{ numero: number; montant: number }> = [];

      CHAMPS_MONTANT.forEach((champ, i) => {
        const brut = nombre(f.fields[champ]);
        if (brut <= 0) return;
        const montant = i === 0 ? Math.max(0, brut - avoir) : brut;
        if (montant > 0) cures.push({ numero: i + 1, montant });
      });

      if (cures.length > 0) curesParRecord.set(f.id, cures);
    }

    const nbCures = [...curesParRecord.values()].reduce((n, c) => n + c.length, 0);
    const montantTotal = [...curesParRecord.values()]
      .flat()
      .reduce((n, c) => n + c.montant, 0);

    const rapport = {
      simulation: !ecrire,
      fiches: {
        lues: fiches.length,
        a_creer: aCreer.length,
        deja_presentes: anomalies.deja_presentes,
        ecartees: fiches.length - aCreer.length - anomalies.deja_presentes,
      },
      cures: { a_creer: nbCures, montant_total: Math.round(montantTotal) },
      anomalies,
      creees: { fiches: 0, cures: 0 },
      erreurs: [] as string[],
    };

    if (!ecrire) return json(rapport);

    // --- Écriture, par lots de cent --------------------------------------
    const parRecordId = new Map<string, string>();

    for (let i = 0; i < aCreer.length; i += 100) {
      const lot = aCreer.slice(i, i + 100);

      const { data, error } = await db
        .from('clientes')
        .upsert(lot, { onConflict: 'airtable_record_id', ignoreDuplicates: true })
        .select('id, airtable_record_id, centre_id, cree_le');

      if (error) {
        rapport.erreurs.push(`Fiches ${i + 1}–${i + lot.length} : ${error.message}`);
        continue;
      }

      for (const c of data ?? []) {
        parRecordId.set(c.airtable_record_id as string, c.id as string);
        rapport.creees.fiches++;
      }
    }

    // --- Les cures reprises ----------------------------------------------
    const programmes: Array<Record<string, unknown>> = [];

    for (const [recordId, cures] of curesParRecord) {
      const clienteId = parRecordId.get(recordId);
      if (!clienteId) continue;

      const fiche = aCreer.find((c) => c.airtable_record_id === recordId);
      const dateCreation = String(fiche?.cree_le ?? '').slice(0, 10);

      for (const cure of cures) {
        programmes.push({
          cliente_id: clienteId,
          centre_id: fiche?.centre_id,
          numero: cure.numero,
          statut: 'termine',
          origine: 'import_v1',
          montant_total: cure.montant,
          mode_reglement: 'inconnu',
          date_validation: dateCreation || null,
          guide: false,
          tenue: false,
          electro: false,
        });
      }
    }

    for (let i = 0; i < programmes.length; i += 100) {
      const lot = programmes.slice(i, i + 100);
      const { data, error } = await db.from('programmes').insert(lot).select('id');

      if (error) {
        rapport.erreurs.push(`Cures ${i + 1}–${i + lot.length} : ${error.message}`);
        continue;
      }

      rapport.creees.cures += (data ?? []).length;
    }

    return json(rapport);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
