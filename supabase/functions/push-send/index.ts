import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import {
  buildPayload,
  deliver,
  secureCompare,
  validateRequest,
  type PushSubscriptionRow,
} from "./logic.ts";

// push-send — the single serverside Web Push sender (feature 018).
// Contract: specs/018-push-notifications/contracts/push-send.md
//
// Called server-to-server only (analysis-run-callback in this feature) and
// protected by X-Push-Token. Deployed with --no-verify-jwt.
//
// Secrets: VAPID_KEYS (JWK pair), VAPID_SUBJECT (mailto:), PUSH_SEND_TOKEN.
// The VAPID private key never leaves this function.
//
// Library note: npm:web-push does NOT work on the Supabase Edge Runtime — it
// calls Node's crypto.createECDH, which Deno does not implement. @negrel/webpush
// is built on Web Crypto (research.md R1).

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TABLE = "push_subscriptions";
const TTL_SECONDS = 3600;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ code: "METHOD_NOT_ALLOWED", message: "Alleen POST wordt ondersteund." }, 405);
  }

  const expectedToken = Deno.env.get("PUSH_SEND_TOKEN") ?? "";
  if (!secureCompare(req.headers.get("X-Push-Token") ?? "", expectedToken)) {
    return json({ code: "UNAUTHORIZED", message: "Ongeldige aanroep." }, 401);
  }

  const vapidKeysJson = Deno.env.get("VAPID_KEYS");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (!vapidKeysJson || !vapidSubject) {
    console.error(JSON.stringify({ code: "NOT_CONFIGURED" }));
    return json(
      { code: "NOT_CONFIGURED", message: "Pushmeldingen zijn niet geconfigureerd." },
      500,
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const validation = validateRequest(body);
    if (!validation.ok) {
      return json({ code: "VALIDATION", message: "Ongeldige aanroep." }, 400);
    }

    const { userId, kind, runId } = validation.value;

    const { data, error } = await serviceClient
      .from(TABLE)
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (error) {
      console.error(JSON.stringify({ code: "READ_FAILED" }));
      return json(
        { code: "INTERNAL_ERROR", message: "De abonnementen konden niet worden gelezen." },
        500,
      );
    }

    const subscriptions = (data ?? []) as PushSubscriptionRow[];
    if (subscriptions.length === 0) {
      return json({ ok: true, sent: 0, removed: 0, failed: 0 });
    }

    let server: webpush.ApplicationServer;
    try {
      const vapidKeys = await webpush.importVapidKeys(JSON.parse(vapidKeysJson));
      server = await webpush.ApplicationServer.new({
        contactInformation: vapidSubject,
        vapidKeys,
      });
    } catch {
      console.error(JSON.stringify({ code: "NOT_CONFIGURED" }));
      return json(
        { code: "NOT_CONFIGURED", message: "Pushmeldingen zijn niet geconfigureerd." },
        500,
      );
    }

    const payload = buildPayload(kind, runId);

    const counts = await deliver(
      subscriptions,
      (row) =>
        server
          .subscribe({
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          })
          .pushTextMessage(payload, { ttl: TTL_SECONDS, urgency: webpush.Urgency.High }),
      {
        onGone: async (subscriptionId) => {
          const { error: deleteError } = await serviceClient
            .from(TABLE)
            .delete()
            .eq("id", subscriptionId);
          if (deleteError) throw new Error("delete failed");
        },
        onError: ({ subscriptionId, status }) => {
          // Code, subscription id and status only — never endpoint, keys,
          // user id or client content (constitution III).
          console.error(
            JSON.stringify({ code: "SEND_FAILED", subscription_id: subscriptionId, status }),
          );
        },
      },
    );

    console.log(JSON.stringify({ code: "PUSH_SENT", ...counts }));

    return json({ ok: true, ...counts });
  } catch {
    console.error(JSON.stringify({ code: "INTERNAL_ERROR" }));
    return json({ code: "INTERNAL_ERROR", message: "Er ging iets mis." }, 500);
  }
});
