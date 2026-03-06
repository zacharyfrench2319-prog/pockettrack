import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user_id = authUser.id;

    const { image_base64, user_reasoning, product_name, price } = await req.json();
    if (!image_base64 && (!product_name || typeof price !== "number")) {
      return new Response(
        JSON.stringify({ error: "Missing image or text description" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("monthly_income, saving_goal, display_name, pay_frequency, next_pay_date, spending_concerns, personal_context")
      .eq("user_id", user_id)
      .single();

    // Get transactions for context
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, type, date, category")
      .eq("user_id", user_id);

    const allTx = transactions || [];

    const totalIncome = allTx
      .filter((t: any) => t.type === "income")
      .reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalExpenses = allTx
      .filter((t: any) => t.type === "expense")
      .reduce((s: number, t: any) => s + Number(t.amount), 0);
    const balance = totalIncome - totalExpenses;

    const weeklySpend = allTx
      .filter((t: any) => t.type === "expense" && t.date >= weekStartStr)
      .reduce((s: number, t: any) => s + Number(t.amount), 0);

    const monthlySpend = allTx
      .filter((t: any) => t.type === "expense" && t.date >= monthStartStr)
      .reduce((s: number, t: any) => s + Number(t.amount), 0);

    // Get savings goals, accounts, and net worth
    const [goalsRes, accountsRes, nwRes] = await Promise.all([
      supabase.from("savings_goals").select("name, target_amount, current_amount").eq("user_id", user_id),
      supabase.from("accounts").select("name, type, balance").eq("user_id", user_id),
      supabase.from("net_worth_snapshots").select("total, date").eq("user_id", user_id).order("date", { ascending: false }).limit(1),
    ]);

    const goals = goalsRes.data || [];
    const accounts = accountsRes.data || [];
    const latestNetWorth = nwRes.data?.[0]?.total ?? null;

    const accountNetWorth = accounts.reduce((s: number, a: any) => {
      return s + (a.type === "credit_card" ? -Number(a.balance) : Number(a.balance));
    }, 0);

    const netWorth = latestNetWorth !== null ? Number(latestNetWorth) : accountNetWorth;

    const goalsContext = goals
      .map((g: any) => `${g.name}: $${g.current_amount || 0}/$${g.target_amount}`)
      .join(", ");

    const accountsContext = accounts
      .map((a: any) => `${a.name} (${a.type}): $${a.balance}`)
      .join(", ");

    const monthlyIncome = profile?.monthly_income || 0;
    const savingFor = profile?.saving_goal || "not specified";
    const payFrequency = profile?.pay_frequency || "not specified";
    const nextPayDate = profile?.next_pay_date || "not specified";
    const spendingConcerns = profile?.spending_concerns?.join(", ") || "none specified";
    const personalContext = profile?.personal_context || "";

    let financialContext = `
Net worth: $${netWorth.toFixed(2)} (THIS IS THE USER'S REAL WEALTH — use this for affordability)
Account balances: ${accountsContext || "none tracked"}
Monthly income: $${monthlyIncome}
Transaction cash flow: $${balance.toFixed(2)} (tracked income minus expenses — NOT their total wealth)
Weekly spending so far: $${weeklySpend.toFixed(2)}
Monthly spending so far: $${monthlySpend.toFixed(2)}
Pay frequency: ${payFrequency}
Next pay date: ${nextPayDate}
Saving for: ${savingFor}
Active savings goals: ${goalsContext || "none"}
Spending concerns: ${spendingConcerns}
    `.trim();

    if (personalContext) {
      financialContext += `\n\nPersonal context from user: "${personalContext}"`;
    }

    const hasImage = !!image_base64;
    let reasoningSection = "";
    if (user_reasoning) {
      reasoningSection = `\n\nThe user provided this reason for wanting to buy it: "${user_reasoning}"\nFactor this into your advice. If they have a legitimate need, weigh that against their finances.`;
    }

    let introSection: string;
    if (hasImage) {
      introSection = `You are a smart financial advisor helping someone decide whether to buy something. Identify the product and its approximate price from the image. Consider their financial situation:`;
    } else {
      const reasonText = user_reasoning?.trim() || "no specific reason given.";
      introSection = `You are a smart financial advisor helping someone decide whether to buy something.\n\nThe user wants to buy: ${product_name} for $${price.toFixed(
        2,
      )}. Reason: ${reasonText}\n\nConsider their financial situation:`;
    }

    const promptText = `${introSection}

${financialContext}${reasoningSection}

Return JSON only, no other text:
{
  "product_name": "string",
  "estimated_price": number,
  "verdict": "go_for_it" | "think_twice" | "skip_it",
  "reason": "2-3 sentences explaining why based on their finances — be specific, reference their actual spending and goals",
  "category": "one of: groceries, eating_out, transport, entertainment, shopping, bills, health, other",
  "cheaper_alternative": "string or null"
}

CRITICAL: The user's "Net worth" is their REAL financial position (bank accounts, savings, investments). Use this to judge affordability — NOT "Transaction cash flow" which is just a log. A user with $100k net worth can afford a $50 dinner even if their tracked transactions show net negative. However, still flag overspending habits relative to income.

Be personal and direct. Reference their actual numbers. For example: "You've already spent $180 on food this week. This would push you over your budget." Not generic advice.`;

    const parts: any[] = [{ text: promptText }];
    if (hasImage) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: image_base64,
        },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to analyse product" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extracted;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Could not parse product analysis", raw: content }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    extracted.context = {
      weekly_spend: weeklySpend,
      net_worth: netWorth,
      balance,
      saving_for: savingFor,
      goals_summary: goalsContext,
    };

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-product error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
