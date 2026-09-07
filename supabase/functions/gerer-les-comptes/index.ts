/*
  Changer le mot de passe d'une thérapeute.

  POURQUOI UNE FONCTION EDGE.

  Modifier le compte de quelqu'un d'autre demande la clé de service. Cette
  clé ouvre toute la base : elle ne descend jamais dans un navigateur. Elle
  vit ici, où personne ne la lit.

  CE QUI EST VÉRIFIÉ, ET DANS QUEL ORDRE.

    1. L'appelant est connecté (jeton présent).
    2. L'appelant est direction — demandé à la base avec SON jeton, pas au
       navigateur. Un écran peut mentir, `est_direction()` non.
    3. La cible est bien une thérapeute de la maison, avec un compte relié.

  Sans le point 2, n'importe quel compte connecté changerait le mot de passe
  de n'importe qui, direction comprise. C'est le seul garde-fou qui compte.

  CE QUE ÇA NE FAIT PAS.

  Ni créer un compte, ni en supprimer, ni changer une adresse, ni lire un
  mot de passe — Supabase ne les rend jamais, même à la clé de service. Une
  fonction qui ne sait faire qu'une chose se relit en entier.

  Aucun secret à poser : SUPABASE_URL, SUPABASE_ANON_KEY et
  SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme.
*/

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const enTetesCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/** Le plancher est celui de Supabase. On le redit ici : le navigateur peut être contourné. */
const LONGUEUR_MINIMUM = 8;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: enTetesCors });
  }

  const json = (corps: unknown, status = 200) =>
    new Response(JSON.stringify(corps), {
      status,
      headers: { ...enTetesCors, 'Content-Type': 'application/json' },
    });

  try {
    // --- 1. Connecté ? ----------------------------------------------------
    const autorisation = req.headers.get('Authorization') ?? '';
    if (!autorisation) return json({ error: 'Connexion requise.' }, 401);

    // --- 2. Direction ? On le demande à la base, avec le jeton de l'appelant.
    const dbAppelant = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: autorisation } } },
    );

    const { data: estDirection, error: erreurRole } = await dbAppelant.rpc('est_direction');

    if (erreurRole) {
      return json({ error: `Vérification du compte impossible : ${erreurRole.message}` }, 401);
    }
    if (estDirection !== true) {
      return json({ error: 'Changer un mot de passe est réservé à la direction.' }, 403);
    }

    // --- 3. Ce qu'on nous demande ----------------------------------------
    const corps = await req.json().catch(() => ({}));
    const therapeuteId = String(corps?.therapeuteId ?? '').trim();
    const motDePasse = String(corps?.motDePasse ?? '');

    if (!therapeuteId) return json({ error: 'Thérapeute non désignée.' }, 400);
    if (motDePasse.length < LONGUEUR_MINIMUM) {
      return json({ error: `Le mot de passe doit faire au moins ${LONGUEUR_MINIMUM} caractères.` }, 400);
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // --- 4. La cible existe-t-elle, et a-t-elle un compte ? ---------------
    const { data: cible, error: erreurCible } = await db
      .from('therapeutes')
      .select('id, prenom, email, user_id')
      .eq('id', therapeuteId)
      .maybeSingle();

    if (erreurCible) return json({ error: erreurCible.message }, 500);
    if (!cible) return json({ error: 'Cette thérapeute n’existe pas.' }, 404);
    if (!cible.user_id) {
      return json(
        {
          error:
            `${cible.prenom} n’a pas encore de compte de connexion. Créez-le dans Supabase ` +
            `(Authentication → Add user, Auto Confirm coché), puis relancez le rattachement.`,
        },
        409,
      );
    }

    // --- 5. Le changement -------------------------------------------------
    //  `email_confirm` remet l'adresse en « confirmée » au passage : un compte
    //  créé sans Auto Confirm refuse la connexion quel que soit le mot de
    //  passe, et c'est une panne qu'on ne veut pas laisser derrière soi.
    const { error: erreurMaj } = await db.auth.admin.updateUserById(cible.user_id, {
      password: motDePasse,
      email_confirm: true,
    });

    if (erreurMaj) return json({ error: erreurMaj.message }, 500);

    return json({ ok: true, prenom: cible.prenom, email: cible.email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
