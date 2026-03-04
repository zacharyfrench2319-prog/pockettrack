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
    const { image_base64, user_id, user_reasoning } = await req.json();
    if (!image_base64 || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing image or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Get savings goals
    const { data: goals } = await supabase
      .from("savings_goals")
      .select("name, target_amount, current_amount")
      .eq("user_id", user_id);

    const goalsContext = (goals || [])
      .map((g: any) => `${g.name}: $${g.current_amount || 0}/$${g.target_amount}`)
      .join(", ");

    const monthlyIncome = profile?.monthly_income || 0;
    const savingFor = profile?.saving_goal || "not specified";
    const payFrequency = profile?.pay_frequency || "not specified";
    const nextPayDate = profile?.next_pay_date || "not specified";
    const spendingConcerns = profile?.spending_concerns?.join(", ") || "none specified";
    const personalContext = profile?.personal_context || "";

    let financialContext = `
Monthly income: $${monthlyIncome}
Current balance: $${balance.toFixed(2)}
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

    let reasoningSection = "";
    if (user_reasoning) {
      reasoningSection = `\n\nThe user provided this reason for wanting to buy it: "${user_reasoning}"\nFactor this into your advice. If they have a legitimate need, weigh that against their finances.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a smart financial advisor helping someone decide whether to buy something. Identify the product and its approximate price from the image. Consider their financial situation:

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

Be personal and direct. Reference their actual numbers. For example: "You've already spent $180 on food this week. This would push you over your budget." Not generic advice.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${image_base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to analyse product" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

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
