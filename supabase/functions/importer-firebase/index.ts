/*
  Reprise de l'historique de l'ancienne application (Firebase) dans la V2.

  Ce que cette fonction reprend, pour les clientes qui ont une cure ici :
    · les pesées — une séance de luxothérapie par pesée, datée, avec le
      poids et le commentaire, clôturée, sans Mission Déclic ;
    · les mensurations, les onze mesures ;
    · les notes, une par note ;
    · l'exception cure, quand la fiche V2 n'en a pas déjà une.

  Ce qu'elle laisse : les séances des autres soins (I-Shape, presso,
  Advance Lift, mésojet…), les clientes sans cure ici, et tout ce dont on
  ne retrouve pas la fiche.

  LE RAPPROCHEMENT. L'ancienne application ne connaît pas Airtable. On
  retrouve la fiche par le TÉLÉPHONE, normalisé à dix chiffres ; à défaut
  par nom + prénom, sans accent ni casse. Un candidat unique ou rien : une
  pesée posée sur la mauvaise personne est pire qu'une pesée perdue.

  LA CURE. Une pesée porte parfois un numéro de cure ; elle va sur la cure
  V2 de ce numéro si elle existe. Sans numéro — c'est le cas de la plupart,
  antérieures à cette fonction de l'ancienne application — elle va sur la
  première cure. Un numéro trop grand tombe sur la dernière.

  Deux sécurités, comme pour la reprise du CRM : réservée à la direction,
  vérifiée auprès de la base ; et un mode simulation par défaut, qui compte
  et n'écrit rien. Chaque ligne écrite garde son identifiant Firebase :
  relancer ne double rien.

  Secret attendu : FIREBASE_SERVICE_ACCOUNT — le JSON de la clé de compte
  de service du projet `mabeauty-plus-crm`.
*/

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const enTetesCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...enTetesCors, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Firebase : un jeton, puis la lecture des collections
// ---------------------------------------------------------------------------

interface CleService {
  project_id: string;
  client_email: string;
  private_key: string;
}

function b64url(bytes: Uint8Array | string): string {
  const s = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function jetonFirebase(cle: CleService): Promise<string> {
  const pem = cle.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const clePrivee = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const now = Math.floor(Date.now() / 1000);
  const entete = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corps = b64url(
    JSON.stringify({
      iss: cle.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', clePrivee, new TextEncoder().encode(`${entete}.${corps}`)),
  );

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${entete}.${corps}.${b64url(signature)}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Firebase a refusé la clé : ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

/** Une valeur Firestore, ramenée à une valeur simple. */
// deno-lint-ignore no-explicit-any
function simple(v: any): unknown {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) {
    return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, simple(x)]));
  }
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(simple);
  return null;
}

type Doc = Record<string, unknown> & { id: string };

async function lireCollection(projet: string, jeton: string, collection: string): Promise<Doc[]> {
  const base = `https://firestore.googleapis.com/v1/projects/${projet}/databases/(default)/documents`;
  const docs: Doc[] = [];
  let page = '';
  do {
    const r = await fetch(`${base}/${collection}?pageSize=300${page ? `&pageToken=${page}` : ''}`, {
      headers: { Authorization: `Bearer ${jeton}` },
    });
    const j = await r.json();
    if (j.error) throw new Error(`${collection} : ${j.error.message}`);
    for (const d of j.documents ?? []) {
      docs.push({
        id: String(d.name).split('/').pop()!,
        ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, simple(v)])),
      });
    }
    page = j.nextPageToken ?? '';
  } while (page);
  return docs;
}

// ---------------------------------------------------------------------------
// Rapprochement
// ---------------------------------------------------------------------------

function telephone(x: unknown): string {
  let t = String(x ?? '').replace(/\D/g, '');
  if (t.startsWith('0033')) t = '0' + t.slice(4);
  else if (t.startsWith('33') && t.length === 11) t = '0' + t.slice(2);
  return t.length === 10 ? t : '';
}

