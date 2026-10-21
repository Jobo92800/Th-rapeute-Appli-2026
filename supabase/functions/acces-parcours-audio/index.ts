/*
  Création de l'accès au parcours audio.

  Appelle l'API d'administration de l'application « Mon Parcours » pour créer
  le compte de la cliente et déclencher son invitation par email.

  Le code d'accès de cette application ne descend jamais dans le navigateur :
  il vit ici, en secret de fonction.

  Secrets attendus (Supabase → Edge Functions → Secrets) :
    PODCAST_API_URL      https://parcours.mabeautyplus.fr/api/admin
    PODCAST_ADMIN_CODE   le code de l'espace thérapeute

  Et, **séparément**, pour la seule lecture de l'activité de la cliente :
    NUTRITION_API_URL    https://applinutritonjuin2026.netlify.app/api/admin-parcours
    NUTRITION_ADMIN_CODE le code d'administration de l'application nutrition

  Pourquoi deux paires et pas une. La création de compte est repassée en
  direct sur Mon Parcours le 28 septembre 2026, parce que l'invitation de
  l'application nutrition envoyait la cliente sur un site qui n'était pas
  prêt. Lire ce qu'elle fait dans l'application nutrition est un tout autre
  sujet, sans risque : mélanger les deux obligerait à rebasculer la création
  pour obtenir une lecture. Les secrets nutrition sont **facultatifs** —
  absents, la fiche n'affiche simplement pas le bloc d'activité.
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

  /*
    DEUX ADRESSES, ET C'EST VOULU (21 octobre 2026).

    `PODCAST_API_URL` est le **relais de la nutrition** : il crée le compte
    des deux côtés avec le même mot de passe, le temps de la bascule. C'est
    ce qu'il faut pour ÉCRIRE — créer un accès, changer un mot de passe.

    Mais il ne faut pas y LIRE. Les clientes écoutent leurs podcasts sur Mon
    Parcours, pas sur la nutrition : le relais répond avec le compte nutrition
    de la cliente, qui n'a jamais rien écouté, et la fiche annonçait « 0 / 24 »
    à quelqu'un qui en avait fait deux. Quarante-quatre clientes étaient dans
    ce cas, pour cent trois étapes terminées invisibles.

    `PARCOURS_API_URL` pointe donc **directement sur Mon Parcours**, et sert
    à tout ce qui se lit : l'avancement, et l'adresse d'écoute d'un podcast —
    celle-ci aussi, sinon la thérapeute écouterait la copie de la nutrition,
    qui peut diverger de l'épisode réellement servi à la cliente.

    Si le secret n'est pas posé, on retombe sur l'ancien comportement plutôt
    que de ne rien afficher : une fiche sans avancement vaut mieux qu'une
    fiche en erreur.
  */
  const api = Deno.env.get('PODCAST_API_URL');
  const code = Deno.env.get('PODCAST_ADMIN_CODE');
  const apiParcours = Deno.env.get('PARCOURS_API_URL') ?? api;
  const codeAdminParcours = Deno.env.get('PARCOURS_ADMIN_CODE') ?? code;
  const apiNutrition = Deno.env.get('NUTRITION_API_URL');
  const codeNutrition = Deno.env.get('NUTRITION_ADMIN_CODE');

  if (!api || !code) {
    return json(
      { error: 'PODCAST_API_URL ou PODCAST_ADMIN_CODE manquant dans les secrets.' },
      500,
    );
  }

  /*
    CE QUE L'AUTRE APPLICATION RÉPOND, EN FRANÇAIS.

    Elle renvoie des codes — « relais-refuse », « mot-de-passe-refuse » —
    qui ne veulent rien dire pour une thérapeute, et que l'écran affichait
    tels quels quand il les affichait. Chacun a pourtant une cause précise
    et un geste qui la règle : c'est cela qu'on écrit.

    Le relais est une étape de la transition vers l'application nutrition :
    elle crée le compte des deux côtés avec le même mot de passe, en
    appelant Mon Parcours d'abord. Quand Mon Parcours refuse, elle n'écrit
    rien et renvoie « relais-refuse » avec le refus d'origine en détail —
    et c'est ce détail qui nomme vraiment la cause.
  */
  function enClair(erreur: string, detail?: string): string {
    const cause = detail && detail !== erreur ? detail : erreur;
    const dictionnaire: Record<string, string> = {
      'mot-de-passe-refuse':
        "Le compte de cette cliente existe dans le parcours audio, mais le compte de connexion qui va avec a été supprimé : le mot de passe ne peut plus être changé. Il faut recréer son compte côté parcours audio.",
      'mot-de-passe-court': 'Le mot de passe doit faire au moins 8 caractères.',
      'creation-refusee':
        "Le parcours audio a refusé de créer le compte de connexion. Souvent : une adresse déjà utilisée par un autre compte, ou un mot de passe trop simple.",
      'compte-sans-identifiant':
        "Cette adresse est déjà connue du parcours audio, mais sans compte de connexion. À reprendre depuis l'espace d'administration du parcours audio.",
      'email-invalide': "L'adresse email de cette cliente n'est pas valide.",
      'email-deja-utilise': 'Cette adresse a déjà un compte sur le parcours audio.',
      'parcours-inconnu': "Ce parcours n'existe pas dans l'application du parcours audio.",
      'prenom-requis': 'Cette fiche n’a pas de prénom.',
      'code-invalide':
        "Le code d'administration du parcours audio est refusé : le secret PODCAST_ADMIN_CODE ne correspond plus.",
      'email-refuse': "L'invitation par email a été refusée par le parcours audio.",
    };
    return dictionnaire[cause] ?? `Le parcours audio a refusé : ${cause}`;
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
   * Mon Parcours, en direct, pour tout ce qui se LIT : l'avancement d'une
   * cliente et l'adresse d'écoute d'un podcast. Jamais pour écrire — la
   * création de compte passe par le relais, qui écrit des deux côtés.
   */
  async function monParcours(corps: Record<string, unknown>) {
    const r = await fetch(apiParcours!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mbp-code': codeAdminParcours! },
      body: JSON.stringify(corps),
    });
    return { statut: r.status, ok: r.ok, corps: await r.json().catch(() => ({})) };
  }

  /** L'application nutrition, pour la seule lecture de l'activité. */
  async function nutrition(corps: Record<string, unknown>) {
    if (!apiNutrition || !codeNutrition) return { ok: false, corps: {} as Record<string, unknown> };
    try {
      const r = await fetch(apiNutrition, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mbp-code': codeNutrition },
        body: JSON.stringify(corps),
      });
      return { ok: r.ok, corps: (await r.json().catch(() => ({}))) as Record<string, unknown> };
    } catch {
      return { ok: false, corps: {} as Record<string, unknown> };
    }
  }

  /**
   * Retrouve la cliente côté Mon Parcours par son email.
   *
   * L'API ne propose pas de recherche : on lit la liste et on filtre. C'est
   * acceptable pour une action ponctuelle, pas pour un appel fréquent.
   */
  async function chercherParEmail(email: string) {
    const r = await monParcours({ action: 'liste' });
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
      const liste = await monParcours({ action: 'parcours' });
      if (!liste.ok) return json({ error: 'Mon Parcours ne répond pas.' }, 502);
      const etapes = (liste.corps?.etapes ?? []) as Array<{
        id: string; parcours_code: string; numero: number; titre: string; fichier: string | null; actif: boolean;
      }>;
      const trouvee = etapes.find((e) => e.parcours_code === codeParcours && e.numero === numero);
      if (!trouvee) return json({ error: 'Cette étape n’est pas encore en ligne dans Mon Parcours.' }, 404);
      if (!trouvee.fichier) return json({ error: 'Cette étape n’a pas encore de fichier audio.' }, 404);

      const r = await monParcours({ action: 'ecouter', id: trouvee.id });
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

    // --- Ce qu'elle fait dans son application, entre deux rendez-vous -----
    /*
      L'application cliente sait des choses que cette fiche ignore : si elle
      est revenue, où elle en est du parcours, ce qu'elle s'est pesée, si elle
      a planifié ses repas. On le lit ici, en lecture seule, pour que la
      séance s'ouvre sur du réel plutôt que sur « alors, ça va ? ».

      Une cliente sans compte, ou dont l'application ne répond pas, renvoie
      simplement `null` : la fiche n'affiche alors rien de plus qu'avant.
    */
    if (action === 'activite') {
      const { data: c } = await db
        .from('clientes')
        .select('email')
        .eq('id', clienteId)
        .maybeSingle();

      if (!c?.email) return json({ activite: null });
      const r = await nutrition({ action: 'activite', email: c.email });
      if (!r.ok) return json({ activite: null });
      return json({ activite: r.corps?.activite ?? null });
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

      /*
        Mon Parcours, et pas le relais : l'identifiant vient de sa liste à
        lui. Les deux applications numérotent leurs comptes séparément, et
        envoyer un identifiant de Mon Parcours au relais ne désignerait
        personne.
      */
      const r = await monParcours({ action: 'renvoyer-invitation', id: trouvee.id });
      if (!r.ok) {
        return json(
          {
            error: r.corps?.erreur
              ? enClair(String(r.corps.erreur), r.corps?.detail ? String(r.corps.detail) : undefined)
              : `Renvoi refusé (${r.statut}).`,
          },
          502,
        );
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

    /*
      Un compte déjà existant n'est pas une erreur : on retient le parcours
      et on laisse la thérapeute renvoyer l'invitation. Mais tous les 409 ne
      se valent pas — « compte-sans-identifiant » dit qu'il y a une fiche
      sans compte de connexion, et l'annoncer comme un succès laissait la
      cliente sans accès en croyant l'avoir donné.
    */
    const dejaLa = r.statut === 409 && r.corps?.erreur !== 'compte-sans-identifiant';

    if (!r.ok && !dejaLa) {
      return json(
        {
          error: r.corps?.erreur
            ? enClair(String(r.corps.erreur), r.corps?.detail ? String(r.corps.detail) : undefined)
            : `L'application du parcours audio a refusé (${r.statut}).`,
        },
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
