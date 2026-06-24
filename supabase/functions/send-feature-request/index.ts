// Darwin — send-feature-request edge function
// Ontvangt een feature request van een ingelogde gebruiker, slaat op in DB,
// en stuurt een notificatie e-mail naar jaap@jaaphoeve.com via Resend.
//
// Secrets (Supabase Edge Function env):
//   SUPABASE_URL            — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
//   RESEND_API_KEY           — Resend API key (re_xxx)
//
// Resend docs: POST https://api.resend.com/emails
//   from, to, subject, html — JSON body, Authorization: Bearer <key>

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const NOTIFICATION_EMAIL = "jaap@jaaphoeve.com";
const FROM_EMAIL = "Darwin <noreply@jaaphoeve.com>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { title, description, motivation } = await req.json();

    if (!title || !description) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: title, description" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Verifieer JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Haal profiel op voor naam en e-mail
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const submitterName = profile?.full_name ?? "Onbekend";
    const submitterEmail = user.email ?? "Onbekend e-mailadres";

    // Sla feature request op in de database
    const { error: insertError } = await supabase.from("feature_requests").insert({
      title,
      description,
      motivation: motivation || null,
      submitted_by: user.id,
      status: "nieuw",
    });

    if (insertError) {
      console.error("Failed to insert feature request:", insertError);
      return new Response(
        JSON.stringify({ error: "Kon request niet opslaan" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Stuur notificatie e-mail via Resend
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #1a1a1a; font-size: 20px; margin-bottom: 24px;">Nieuwe feature request</h1>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 13px; width: 120px; vertical-align: top;">Ingediend door</td>
            <td style="padding: 8px 0; font-size: 14px;"><strong>${submitterName}</strong> (${submitterEmail})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 13px; vertical-align: top;">Titel</td>
            <td style="padding: 8px 0; font-size: 14px;"><strong>${title}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 13px; vertical-align: top;">Beschrijving</td>
            <td style="padding: 8px 0; font-size: 14px; white-space: pre-wrap;">${description}</td>
          </tr>
          ${motivation ? `
          <tr>
            <td style="padding: 8px 0; color: #666; font-size: 13px; vertical-align: top;">Motivatie</td>
            <td style="padding: 8px 0; font-size: 14px; white-space: pre-wrap;">${motivation}</td>
          </tr>
          ` : ""}
        </table>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">
          Deze e-mail is automatisch verzonden door Darwin. Bekijk alle feature requests in de Supabase dashboard.
        </p>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [NOTIFICATION_EMAIL],
        subject: `Nieuwe feature request: ${title}`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error("Resend API error:", resendError);
      // Request is al opgeslagen in DB — e-mail falen is niet fataal
      return new Response(
        JSON.stringify({ success: true, warning: "Request opgeslagen, maar e-mail notificatie mislukt" }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});