function nomNormalise(x: unknown): string {
  return String(x ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function dateValide(x: unknown): string | null {
  const s = String(x ?? '').slice(0, 10);
  if (!/^20(2[4-9]|3\d)-\d\d-\d\d$/.test(s)) return null;
  return Number.isNaN(new Date(s).getTime()) ? null : s;
}

/** Un poids plausible en kilos ; sinon rien — la séance reste, la pesée non. */
function poids(x: unknown): number | null {
  const n = typeof x === 'number' ? x : parseFloat(String(x ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 30 && n <= 250 ? Math.round(n * 10) / 10 : null;
}

function mesure(x: unknown): number | null {
  const n = parseFloat(String(x ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 400 ? Math.round(n * 10) / 10 : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: enTetesCors });

  try {
    const cleBrute = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!cleBrute) return json({ error: 'Secret FIREBASE_SERVICE_ACCOUNT absent côté Supabase.' }, 500);
    const cle = JSON.parse(cleBrute) as CleService;

    // --- La personne connectée est-elle bien la direction ? ----------------
    const autorisation = req.headers.get('Authorization') ?? '';
    if (!autorisation) return json({ error: 'Connexion requise.' }, 401);

    const dbAppelant = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: autorisation } },
    });
    const { data: estDirection, error: erreurRole } = await dbAppelant.rpc('est_direction');
    if (erreurRole) return json({ error: `Vérification du compte impossible : ${erreurRole.message}` }, 401);
    if (estDirection !== true) return json({ error: "La reprise de l'historique est réservée à la direction." }, 403);

    const corps = await req.json().catch(() => ({}));
    const ecrire = corps?.ecrire === true;

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // --- Les fiches de la V2, et leurs cures --------------------------------
    const { data: clientes, error: eClientes } = await db
      .from('clientes')
      .select('id, nom, prenom, telephone, centre_id, exception_cure');
    if (eClientes) throw eClientes;

    const { data: programmes, error: eProgrammes } = await db
      .from('programmes')
      .select('id, cliente_id, numero, centre_id')
      .neq('statut', 'abandonne')
      .order('numero');
    if (eProgrammes) throw eProgrammes;

    const curesParCliente = new Map<string, Array<{ id: string; numero: number; centre_id: string }>>();
    for (const p of programmes ?? []) {
      const liste = curesParCliente.get(p.cliente_id) ?? [];
      liste.push({ id: p.id, numero: Number(p.numero), centre_id: p.centre_id });
      curesParCliente.set(p.cliente_id, liste);
    }

    /* Seules les fiches qui ont une cure reçoivent un historique. */
    const avecCure = (clientes ?? []).filter((c) => curesParCliente.has(c.id));
    const parTel = new Map<string, typeof avecCure>();
    const parNom = new Map<string, typeof avecCure>();
    for (const c of avecCure) {
      const t = telephone(c.telephone);
      if (t) parTel.set(t, [...(parTel.get(t) ?? []), c]);
      const n = `${nomNormalise(c.nom)}|${nomNormalise(c.prenom)}`;
      parNom.set(n, [...(parNom.get(n) ?? []), c]);
    }

    // --- Firebase -----------------------------------------------------------
    const jeton = await jetonFirebase(cle);
    const [clientsV1, pesees, mensurationsV1, notesV1, exceptionsV1] = await Promise.all([
      lireCollection(cle.project_id, jeton, 'clients'),
      lireCollection(cle.project_id, jeton, 'measurements'),
      lireCollection(cle.project_id, jeton, 'mensurations'),
      lireCollection(cle.project_id, jeton, 'client-notes'),
      lireCollection(cle.project_id, jeton, 'client-exceptions'),
    ]);

    // --- Relier chaque cliente V1 à une fiche V2 ----------------------------
    const lien = new Map<string, (typeof avecCure)[number]>();
    const compte = { par_telephone: 0, par_nom: 0, ambigues: 0, sans_fiche_ou_sans_cure: 0 };
    const ambigues: string[] = [];

    for (const c of clientsV1) {
      const t = telephone(c.phone);
      const candTel = t ? (parTel.get(t) ?? []) : [];
      if (candTel.length === 1) {
        lien.set(c.id, candTel[0]);
        compte.par_telephone++;
        continue;
      }
      const candNom = parNom.get(`${nomNormalise(c.lastName)}|${nomNormalise(c.firstName)}`) ?? [];
      if (candNom.length === 1) {
        lien.set(c.id, candNom[0]);
        compte.par_nom++;
        continue;
      }
      if (candTel.length > 1 || candNom.length > 1) {
        compte.ambigues++;
        if (ambigues.length < 30) ambigues.push(`${c.firstName ?? ''} ${c.lastName ?? ''} (${c.centerId ?? '?'})`);
      } else {
        compte.sans_fiche_ou_sans_cure++;
      }
    }

    /** La cure V2 qui reçoit une pesée, d'après son numéro de cure V1. */
    function cureCible(clienteId: string, numero: unknown) {
      const cures = curesParCliente.get(clienteId)!;
      const n = Number(numero);
      if (Number.isFinite(n) && n >= 1) {
        return cures.find((c) => c.numero === n) ?? cures[cures.length - 1];
      }
      return cures[0];
    }

    // --- Les pesées → des séances de luxothérapie ---------------------------
    const seances: Array<Record<string, unknown>> = [];
    const stats = { pesees_lues: pesees.length, pesees_sans_fiche: 0, pesees_date_invalide: 0, pesees_sans_poids_plausible: 0 };
    for (const m of pesees) {
      const fiche = lien.get(String(m.clientId ?? ''));
      if (!fiche) {
        stats.pesees_sans_fiche++;
        continue;
      }
      const date = dateValide(m.date);
      if (!date) {
        stats.pesees_date_invalide++;
        continue;
      }
      const kg = poids(m.weight);
      if (kg == null) stats.pesees_sans_poids_plausible++;
      const cure = cureCible(fiche.id, m.cureNumber);
      seances.push({
        v1_id: m.id,
        origine: 'import_v1',
        programme_id: cure.id,
        cliente_id: fiche.id,
        centre_id: cure.centre_id,
        therapeute_id: null,
        date_seance: date,
        technologie: 'luxo',
        poids: kg,
        commentaire: String(m.comment ?? '').trim(),
        photo_prise: m.photoTaken === true,
        jeu_code: null,
        jeu_valide: false,
        jeu_reponse: {},
        cloturee: true,
      });
    }

    // --- Les mensurations ---------------------------------------------------
    const mensurations: Array<Record<string, unknown>> = [];
    let mensurationsSansFiche = 0;
    for (const r of mensurationsV1) {
      const fiche = lien.get(String(r.clientId ?? ''));
      const date = dateValide(r.date);
      if (!fiche || !date) {
        mensurationsSansFiche++;
        continue;
      }
      const cures = curesParCliente.get(fiche.id)!;
      mensurations.push({
        v1_id: r.id,
        cliente_id: fiche.id,
        programme_id: cures[0].id,
        centre_id: cures[0].centre_id,
        date_mesure: date,
        poitrine: mesure(r.bustLine),
        sous_poitrine: mesure(r.underBust),
        taille: mesure(r.waist),
        ventre: mesure(r.belly),
        hanches: mesure(r.hips),
        bras_droit: mesure(r.rightArm),
        bras_gauche: mesure(r.leftArm),
        cuisse_droite: mesure(r.rightThigh),
        cuisse_gauche: mesure(r.leftThigh),
        mollet_droit: mesure(r.rightCalf),
        mollet_gauche: mesure(r.leftCalf),
      });
    }

    // --- Les notes : le document porte l'identifiant de la cliente ----------
    const notes: Array<Record<string, unknown>> = [];
    for (const d of notesV1) {
      const fiche = lien.get(d.id);
      if (!fiche) continue;
      const liste = Array.isArray(d.notes) ? (d.notes as Array<Record<string, unknown>>) : [];
      const cures = curesParCliente.get(fiche.id)!;
      liste.forEach((n, i) => {
        const texte = String(n.text ?? '').trim();
        if (!texte) return;
        const quand = String(n.date ?? '');
        notes.push({
          v1_id: `${d.id}#${i}`,
          cliente_id: fiche.id,
          centre_id: cures[0].centre_id,
          therapeute_id: null,
          auteur: 'Ancienne application',
          texte,
          cree_le: Number.isNaN(new Date(quand).getTime()) ? new Date().toISOString() : quand,
        });
      });
    }

    // --- Les exceptions cure : seulement si la fiche n'en a pas ------------
    const exceptions: Array<{ id: string; exception_cure: string }> = [];
    for (const d of exceptionsV1) {
      const fiche = lien.get(d.id);
      const texte = String(d.text ?? '').trim();
      if (!fiche || !texte) continue;
      if (String(fiche.exception_cure ?? '').trim()) continue;
      exceptions.push({ id: fiche.id, exception_cure: texte });
    }

    const rapport = {
      mode: ecrire ? 'écriture' : 'simulation',
      firebase: {
        clientes: clientsV1.length,
        pesees: pesees.length,
        mensurations: mensurationsV1.length,
        fiches_de_notes: notesV1.length,
        exceptions: exceptionsV1.length,
      },
      v2: { fiches_avec_cure: avecCure.length },
      rapprochement: compte,
      a_reprendre: {
        clientes_reliees: lien.size,
        seances: seances.length,
        mensurations: mensurations.length,
        notes: notes.length,
        exceptions: exceptions.length,
      },
      laisse_de_cote: { ...stats, mensurations_sans_fiche: mensurationsSansFiche },
      ambigues,
      ecrit: { seances: 0, mensurations: 0, notes: 0, exceptions: 0 },
      erreurs: [] as string[],
    };

    if (!ecrire) return json(rapport);

    // --- Écriture, par lots, sans jamais doubler ---------------------------
    for (let i = 0; i < seances.length; i += 500) {
      const lot = seances.slice(i, i + 500);
      const { error } = await db.from('seances').upsert(lot, { onConflict: 'v1_id', ignoreDuplicates: true });
      if (error) rapport.erreurs.push(`Séances ${i + 1}–${i + lot.length} : ${error.message}`);
      else rapport.ecrit.seances += lot.length;
    }
    for (let i = 0; i < mensurations.length; i += 500) {
      const lot = mensurations.slice(i, i + 500);
      const { error } = await db.from('mensurations').upsert(lot, { onConflict: 'v1_id', ignoreDuplicates: true });
      if (error) rapport.erreurs.push(`Mensurations ${i + 1}–${i + lot.length} : ${error.message}`);
      else rapport.ecrit.mensurations += lot.length;
    }
    for (let i = 0; i < notes.length; i += 500) {
      const lot = notes.slice(i, i + 500);
      const { error } = await db.from('notes_cliente').upsert(lot, { onConflict: 'v1_id', ignoreDuplicates: true });
      if (error) rapport.erreurs.push(`Notes ${i + 1}–${i + lot.length} : ${error.message}`);
      else rapport.ecrit.notes += lot.length;
    }
    for (const e of exceptions) {
      const { error } = await db.from('clientes').update({ exception_cure: e.exception_cure }).eq('id', e.id);
      if (error) rapport.erreurs.push(`Exception cure ${e.id} : ${error.message}`);
      else rapport.ecrit.exceptions++;
    }

    return json(rapport);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
