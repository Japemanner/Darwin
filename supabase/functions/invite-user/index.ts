import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { email, organization_id, role } = await req.json();

    if (!email || !organization_id || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, organization_id, role" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!["admin", "member"].includes(role)) {
      return new Response(JSON.stringify({ error: "Role must be 'admin' or 'member'" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the authenticated user from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin of the organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .eq("organization_id", organization_id)
      .single();

    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only organization admins can invite users" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create the invitation
    const { data: invitation, error: insertError } = await supabase
      .from("invitations")
      .insert({
        email,
        organization_id,
        role,
        invited_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create invitation:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create invitation" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Send invite email via Supabase Auth
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SUPABASE_URL}`,
      data: {
        organization_id,
        role,
        invitation_id: invitation.id,
      },
    });

    if (inviteError) {
      console.error("Failed to send invite email:", inviteError);
      // Don't fail — invitation is already in the DB
    }

    return new Response(JSON.stringify({ success: true, invitation }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
