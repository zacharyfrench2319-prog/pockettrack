import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const BASIQ_API_KEY = Deno.env.get("BASIQ_API_KEY");
    if (!BASIQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Basiq API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Basiq server token
    const tokenRes = await fetch("https://au-api.basiq.io/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${BASIQ_API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "basiq-version": "3.0",
      },
      body: "scope=SERVER_ACCESS",
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with Basiq" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const basiqToken = tokenData.access_token;

    // Check if user already has a basiq_user_id
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("basiq_user_id")
      .eq("user_id", userId)
      .single();

    let basiqUserId = profile?.basiq_user_id;

    // Create Basiq user if not exists
    if (!basiqUserId) {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email || `${userId}@pockettrack.app`;

      const createRes = await fetch("https://au-api.basiq.io/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${basiqToken}`,
          "Content-Type": "application/json",
          "basiq-version": "3.0",
        },
        body: JSON.stringify({ email: userEmail }),
      });
      const basiqUser = await createRes.json();
      basiqUserId = basiqUser.id;

      if (!basiqUserId) {
        return new Response(
          JSON.stringify({ error: "Failed to create Basiq user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminClient
        .from("profiles")
        .update({ basiq_user_id: basiqUserId })
        .eq("user_id", userId);
    }

    // Create consent/auth link
    const consentRes = await fetch(
      `https://au-api.basiq.io/users/${basiqUserId}/auth_link`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${basiqToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "basiq-version": "3.0",
        },
        body: JSON.stringify({}),
      }
    );
    const consentData = await consentRes.json();

    if (!consentData.links?.self) {
      return new Response(
        JSON.stringify({ error: "Failed to generate consent URL", details: consentData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ url: consentData.links.self }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
