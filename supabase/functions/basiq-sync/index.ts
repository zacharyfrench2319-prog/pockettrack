import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function categorize(merchant: string): string {
  const m = (merchant || "").toLowerCase();
  // Groceries
  if (/coles|woolworths|woolies|aldi|iga|costco|foodworks/.test(m)) return "groceries";
  // Eating out
  if (/uber\s?eats|menulog|doordash|mcdonald|kfc|hungry jack|domino|pizza|restaurant|cafe|coffee|starbucks|sushi|thai|chinese|indian|nando|grill|subway|burger/.test(m)) return "eating_out";
  // Transport
  if (/uber(?!\s?eat)|transperth|opal|myki|fuel|bp |shell |caltex|ampol|7-eleven fuel|parking|toll/.test(m)) return "transport";
  // Entertainment
  if (/netflix|spotify|stan|disney|youtube|cinema|hoyts|event cinemas|apple music|xbox|playstation|steam|twitch/.test(m)) return "entertainment";
  // Shopping
  if (/amazon|ebay|kmart|target|big\s?w|jb hi|officeworks|bunnings|ikea|myer|david jones|asos|shein|zara|uniqlo|cotton on/.test(m)) return "shopping";
  // Bills
  if (/electric|energy|gas|water|internet|telstra|optus|vodafone|phone|insurance|agl|origin|nbn|rent/.test(m)) return "bills";
  // Health
  if (/pharmacy|chemist|doctor|gp |medical|gym|fitness|dental|physio|hospital/.test(m)) return "health";
  return "other";
}

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

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("basiq_user_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.basiq_user_id) {
      return new Response(
        JSON.stringify({ error: "No bank account connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Check connections to get bank name
    const connRes = await fetch(
      `https://au-api.basiq.io/users/${profile.basiq_user_id}/connections`,
      {
        headers: {
          Authorization: `Bearer ${basiqToken}`,
          "basiq-version": "3.0",
        },
      }
    );
    const connData = await connRes.json();
    const connections = connData.data || [];

    if (connections.length > 0) {
      const bankName = connections[0].institution?.shortName || connections[0].institution?.name || "Bank";
      await adminClient
        .from("profiles")
        .update({ bank_connected: true, bank_name: bankName })
        .eq("user_id", userId);
    } else {
      return new Response(
        JSON.stringify({ error: "No bank connections found. Please complete bank linking first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch transactions from Basiq (last 90 days)
    const txRes = await fetch(
      `https://au-api.basiq.io/users/${profile.basiq_user_id}/transactions?limit=500`,
      {
        headers: {
          Authorization: `Bearer ${basiqToken}`,
          "basiq-version": "3.0",
        },
      }
    );
    const txData = await txRes.json();
    const basiqTransactions = txData.data || [];

    if (basiqTransactions.length === 0) {
      return new Response(
        JSON.stringify({ imported: 0, message: "No transactions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing bank transactions to avoid duplicates
    const { data: existing } = await adminClient
      .from("transactions")
      .select("date, amount, merchant")
      .eq("user_id", userId)
      .eq("source", "bank");

    const existingSet = new Set(
      (existing || []).map((e) => `${e.date}|${e.amount}|${(e.merchant || "").toLowerCase()}`)
    );

    const toInsert = [];
    for (const bt of basiqTransactions) {
      const amount = Math.abs(parseFloat(bt.amount || "0"));
      if (amount === 0) continue;

      const isCredit = parseFloat(bt.amount) > 0;
      const merchant = bt.description || bt.subClass?.title || "";
      const txDate = bt.transactionDate || bt.postDate || "";
      if (!txDate) continue;

      const dateStr = txDate.substring(0, 10); // yyyy-mm-dd
      const key = `${dateStr}|${amount}|${merchant.toLowerCase()}`;
      if (existingSet.has(key)) continue;

      toInsert.push({
        user_id: userId,
        amount,
        type: isCredit ? "income" : "expense",
        date: dateStr,
        merchant: merchant.substring(0, 200),
        description: bt.description?.substring(0, 500) || null,
        source: "bank",
        category: isCredit ? null : categorize(merchant),
        is_subscription: false,
      });

      existingSet.add(key); // prevent duplicates within batch
    }

    let imported = 0;
    if (toInsert.length > 0) {
      // Insert in chunks of 100
      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        const { error } = await adminClient.from("transactions").insert(chunk);
        if (!error) imported += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({ imported, total: basiqTransactions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
