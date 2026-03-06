import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, addDays, addMonths, addYears } from "date-fns";

function advanceDate(dateStr: string, frequency: string): string {
  const d = parseISO(dateStr);
  switch (frequency) {
    case "weekly": return format(addDays(d, 7), "yyyy-MM-dd");
    case "fortnightly": return format(addDays(d, 14), "yyyy-MM-dd");
    case "quarterly": return format(addMonths(d, 3), "yyyy-MM-dd");
    case "yearly": return format(addYears(d, 1), "yyyy-MM-dd");
    default: return format(addMonths(d, 1), "yyyy-MM-dd");
  }
}

export function useAutoChargeSubscriptions() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = format(new Date(), "yyyy-MM-dd");

      // Find active subscriptions with next_charge_date <= today
      const { data: dueSubs } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .not("next_charge_date", "is", null)
        .lte("next_charge_date", today);

      if (!dueSubs || dueSubs.length === 0) return;

      for (const sub of dueSubs) {
        let chargeDate = sub.next_charge_date!;

        // Process all missed charge dates (in case the user hasn't opened the app for a while)
        while (chargeDate <= today) {
          // Deduplication: check if this charge was already logged
          const { data: existing } = await supabase
            .from("transactions")
            .select("id")
            .eq("user_id", user.id)
            .eq("source", "subscription")
            .eq("merchant", sub.name)
            .eq("date", chargeDate)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from("transactions").insert({
              user_id: user.id,
              amount: sub.amount,
              type: "expense",
              category: sub.category,
              merchant: sub.name,
              description: `${sub.name} (auto)`,
              date: chargeDate,
              source: "subscription",
            });
          }

          const nextDate = advanceDate(chargeDate, sub.frequency || "monthly");

          // Update subscription
          await supabase
            .from("subscriptions")
            .update({
              last_charged: chargeDate,
              next_charge_date: nextDate,
            })
            .eq("id", sub.id);

          chargeDate = nextDate;
        }
      }
    })();
  }, []);
}
