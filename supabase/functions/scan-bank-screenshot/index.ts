import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function categorize(merchant: string): string {
  const m = (merchant || "").toLowerCase();
  if (/coles|woolworths|woolies|aldi|iga|costco|foodworks/.test(m)) return "groceries";
  if (/uber\s?eats|menulog|doordash|mcdonald|kfc|hungry jack|domino|pizza|restaurant|cafe|coffee|starbucks|sushi|thai|chinese|indian|nando|grill|subway|burger/.test(m)) return "eating_out";
  if (/uber(?!\s?eat)|transperth|opal|myki|fuel|bp |shell |caltex|ampol|7-eleven fuel|parking|toll/.test(m)) return "transport";
  if (/netflix|spotify|stan|disney|youtube|cinema|hoyts|event cinemas|apple music|xbox|playstation|steam|twitch/.test(m)) return "entertainment";
  if (/amazon|ebay|kmart|target|big\s?w|jb hi|officeworks|bunnings|ikea|myer|david jones|asos|shein|zara|uniqlo|cotton on/.test(m)) return "shopping";
  if (/electric|energy|gas|water|internet|telstra|optus|vodafone|phone|insurance|agl|origin|nbn|rent/.test(m)) return "bills";
  if (/pharmacy|chemist|doctor|gp |medical|gym|fitness|dental|physio|hospital/.test(m)) return "health";
  if (/netflix|spotify|stan|disney|apple music|xbox|playstation|gym membership/.test(m)) return "subscriptions";
  return "other";
}

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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { image_base64 } = await req.json();
    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are reading a bank app screenshot. Extract ALL visible transactions and return JSON only:
{
  "transactions": [{
    "description": "string",
    "amount": number,
    "type": "income" | "expense",
    "date": "YYYY-MM-DD",
    "merchant": "string",
    "category": "one of: groceries, eating_out, transport, entertainment, shopping, bills, health, subscriptions, other"
  }]
}
Always return valid JSON. Amounts should be positive numbers; use "type" to indicate income vs expense.`,
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: image_base64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process bank screenshot" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let extracted;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Could not parse transaction data", raw: content }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const txs = Array.isArray(extracted.transactions) ? extracted.transactions : [];
    const normalised = txs.map((t: any) => {
      const amount = Math.abs(Number(t.amount) || 0);
      const type = t.type === "income" ? "income" : "expense";
      const merchant = t.merchant || t.description || "";
      const category = t.category || categorize(merchant);
      return {
        description: t.description || merchant,
        merchant,
        amount,
        type,
        date: t.date,
        category,
      };
    });

    return new Response(JSON.stringify({ transactions: normalised }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-bank-screenshot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
