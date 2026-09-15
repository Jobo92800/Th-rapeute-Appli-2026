/*
  Création de l'accès au parcours audio.

  Appelle l'API d'administration de l'application « Mon Parcours » pour créer
  le compte de la cliente et déclencher son invitation par email.

  Le code d'accès de cette application ne descend jamais dans le navigateur :
  il vit ici, en secret de fonction.

  Secrets attendus (Supabase → Edge Functions → Secrets) :
    PODCAST_API_URL      https://applipodcast.netlify.app/api/admin
    PODCAST_ADMIN_CODE   le code de l'espace thérapeute
*/

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const enTetesCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: enTetesCors });
  }

  const json = (corps: unknown, status = 200) =>
    new Response(JSON.stringify(corps), {
      status,
      headers: { ...enTetesCors, 'Content-Type': 'application/json' },
    });

  const api = Deno.env.get('PODCAST_API_URL');
  const code = Deno.env.get('PODCAST_ADMIN_CODE');

  if (!api || !code) {
    return json(
      { error: 'PODCAST_API_URL ou PODCAST_ADMIN_CODE manquant dans les secrets.' },
      500,
    );
  }

  /** Appel de l'API d'administration de Mon Parcours. */
  async function podcast(corps: Record<string, unknown>) {
    const r = await fetch(api!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mbp-code': code! },
      body: JSON.stringify(corps),
    });
    return { statut: r.status, ok: r.ok, corps: await r.json().catch(() => ({})) };
  }

  /**
   * Retrouve la cliente côté Mon Parcours par son email.
   *
   * L'API ne propose pas de recherche : on lit la liste et on filtre. C'est
   * acceptable pour une action ponctuelle, pas pour un appel fréquent.
   */
  async function chercherParEmail(email: string) {
    const r = await podcast({ action: 'liste' });
    if (!r.ok) return null;
    const liste = (r.corps?.clientes ?? []) as Array<{
      id: string;
      email: string;
      parcoursCode: string;
      compteActive: boolean;
      terminees: number;
      total: number;
      derniereActivite: string | null;
    }>;
    return liste.find((c) => (c.email ?? '').toLowerCase() === email.toLowerCase()) ?? null;
  }

  try {
    const { clienteId, parcours, motDePasse, action = 'creer', etape } = await req.json();

    // --- Écouter un podcast depuis l'application des thérapeutes ---------
    /*
      Mon Parcours signe une adresse d'écoute valable une heure, sans
      condition de déblocage — c'est son « écoute de contrôle ». On la
      demande pour l'étape N du parcours B ou C : l'identifiant de l'étape
      se lit dans la liste des étapes, que l'API ne sait pas interroger
      autrement. Aucune cliente en jeu ici.
    */
    if (action === 'ecouter') {
      const codeParcours = String(parcours ?? '').toUpperCase();
      const numero = Number(etape);
      if (!['B', 'C'].includes(codeParcours) || !Number.isInteger(numero) || numero < 1) {
        return json({ error: 'parcours (B ou C) et etape manquants.' }, 400);
      }
      const liste = await podcast({ action: 'parcours' });
      if (!liste.ok) return json({ error: 'Mon Parcours ne répond pas.' }, 502);
      const etapes = (liste.corps?.etapes ?? []) as Array<{
        id: string; parcours_code: string; numero: number; titre: string; fichier: string | null; actif: boolean;
      }>;
      const trouvee = etapes.find((e) => e.parcours_code === codeParcours && e.numero === numero);
      if (!trouvee) return json({ error: 'Cette étape n’est pas encore en ligne dans Mon Parcours.' }, 404);
      if (!trouvee.fichier) return json({ error: 'Cette étape n’a pas encore de fichier audio.' }, 404);

      const r = await podcast({ action: 'ecouter', id: trouvee.id });
      if (!r.ok || !r.corps?.url) {
        return json({ error: r.corps?.erreur === 'audio-absent' ? 'Pas de fichier audio pour cette étape.' : 'Mon Parcours refuse l’écoute.' }, 502);
      }
      return json({ url: r.corps.url, titre: r.corps.titre ?? trouvee.titre });
    }

    if (!clienteId) return json({ error: 'clienteId manquant.' }, 400);

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // --- État du compte, pour l'afficher sur la fiche ---------------------
    if (action === 'etat') {
      const { data: c } = await db
        .from('clientes')
        .select('email')
        .eq('id', clienteId)
        .maybeSingle();

      if (!c?.email) return json({ compte: null });
      const trouvee = await chercherParEmail(c.email);
      return json({ compte: trouvee });
    }

    // --- Renvoi de l'invitation -------------------------------------------
    if (action === 'renvoyer') {
      const { data: c } = await db
        .from('clientes')
        .select('email')
        .eq('id', clienteId)
        .maybeSingle();

      if (!c?.email) return json({ error: "Cette cliente n'a pas d'adresse email." }, 400);

      const trouvee = await chercherParEmail(c.email);
      if (!trouvee) {
        return json(
          { error: "Aucun compte sur Mon Parcours pour cette adresse. Donnez-lui d'abord accès." },
          404,
        );
      }

      const r = await podcast({ action: 'renvoyer-invitation', id: trouvee.id });
      if (!r.ok) {
        return json({ error: r.corps?.erreur ?? `Renvoi refusé (${r.statut}).` }, 502);
      }
      return json({ ok: true, email: c.email });
    }

    if (!['A', 'B', 'C'].includes(parcours)) return json({ error: 'Parcours invalide.' }, 400);

    const { data: c } = await db
      .from('clientes')
      .select('prenom, nom, email, telephone, centre_id, acces_audio_le')
      .eq('id', clienteId)
      .maybeSingle();

    if (!c) return json({ error: 'Cliente introuvable.' }, 404);
    if (!c.email) {
      return json(
        { error: "Cette cliente n'a pas d'adresse email : l'invitation ne peut pas partir." },
        400,
      );
    }

    const { data: centre } = await db
      .from('centres')
      .select('nom')
      .eq('id', c.centre_id)
      .maybeSingle();

    const r = await podcast({
      action: 'creer',
      prenom: c.prenom,
      nom: c.nom,
      email: c.email,
      telephone: c.telephone,
      centre: centre?.nom ?? c.centre_id,
      parcours,
      // Fourni : le compte est utilisable tout de suite, la cliente n'a
      // aucun lien à cliquer. Absent : invitation par email comme avant.
      ...(motDePasse ? { motDePasse } : {}),
    });

    // Un compte déjà existant n'est pas une erreur : on retient simplement
    // le parcours et on laisse la thérapeute renvoyer l'invitation si besoin.
    const dejaLa = r.statut === 409;

    if (!r.ok && !dejaLa) {
      return json(
        { error: r.corps?.erreur ?? `L'application Mon Parcours a refusé (${r.statut}).` },
        502,
      );
    }

    await db
      .from('clientes')
      .update({
        parcours_audio: parcours,
        acces_audio_le: c.acces_audio_le ?? new Date().toISOString(),
      })
      .eq('id', clienteId);

    return json({
      ok: true,
      dejaLa,
      motDePasseDefini: Boolean(r.corps?.invitation?.motDePasseDefini),
      invitation: r.corps?.invitation ?? null,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
