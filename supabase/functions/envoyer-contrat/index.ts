/*
  Envoi du contrat signé à la cliente, par email.

  Fonction Edge Supabase : la clé Resend vit ici, côté serveur, et n'arrive
  jamais dans le navigateur.

  Activation :
    1. Créer un compte Resend et y vérifier le domaine mabeautyplus.fr
    2. Supabase → Edge Functions → Secrets → RESEND_API_KEY
    3. Déployer :  supabase functions deploy envoyer-contrat
*/

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const enTetesCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Envoi {
  emailCliente: string;
  prenom: string;
  nom: string;
  centre: string;
  emailCentre: string;
  dateSignature: string;
  pdfBase64: string;
  consentements?: Array<{ nom: string; pdfBase64: string }>;
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

  try {
    const cle = Deno.env.get('RESEND_API_KEY');
    if (!cle) {
      return json({ error: "RESEND_API_KEY n'est pas configurée." }, 500);
    }

    const p: Envoi = await req.json();
    if (!p.emailCliente) {
      return json({ error: "La cliente n'a pas d'adresse email." }, 400);
    }

    const nomFichier = `Contrat_MAbeautyplus_${p.nom}_${p.prenom}.pdf`;

    const pieces = [
      { filename: nomFichier, content: p.pdfBase64 },
      ...(p.consentements ?? []).map((c) => ({ filename: c.nom, content: c.pdfBase64 })),
    ];

    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `MAbeautyplus <contact@mabeautyplus.fr>`,
        reply_to: p.emailCentre,
        to: [p.emailCliente],
        subject: `Votre contrat MAbeautyplus ${p.centre} — signé le ${p.dateSignature}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
            <div style="background: #1b6684; padding: 32px 40px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 400;">MAbeautyplus</h1>
              <p style="color: rgba(255,255,255,.8); margin: 6px 0 0; font-size: 14px;">Centre ${p.centre}</p>
            </div>
            <div style="background: #fff; padding: 36px 40px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="font-size: 16px; margin: 0 0 16px;">Bonjour <strong>${p.prenom}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                Nous vous confirmons la signature de votre contrat en date du <strong>${p.dateSignature}</strong>.
              </p>
              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Votre contrat signé${(p.consentements?.length ?? 0) > 0 ? ' et vos consentements sont joints' : ' est joint'} à cet email au format PDF. Nous vous recommandons de les conserver.
              </p>
              <p style="font-size: 15px; margin: 0 0 8px;">À très bientôt,</p>
              <p style="font-size: 15px; font-weight: 700; margin: 0; color: #1b6684;">L'équipe MAbeautyplus ${p.centre}</p>
            </div>
            <div style="background: #f9fafb; padding: 16px 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">MAbeautyplus — ${p.emailCentre}</p>
            </div>
          </div>
        `,
        attachments: pieces,
      }),
    });

    const donnees = await reponse.json();
    if (!reponse.ok) return json({ error: donnees }, 500);

    return json({ ok: true, id: donnees.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
