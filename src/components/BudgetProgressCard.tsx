import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import CATEGORY_META from "@/lib/categories";
import { formatAUD } from "@/lib/formatters";
import SetBudgetSheet from "@/components/SetBudgetSheet";
import { startOfMonth, endOfMonth, parseISO, differenceInDays, format } from "date-fns";
import { Settings2 } from "lucide-react";

type Budget = { id: string; category: string; amount: number; start_date: string | null; end_date: string | null };
type Transaction = { amount: number; type: string; category: string | null; date: string };

interface BudgetProgressCardProps {
  transactions?: Transaction[];
}

const BudgetProgressCard = ({ transactions: externalTx }: BudgetProgressCardProps) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadBudgets = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("budgets").select("*").eq("user_id", user.id);
    if (data) setBudgets(data);
  }, []);

  const loadTransactions = useCallback(async () => {
    if (externalTx) { setTransactions(externalTx); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("transactions").select("amount, type, category, date").eq("user_id", user.id);
    if (data) setTransactions(data);
  }, [externalTx]);

  useEffect(() => { loadBudgets(); }, [loadBudgets]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // Get effective date range for a budget (fall back to current month)
  const getDateRange = useCallback((budget: Budget) => {
    if (budget.start_date && budget.end_date) {
      return {
        start: parseISO(budget.start_date),
        end: parseISO(budget.end_date),
      };
    }
    const now = new Date();
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }, []);

  // Use the first budget's date range for the header display
  const dateRange = useMemo(() => {
    if (budgets.length === 0) return null;
    return getDateRange(budgets[0]);
  }, [budgets, getDateRange]);

  const daysLeft = useMemo(() => {
    if (!dateRange) return 0;
    const today = new Date();
    const diff = differenceInDays(dateRange.end, today);
    return Math.max(0, diff);
  }, [dateRange]);

  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    // Use the first budget's date range (all budgets share the same period)
    if (budgets.length === 0) return map;
    const range = getDateRange(budgets[0]);
    transactions
      .filter((t) => {
        if (t.type !== "expense") return false;
        const d = parseISO(t.date);
        return d >= range.start && d <= range.end;
      })
      .forEach((t) => {
        const cat = t.category || "other";
        map[cat] = (map[cat] || 0) + t.amount;
      });
    return map;
  }, [transactions, budgets, getDateRange]);

  if (budgets.length === 0) return null;

  const items = budgets.map((b) => {
    const spent = spendByCategory[b.category] || 0;
    const rawPct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
    const pct = Math.min(rawPct, 100);
    const overspent = rawPct > 100;
    const meta = CATEGORY_META[b.category] || CATEGORY_META.other;
    return { ...b, spent, pct, rawPct, overspent, meta };
  }).sort((a, b) => b.rawPct - a.rawPct);

  return (
    <>
      <div className="space-y-2 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Budgets</h2>
            {dateRange && (
              <span className="text-[11px] text-muted-foreground">
                {format(dateRange.start, "d MMM")} – {format(dateRange.end, "d MMM")}
              </span>
            )}
            {daysLeft > 0 && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {daysLeft}d left
              </span>
            )}
          </div>
          <button onClick={() => setSheetOpen(true)} className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Settings2 size={15} className="text-primary" />
          </button>
        </div>

        <div className="rounded-2xl bg-card p-4 space-y-3">
          {items.map((item) => {
            const color = item.pct >= 80 ? "hsl(0, 84%, 60%)" : item.pct >= 60 ? "hsl(45, 93%, 55%)" : item.meta.color;
            return (
              <div key={item.category} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.meta.emoji}</span>
                    <span className="text-[13px] text-foreground">{item.meta.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.overspent && (
                      <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">OVER</span>
                    )}
                    <span className={`text-[12px] ${item.overspent ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                      {formatAUD(item.spent, 0)} / {formatAUD(item.amount, 0)}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${item.pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SetBudgetSheet open={sheetOpen} onOpenChange={setSheetOpen} onSaved={loadBudgets} />
    </>
  );
};

export default BudgetProgressCard;
