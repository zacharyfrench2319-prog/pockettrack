import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryMeta } from "@/lib/categories";
import { formatAUD } from "@/lib/formatters";
import AddScheduledSheet from "@/components/AddScheduledSheet";
import { format, parseISO, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { Plus, Pause, Play } from "lucide-react";
import { toast } from "sonner";

type ScheduledTx = {
  id: string;
  amount: number;
  type: string;
  category: string | null;
  description: string | null;
  merchant: string | null;
  frequency: string;
  next_date: string;
  is_active: boolean | null;
};

const advanceDate = (dateStr: string, frequency: string): string => {
  const d = parseISO(dateStr);
  switch (frequency) {
    case "weekly": return format(addWeeks(d, 1), "yyyy-MM-dd");
    case "fortnightly": return format(addDays(d, 14), "yyyy-MM-dd");
    case "monthly": return format(addMonths(d, 1), "yyyy-MM-dd");
    case "yearly": return format(addYears(d, 1), "yyyy-MM-dd");
    default: return format(addMonths(d, 1), "yyyy-MM-dd");
  }
};

const ScheduledTransactionsList = () => {
  const [items, setItems] = useState<ScheduledTx[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editItem, setEditItem] = useState<ScheduledTx | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("scheduled_transactions").select("*").eq("user_id", user.id).order("next_date", { ascending: true });
    if (data) {
      setItems(data);
      // Auto-create due transactions (catches up on all missed dates)
      const today = format(new Date(), "yyyy-MM-dd");
      let didProcess = false;
      for (const item of data) {
        if (item.is_active !== false && item.next_date <= today) {
          let nextDate = item.next_date;
          // Loop to catch up on multiple missed periods
          while (nextDate <= today) {
            // Guard against duplicates: check if this exact transaction already exists
            const { data: existing } = await supabase.from("transactions")
              .select("id")
              .eq("user_id", user.id)
              .eq("date", nextDate)
              .eq("amount", item.amount)
              .eq("source", "scheduled")
              .eq("merchant", item.merchant || "")
              .limit(1);

            if (!existing || existing.length === 0) {
              const { error: insertErr } = await supabase.from("transactions").insert({
                user_id: user.id,
                amount: item.amount,
                type: item.type,
                category: item.category,
                description: item.description,
                merchant: item.merchant,
                date: nextDate,
                source: "scheduled",
              });
              if (insertErr) { console.error("Failed to create scheduled tx:", insertErr); break; }
            }
            nextDate = advanceDate(nextDate, item.frequency);
          }
          const { error: updateErr } = await supabase.from("scheduled_transactions")
            .update({ next_date: nextDate })
            .eq("id", item.id);
          if (updateErr) console.error("Failed to advance next_date:", updateErr);
          didProcess = true;
        }
      }
      if (didProcess) {
        const { data: refreshed } = await supabase.from("scheduled_transactions").select("*").eq("user_id", user.id).order("next_date", { ascending: true });
        if (refreshed) setItems(refreshed);
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (item: ScheduledTx) => {
    const { error } = await supabase.from("scheduled_transactions").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) { toast.error("Failed to update"); return; }
    load();
  };

  if (items.length === 0) {
    return (
      <>
        <div className="rounded-2xl bg-card p-8 flex flex-col items-center text-center space-y-4 animate-fade-in">
          <div className="text-5xl">📅</div>
          <h3 className="text-lg font-semibold text-foreground">No scheduled transactions</h3>
          <p className="text-sm text-muted-foreground">Set up recurring income or expenses to track automatically</p>
          <button onClick={() => { setEditItem(null); setSheetOpen(true); }} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold">
            <Plus size={16} className="inline mr-1" /> Add Scheduled
          </button>
        </div>
        <AddScheduledSheet open={sheetOpen} onOpenChange={setSheetOpen} onSaved={load} editItem={editItem} />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-end">
          <button onClick={() => { setEditItem(null); setSheetOpen(true); }} className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Plus size={20} className="text-primary-foreground" />
          </button>
        </div>

        <div className="rounded-2xl bg-card overflow-hidden">
          {items.map((item, i) => {
            const meta = getCategoryMeta(item.category, item.type);
            const isIncome = item.type === "income";
            const inactive = !item.is_active;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 ${inactive ? "opacity-50" : ""} ${i < items.length - 1 ? "border-b border-border/40" : ""}`}
              >
                <button
                  onClick={() => toggleActive(item)}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-muted shrink-0"
                >
                  {inactive ? <Play size={12} className="text-muted-foreground" /> : <Pause size={12} className="text-muted-foreground" />}
                </button>
                <button
                  onClick={() => { setEditItem(item); setSheetOpen(true); }}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: meta.color + "22" }}>
                    {meta.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-foreground truncate">{item.merchant || item.description || meta.label}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{item.frequency} · Next: {format(parseISO(item.next_date), "d MMM")}</p>
                  </div>
                  <p className={`text-[15px] font-semibold shrink-0 ${isIncome ? "text-success" : "text-destructive"}`}>
                    {isIncome ? "+" : "-"}{formatAUD(item.amount)}
                  </p>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <AddScheduledSheet open={sheetOpen} onOpenChange={setSheetOpen} onSaved={load} editItem={editItem} />
    </>
  );
};

export default ScheduledTransactionsList;
