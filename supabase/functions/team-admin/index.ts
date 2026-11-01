import { createClient } from "jsr:@supabase/supabase-js@2";

// team-admin — one server-side route for inviting, resending, revoking,
// changing roles and blocking/unblocking team members.
// Contract: specs/020-team-management/contracts/team-admin.md
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// ALLOWED_ORIGINS (comma-separated; fail-closed CORS, never '*').

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function corsHeaders(req: Request): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = req.headers.get("Origin");
  if (!origin || !allowed.includes(origin)) return base;
  return { ...base, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "Uw sessie is verlopen. Log opnieuw in.",
  FORBIDDEN: "U heeft geen rechten voor deze actie.",
  VALIDATION: "Ongeldige invoer.",
  NOT_FOUND: "Dit teamlid bestaat niet in deze organisatie.",
  CONFLICT: "De actie kon niet worden uitgevoerd.",
  INTERNAL_ERROR: "Er ging iets mis. Probeer het opnieuw.",
};

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

function json(value: unknown, cors: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function errorResponse(
  code: ErrorCode,
  cors: Record<string, string>,
  message?: string,
): Response {
  return json({ code, message: message ?? ERROR_MESSAGES[code] }, cors, STATUS_BY_CODE[code]);
}

// Log only codes, organization/target UUIDs and duration — never e-mail
// addresses, names, tokens, invite links or raw upstream errors.
function logCode(
  code: string,
  action: string,
  started: number,
  organizationId?: string,
  targetId?: string,
): void {
  console.error(
    JSON.stringify({
      code,
      action,
      organization_id: organizationId,
      target_id: targetId,
      ms: Date.now() - started,
    }),
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_VALUES = ["admin", "member"] as const;
type Role = (typeof ROLE_VALUES)[number];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return asString(value).toLowerCase();
}

interface ProfileRow {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  role: Role;
  status: "invited" | "active" | "blocked";
  created_at: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: "invited" | "active" | "blocked";
  created_at: string;
  is_self: boolean;
  is_protected: boolean;
}

interface CallerProfile {
  id: string;
  organization_id: string;
  role: Role;
  status: "invited" | "active" | "blocked";
}

function toMember(
  row: ProfileRow,
  callerId: string,
  callerIsPlatformAdmin: boolean,
  platformAdminIds: Set<string>,
): TeamMember {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    is_self: row.id === callerId,
    is_protected: platformAdminIds.has(row.id) && !callerIsPlatformAdmin,
  };
}

function asProfileRow(value: unknown): ProfileRow | null {
  if (Array.isArray(value)) return (value[0] as ProfileRow | undefined) ?? null;
  return (value as ProfileRow | null) ?? null;
}

function memberFromRpc(
  value: unknown,
  callerId: string,
  callerIsPlatformAdmin: boolean,
  platformAdminIds: Set<string>,
): TeamMember | null {
  const row = asProfileRow(value);
  if (!row) return null;
  return toMember(row, callerId, callerIsPlatformAdmin, platformAdminIds);
}

async function loadPlatformAdminIds(): Promise<Set<string> | null> {
  const { data, error } = await serviceClient.from("platform_admins").select("user_id");
  if (error) return null;
  return new Set((data ?? []).map((row: { user_id: string }) => row.user_id));
}

async function getTarget(
  organizationId: string,
  userId: string,
): Promise<{ target: ProfileRow | null; failed: boolean }> {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, organization_id, full_name, email, role, status, created_at")
    .eq("id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { target: null, failed: true };
  return { target: (data as ProfileRow | null) ?? null, failed: false };
}

function rpcError(
  error: { message?: string } | null,
  cors: Record<string, string>,
  action: string,
  started: number,
  organizationId: string,
  targetId: string,
): Response | null {
  const message = error?.message ?? "";
  if (message.includes("FORBIDDEN")) {
    logCode("FORBIDDEN", action, started, organizationId, targetId);
    return errorResponse("FORBIDDEN", cors);
  }
  if (message.includes("NOT_FOUND")) {
    logCode("NOT_FOUND", action, started, organizationId, targetId);
    return errorResponse("NOT_FOUND", cors);
  }
  if (message.includes("SELF")) {
    logCode("VALIDATION", action, started, organizationId, targetId);
    return errorResponse(
      "VALIDATION",
      cors,
      "U kunt uw eigen account niet blokkeren of uw eigen rol wijzigen.",
    );
  }
  if (message.includes("LAST_ADMIN")) {
    logCode("CONFLICT", action, started, organizationId, targetId);
    return errorResponse(
      "CONFLICT",
      cors,
      "Een organisatie heeft minimaal één actieve beheerder nodig.",
    );
  }
  logCode("INTERNAL_ERROR", action, started, organizationId, targetId);
  return errorResponse("INTERNAL_ERROR", cors);
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors });
  }
  if (req.method !== "POST") {
    return errorResponse("VALIDATION", cors);
  }

  const started = Date.now();

  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const action = asString(body?.action);
    const organizationId = asString(body?.organization_id);

    if (!action || !UUID_RE.test(organizationId)) {
      return errorResponse("VALIDATION", cors);
    }

    // --- AuthN
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("UNAUTHORIZED", cors);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return errorResponse("UNAUTHORIZED", cors);

    // --- Caller profile (service role: the authorization check below is the gate)
    const { data: callerProfile, error: callerError } = await serviceClient
      .from("profiles")
      .select("id, organization_id, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (callerError) {
      logCode("INTERNAL_ERROR", action, started, organizationId);
      return errorResponse("INTERNAL_ERROR", cors);
    }
    if (!callerProfile) {
      logCode("FORBIDDEN", action, started, organizationId);
      return errorResponse(
        "FORBIDDEN",
        cors,
        "Uw account is geblokkeerd of niet gekoppeld aan een organisatie.",
      );
    }

    const caller = callerProfile as CallerProfile;
    if (caller.status === "blocked") {
      logCode("FORBIDDEN", action, started, organizationId);
      return errorResponse("FORBIDDEN", cors, "Uw account is geblokkeerd.");
    }

    // --- AuthZ: platform administrator or active office admin of this org
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: isPlatformAdmin, error: platformError } =
      await userClient.rpc("is_platform_admin");
    if (platformError) {
      logCode("INTERNAL_ERROR", action, started, organizationId);
      return errorResponse("INTERNAL_ERROR", cors);
    }

    const callerIsPlatformAdmin = isPlatformAdmin === true;
    const callerIsOfficeAdmin =
      caller.role === "admin" &&
      caller.status === "active" &&
      caller.organization_id === organizationId;

    if (!callerIsPlatformAdmin && !callerIsOfficeAdmin) {
      logCode("FORBIDDEN", action, started, organizationId);
      return errorResponse("FORBIDDEN", cors);
    }

    // ---------------------------------------------------------------- list
    if (action === "list_members") {
      const platformAdminIds = await loadPlatformAdminIds();
      if (!platformAdminIds) {
        logCode("INTERNAL_ERROR", action, started, organizationId);
        return errorResponse("INTERNAL_ERROR", cors);
      }

      const { data, error } = await serviceClient
        .from("profiles")
        .select("id, organization_id, full_name, email, role, status, created_at")
        .eq("organization_id", organizationId);

      if (error) {
        logCode("INTERNAL_ERROR", action, started, organizationId);
        return errorResponse("INTERNAL_ERROR", cors);
      }

      const statusRank: Record<string, number> = { active: 0, invited: 1, blocked: 2 };
      const members = ((data ?? []) as ProfileRow[])
        .map((row) => toMember(row, user.id, callerIsPlatformAdmin, platformAdminIds))
        .sort((a, b) => {
          const rank = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
          if (rank !== 0) return rank;
          return a.full_name.localeCompare(b.full_name, "nl");
        });

      return json(members, cors);
    }

    // ------------------------------------------------------------- invite
    if (action === "invite") {
      const email = normalizeEmail(body?.email);
      const fullName = asString(body?.full_name);
      const role = asString(body?.role);

      if (!EMAIL_RE.test(email) || fullName.length < 1 || fullName.length > 100) {
        return errorResponse("VALIDATION", cors);
      }
      if (!ROLE_VALUES.includes(role as Role)) {
        return errorResponse("VALIDATION", cors);
      }

      const { data: existing, error: existingError } = await serviceClient
        .from("profiles")
        .select("id, organization_id")
        .eq("email", email)
        .maybeSingle();

      if (existingError) {
        logCode("INTERNAL_ERROR", action, started, organizationId);
        return errorResponse("INTERNAL_ERROR", cors);
      }
      if (existing) {
        logCode("CONFLICT", action, started, organizationId);
        return errorResponse(
          "CONFLICT",
          cors,
          existing.organization_id === organizationId
            ? "Deze persoon staat al in het team."
            : "Dit e-mailadres hoort al bij een andere organisatie.",
        );
      }

      const { data: invited, error: inviteError } = await serviceClient.auth.admin
        .inviteUserByEmail(email, { data: { full_name: fullName } });

      if (inviteError) {
        const code = inviteError.code ?? "";
        logCode(
          code === "email_exists" || code === "user_already_exists"
            ? "CONFLICT"
            : code === "over_email_send_rate_limit"
              ? "CONFLICT"
              : "INTERNAL_ERROR",
          action,
          started,
          organizationId,
        );
        if (code === "email_exists" || code === "user_already_exists") {
          return errorResponse(
            "CONFLICT",
            cors,
            "Dit e-mailadres heeft al een account. Neem contact op met de platformbeheerder.",
          );
        }
        if (code === "over_email_send_rate_limit") {
          return errorResponse(
            "CONFLICT",
            cors,
            "Er zijn te veel e-mails naar dit adres verstuurd. Probeer het later opnieuw.",
          );
        }
        return errorResponse("INTERNAL_ERROR", cors);
      }

      if (!invited?.user) {
        logCode("INTERNAL_ERROR", action, started, organizationId);
        return errorResponse("INTERNAL_ERROR", cors);
      }

      const { data: inserted, error: insertError } = await serviceClient
        .from("profiles")
        .insert({
          id: invited.user.id,
          organization_id: organizationId,
          full_name: fullName,
          email,
          role,
          status: "invited",
        })
        .select("id, organization_id, full_name, email, role, status, created_at")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          // A concurrent profile claimed the address. Do not delete the auth
          // user: it may belong to that existing profile.
          logCode("CONFLICT", action, started, organizationId);
          return errorResponse("CONFLICT", cors, "Deze persoon staat al in het team.");
        }
        await serviceClient.auth.admin.deleteUser(invited.user.id);
        logCode("INTERNAL_ERROR", action, started, organizationId);
        return errorResponse("INTERNAL_ERROR", cors);
      }

      return json(
        { member: toMember(inserted as ProfileRow, user.id, callerIsPlatformAdmin, new Set()) },
        cors,
      );
    }

    const targetUserId = asString(body?.user_id);
    if (!UUID_RE.test(targetUserId)) {
      return errorResponse("VALIDATION", cors);
    }

    // ------------------------------------------------------- resend invite
    if (action === "resend_invite") {
      const targetResult = await getTarget(organizationId, targetUserId);
      if (targetResult.failed) {
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }
      const target = targetResult.target;
      if (!target) {
        logCode("NOT_FOUND", action, started, organizationId, targetUserId);
        return errorResponse("NOT_FOUND", cors);
      }
      if (target.status !== "invited") {
        logCode("CONFLICT", action, started, organizationId, targetUserId);
        return errorResponse(
          "CONFLICT",
          cors,
          "Deze uitnodiging is al geaccepteerd. Blokkeer het account in plaats daarvan.",
        );
      }

      const { error } = await serviceClient.auth.admin.inviteUserByEmail(target.email, {
        data: { full_name: target.full_name },
      });
      if (error) {
        const code = error.code ?? "";
        if (code === "email_exists" || code === "user_already_exists") {
          logCode("CONFLICT", action, started, organizationId, targetUserId);
          return errorResponse(
            "CONFLICT",
            cors,
            "Deze uitnodiging is al geaccepteerd. Blokkeer het account in plaats daarvan.",
          );
        }
        if (code === "over_email_send_rate_limit") {
          logCode("CONFLICT", action, started, organizationId, targetUserId);
          return errorResponse(
            "CONFLICT",
            cors,
            "Er zijn te veel e-mails naar dit adres verstuurd. Probeer het later opnieuw.",
          );
        }
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }

      return json({ ok: true }, cors);
    }

    // ------------------------------------------------------- revoke invite
    if (action === "revoke_invite") {
      const targetResult = await getTarget(organizationId, targetUserId);
      if (targetResult.failed) {
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }
      const target = targetResult.target;
      if (!target) {
        logCode("NOT_FOUND", action, started, organizationId, targetUserId);
        return errorResponse("NOT_FOUND", cors);
      }
      if (target.status !== "invited") {
        logCode("CONFLICT", action, started, organizationId, targetUserId);
        return errorResponse(
          "CONFLICT",
          cors,
          "Deze uitnodiging is al geaccepteerd. Blokkeer het account in plaats daarvan.",
        );
      }

      const { data: authUser, error: userError } = await serviceClient.auth.admin
        .getUserById(targetUserId);
      if (userError || !authUser?.user || authUser.user.email_confirmed_at) {
        logCode("CONFLICT", action, started, organizationId, targetUserId);
        return errorResponse(
          "CONFLICT",
          cors,
          "Deze uitnodiging is al geaccepteerd. Blokkeer het account in plaats daarvan.",
        );
      }

      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(targetUserId);
      if (deleteError) {
        logCode("CONFLICT", action, started, organizationId, targetUserId);
        return errorResponse(
          "CONFLICT",
          cors,
          "Deze uitnodiging is al geaccepteerd. Blokkeer het account in plaats daarvan.",
        );
      }

      return json({ ok: true }, cors);
    }

    const platformAdminIds = await loadPlatformAdminIds();
    if (!platformAdminIds) {
      logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
      return errorResponse("INTERNAL_ERROR", cors);
    }

    // ----------------------------------------------------------- set role
    if (action === "set_role") {
      const role = asString(body?.role);
      if (!ROLE_VALUES.includes(role as Role)) {
        return errorResponse("VALIDATION", cors);
      }

      const { data, error } = await serviceClient.rpc("team_update_member", {
        p_actor: user.id,
        p_org: organizationId,
        p_target: targetUserId,
        p_role: role,
        p_status: null,
      });
      if (error) {
        return rpcError(error, cors, action, started, organizationId, targetUserId)
          ?? errorResponse("INTERNAL_ERROR", cors);
      }

      const member = memberFromRpc(data, user.id, callerIsPlatformAdmin, platformAdminIds);
      if (!member) {
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }
      return json({ member }, cors);
    }

    // --------------------------------------------------------------- block
    if (action === "block") {
      const targetResult = await getTarget(organizationId, targetUserId);
      if (targetResult.failed) {
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }
      const target = targetResult.target;
      if (!target) {
        logCode("NOT_FOUND", action, started, organizationId, targetUserId);
        return errorResponse("NOT_FOUND", cors);
      }
      if (target.status === "invited") {
        logCode("CONFLICT", action, started, organizationId, targetUserId);
        return errorResponse(
          "CONFLICT",
          cors,
          "Een uitgenodigd teamlid kan niet worden geblokkeerd. Trek de uitnodiging in.",
        );
      }
      if (target.status === "blocked") {
        logCode("CONFLICT", action, started, organizationId, targetUserId);
        return errorResponse("CONFLICT", cors, "Dit teamlid is al geblokkeerd.");
      }

      const previousStatus = target.status;

      const { data, error } = await serviceClient.rpc("team_update_member", {
        p_actor: user.id,
        p_org: organizationId,
        p_target: targetUserId,
        p_role: null,
        p_status: "blocked",
      });
      if (error) {
        return rpcError(error, cors, action, started, organizationId, targetUserId)
          ?? errorResponse("INTERNAL_ERROR", cors);
      }

      const { error: banError } = await serviceClient.auth.admin.updateUserById(
        targetUserId,
        { ban_duration: "876000h" },
      );
      if (banError) {
        await serviceClient.rpc("team_update_member", {
          p_actor: user.id,
          p_org: organizationId,
          p_target: targetUserId,
          p_role: null,
          p_status: previousStatus,
        });
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }

      const member = memberFromRpc(data, user.id, callerIsPlatformAdmin, platformAdminIds);
      if (!member) {
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }
      return json({ member }, cors);
    }

    // ------------------------------------------------------------- unblock
    if (action === "unblock") {
      const targetResult = await getTarget(organizationId, targetUserId);
      if (targetResult.failed) {
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }
      const target = targetResult.target;
      if (!target) {
        logCode("NOT_FOUND", action, started, organizationId, targetUserId);
        return errorResponse("NOT_FOUND", cors);
      }
      if (target.status !== "blocked") {
        logCode("CONFLICT", action, started, organizationId, targetUserId);
        return errorResponse("CONFLICT", cors, "Dit teamlid is niet geblokkeerd.");
      }

      const { data: authUser, error: userError } = await serviceClient.auth.admin
        .getUserById(targetUserId);
      if (userError || !authUser?.user) {
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }

      const { error: unbanError } = await serviceClient.auth.admin.updateUserById(
        targetUserId,
        { ban_duration: "none" },
      );
      if (unbanError) {
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }

      const nextStatus = authUser.user.email_confirmed_at ? "active" : "invited";
      const { data, error } = await serviceClient.rpc("team_update_member", {
        p_actor: user.id,
        p_org: organizationId,
        p_target: targetUserId,
        p_role: null,
        p_status: nextStatus,
      });
      if (error) {
        await serviceClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: "876000h",
        });
        return rpcError(error, cors, action, started, organizationId, targetUserId)
          ?? errorResponse("INTERNAL_ERROR", cors);
      }

      const member = memberFromRpc(data, user.id, callerIsPlatformAdmin, platformAdminIds);
      if (!member) {
        logCode("INTERNAL_ERROR", action, started, organizationId, targetUserId);
        return errorResponse("INTERNAL_ERROR", cors);
      }
      return json({ member }, cors);
    }

    return errorResponse("VALIDATION", cors);
  } catch {
    // Never log a raw error: it can contain e-mail addresses or upstream data.
    console.error(JSON.stringify({ code: "INTERNAL_ERROR", ms: Date.now() - started }));
    return errorResponse("INTERNAL_ERROR", cors);
  }
});
