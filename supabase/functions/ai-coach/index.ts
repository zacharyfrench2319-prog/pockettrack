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

    const { question, history } = await req.json();
    if (!question) {
      return new Response(
        JSON.stringify({ error: "Missing question" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // history is an optional array of { role: "user"|"model", text: string }
    const conversationHistory: { role: string; text: string }[] = Array.isArray(history) ? history.slice(-6) : [];

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Gather all user context in parallel
    const [profileRes, txRes, goalsRes, subsRes, budgetsRes, accountsRes, scheduledRes, nwRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user_id).single(),
      supabase.from("transactions").select("amount, type, date, category, merchant, description").eq("user_id", user_id).order("date", { ascending: false }).limit(200),
      supabase.from("savings_goals").select("*").eq("user_id", user_id),
      supabase.from("subscriptions").select("name, amount, frequency, is_active").eq("user_id", user_id).eq("is_active", true),
      supabase.from("budgets").select("category, amount").eq("user_id", user_id),
      supabase.from("accounts").select("name, type, balance").eq("user_id", user_id),
      supabase.from("scheduled_transactions").select("amount, type, frequency, merchant, next_date, is_active").eq("user_id", user_id).eq("is_active", true),
      supabase.from("net_worth_snapshots").select("total, date").eq("user_id", user_id).order("date", { ascending: false }).limit(1),
    ]);

    const profile = profileRes.data;
    const transactions = txRes.data || [];
    const goals = goalsRes.data || [];
    const subs = subsRes.data || [];
    const budgets = budgetsRes.data || [];
    const accounts = accountsRes.data || [];
    const scheduled = scheduledRes.data || [];
    const latestNetWorth = nwRes.data?.[0]?.total ?? null;

    // Compute summary stats
    const now = new Date();
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const totalIncome = transactions.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalExpenses = transactions.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const balance = totalIncome - totalExpenses;

    const monthlyExpenses = transactions
      .filter((t: any) => t.type === "expense" && t.date >= monthStartStr)
      .reduce((s: number, t: any) => s + Number(t.amount), 0);

    const weeklyExpenses = transactions
      .filter((t: any) => t.type === "expense" && t.date >= weekStartStr)
      .reduce((s: number, t: any) => s + Number(t.amount), 0);

    // Category breakdown this month
    const catSpend: Record<string, number> = {};
    transactions.filter((t: any) => t.type === "expense" && t.date >= monthStartStr).forEach((t: any) => {
      const cat = t.category || "other";
      catSpend[cat] = (catSpend[cat] || 0) + Number(t.amount);
    });

    const accountNetWorth = accounts.reduce((s: number, a: any) => {
      return s + (a.type === "credit_card" ? -Number(a.balance) : Number(a.balance));
    }, 0);
    const transactionCashFlow = balance; // income - expenses from transactions
    const unifiedBalance = accountNetWorth + transactionCashFlow;

    const goalsStr = goals.map((g: any) => `${g.name}: $${g.current_amount || 0}/$${g.target_amount}${g.deadline ? ` (deadline: ${g.deadline})` : ""}`).join("\n") || "None";
    const subsStr = subs.map((s: any) => `${s.name}: $${s.amount}/${s.frequency}`).join("\n") || "None";
    const budgetsStr = budgets.map((b: any) => `${b.category}: $${catSpend[b.category] || 0} spent of $${b.amount} budget`).join("\n") || "None set";
    const accountsStr = accounts.map((a: any) => `${a.name} (${a.type}): $${a.balance}`).join("\n") || "None tracked";
    const scheduledStr = scheduled.map((s: any) => `${s.merchant || "Unknown"}: $${s.amount} ${s.type} ${s.frequency}, next: ${s.next_date}`).join("\n") || "None";
    const catStr = Object.entries(catSpend).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, amt]) => `${cat}: $${(amt as number).toFixed(2)}`).join("\n");

    const financialContext = `
USER PROFILE:
- Name: ${profile?.display_name || "Unknown"}
- Monthly income: $${profile?.monthly_income || 0}
- Pay frequency: ${profile?.pay_frequency || "not set"}
- Next pay date: ${profile?.next_pay_date || "not set"}
- Saving goal: ${profile?.saving_goal || "not set"}
- Spending concerns: ${profile?.spending_concerns?.join(", ") || "none"}
${profile?.personal_context ? `- Personal context: ${profile.personal_context}` : ""}

CURRENT FINANCES:
- Net worth: $${latestNetWorth !== null ? Number(latestNetWorth).toFixed(2) : accountNetWorth.toFixed(2)} (THIS IS THE USER'S REAL WEALTH — use this for affordability questions)
- Account balances total: $${accountNetWorth.toFixed(2)} (sum of tracked bank/savings/investment accounts)
- Transaction cash flow: $${transactionCashFlow.toFixed(2)} (just a log of tracked income minus expenses, NOT their total wealth)
- This week's spending: $${weeklyExpenses.toFixed(2)}
- This month's spending: $${monthlyExpenses.toFixed(2)}

CATEGORY SPENDING THIS MONTH:
${catStr || "No spending yet"}

BUDGETS:
${budgetsStr}

SAVINGS GOALS:
${goalsStr}

ACTIVE SUBSCRIPTIONS:
${subsStr}

SCHEDULED TRANSACTIONS:
${scheduledStr}

ACCOUNTS:
${accountsStr}

RECENT TRANSACTIONS (last 20):
${transactions.slice(0, 20).map((t: any) => `${t.date} | ${t.type} | $${t.amount} | ${t.category || "-"} | ${t.merchant || t.description || "-"}`).join("\n")}
    `.trim();

    const systemPrompt = `You are a friendly, personal AI financial coach inside PocketTrack, a finance tracking app. You have access to the user's complete financial data below.

CRITICAL — How to assess affordability:
- The user's REAL financial position is their "Account net worth" — this is the total across all their bank accounts, savings, and investments. This is the most important number.
- "Transaction cash flow" is just a log of income/expenses tracked in the app — it does NOT represent their total wealth.
- When the user asks "can I afford X?", compare against their ACCOUNT NET WORTH, not their transaction cash flow. A user with $100k in accounts can obviously afford a $50 dinner even if their tracked transactions show net negative.
- If account net worth is $0 or not set, fall back to transaction cash flow.

Give specific, actionable advice based on their ACTUAL numbers — never generic advice. Be concise (2-4 paragraphs max). Use dollar amounts and category names from their data. Be encouraging but honest. If they're overspending relative to their income, tell them directly but kindly. Do NOT use markdown formatting like ** for bold — respond in plain text only.

${financialContext}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: conversationHistory.length > 0
            ? conversationHistory.map((m) => ({
                role: m.role === "model" ? "model" : "user",
                parts: [{ text: m.text }],
              }))
            : [{ role: "user", parts: [{ text: question }] }],
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
        JSON.stringify({ error: "Failed to get AI response" }),
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

    return new Response(JSON.stringify({ answer: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-coach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
