import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { organization_name, user_email, user_full_name, user_password, user_role } = await req.json();

    if (!organization_name || !user_email || !user_full_name || !user_password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: organization_name, user_email, user_full_name, user_password" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    if (user_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const role = user_role || "admin";
    if (!["admin", "member"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Role must be 'admin' or 'member'" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

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

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can create new tenants" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Step 1: Create the organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: organization_name })
      .select()
      .single();

    if (orgError) {
      console.error("Failed to create organization:", orgError);
      return new Response(JSON.stringify({ error: "Failed to create organization" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Step 2: Create a pending invitation so the handle_new_user trigger
    // picks up the right org when the user is created
    const { data: invitation, error: invError } = await supabase
      .from("invitations")
      .insert({
        email: user_email,
        organization_id: org.id,
        role,
        invited_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (invError) {
      // Cleanup: remove the org we just created
      await supabase.from("organizations").delete().eq("id", org.id);
      console.error("Failed to create invitation:", invError);
      return new Response(JSON.stringify({ error: "Failed to create invitation" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Step 3: Create the auth user — handle_new_user trigger fires,
    // finds the pending invitation, and creates the profile with the
    // correct organization_id and role
    const { data: newUser, error: userError } = await supabase.auth.admin.createUser({
      email: user_email,
      password: user_password,
      email_confirm: true,
      user_metadata: {
        full_name: user_full_name,
      },
    });

    if (userError) {
      // Cleanup: remove invitation and org
      await supabase.from("invitations").delete().eq("id", invitation.id);
      await supabase.from("organizations").delete().eq("id", org.id);
      console.error("Failed to create user:", userError);
      return new Response(JSON.stringify({ error: `Failed to create user: ${userError.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Step 4: Verify the trigger created the profile correctly.
    // The trigger should have set the right org and role, but we
    // upsert as a safety net in case the trigger used fallback values.
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: newUser.id,
      organization_id: org.id,
      full_name: user_full_name,
      role,
    });

    if (profileError) {
      console.error("Profile upsert failed:", profileError);
      // Non-fatal: the trigger likely already created a correct profile
    }

    // Step 5: Mark the invitation as accepted
    await supabase.from("invitations").update({ status: "accepted" }).eq("id", invitation.id);

    // Step 6: If the trigger created a spurious personal org, clean it up.
    // The trigger creates "User's Organization" when no invitation exists,
    // but we pre-created the invitation so this shouldn't happen.
    // Still, we check and remove any empty personal orgs.
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", newUser.id)
      .single();

    if (userProfile && userProfile.organization_id !== org.id) {
      // The trigger assigned a different org — fix it
      await supabase.from("profiles").update({ organization_id: org.id }).eq("id", newUser.id);

      // Check if the spurious org has no other members and remove it
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", userProfile.organization_id);

      if (count === 1) {
        await supabase.from("organizations").delete().eq("id", userProfile.organization_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        organization: { id: org.id, name: org.name },
        user: { id: newUser.id, email: newUser.email },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});