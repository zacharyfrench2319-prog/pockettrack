import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import CATEGORY_META from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format } from "date-fns";

interface SetBudgetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

type BudgetRow = { id?: string; category: string; amount: string };
type PeriodOption = "month" | "week" | "fortnight" | "custom";

const expenseCategories = Object.entries(CATEGORY_META).filter(([k]) => k !== "income");

function getPresetDates(period: PeriodOption): { start: string; end: string } {
  const now = new Date();
  if (period === "week") {
    const s = startOfWeek(now, { weekStartsOn: 1 });
    const e = endOfWeek(now, { weekStartsOn: 1 });
    return { start: format(s, "yyyy-MM-dd"), end: format(e, "yyyy-MM-dd") };
  }
  if (period === "fortnight") {
    const s = startOfWeek(now, { weekStartsOn: 1 });
    const e = addDays(s, 13);
    return { start: format(s, "yyyy-MM-dd"), end: format(e, "yyyy-MM-dd") };
  }
  // month (default)
  const s = startOfMonth(now);
  const e = endOfMonth(now);
  return { start: format(s, "yyyy-MM-dd"), end: format(e, "yyyy-MM-dd") };
}

const PERIOD_LABELS: { value: PeriodOption; label: string }[] = [
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
  { value: "fortnight", label: "Fortnight" },
  { value: "custom", label: "Custom" },
];

const SetBudgetSheet = ({ open, onOpenChange, onSaved }: SetBudgetSheetProps) => {
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodOption>("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    // Set default dates
    const dates = getPresetDates("month");
    setPeriod("month");
    setStartDate(dates.start);
    setEndDate(dates.end);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("budgets").select("*").eq("user_id", user.id);
      const existing = new Map((data || []).map((b: any) => [b.category, { id: b.id, amount: String(b.amount), start_date: b.start_date, end_date: b.end_date }]));

      // If existing budgets have dates, use those
      const first = data?.[0];
      if (first?.start_date && first?.end_date) {
        setStartDate(first.start_date);
        setEndDate(first.end_date);
        setPeriod("custom"); // show as custom since it's loaded from DB
      }

      setBudgets(
        expenseCategories.map(([key]) => ({
          category: key,
          id: existing.get(key)?.id,
          amount: existing.get(key)?.amount || "",
        }))
      );
    })();
  }, [open]);

  const handlePeriodChange = (p: PeriodOption) => {
    setPeriod(p);
    if (p !== "custom") {
      const dates = getPresetDates(p);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setLoading(false); return; }

    const toUpsert = budgets
      .filter((b) => b.amount && parseFloat(b.amount) > 0)
      .map((b) => ({
        user_id: user.id,
        category: b.category,
        amount: parseFloat(b.amount),
        period: period === "month" ? "monthly" : period === "week" ? "weekly" : period === "fortnight" ? "fortnightly" : "custom",
        start_date: startDate || null,
        end_date: endDate || null,
      }));

    const toDelete = budgets.filter((b) => b.id && (!b.amount || parseFloat(b.amount) <= 0)).map((b) => b.id!);

    if (toUpsert.length > 0) {
      const { error } = await supabase.from("budgets").upsert(toUpsert, { onConflict: "user_id,category" });
      if (error) { toast.error("Failed to save budgets"); setLoading(false); return; }
    }
    if (toDelete.length > 0) {
      await supabase.from("budgets").delete().in("id", toDelete);
    }

    toast.success("Budgets saved");
    setLoading(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-0 max-h-[90dvh] overflow-y-auto px-6 sm:px-8 pb-8">
        <SheetHeader className="pt-2 pb-4">
          <SheetTitle className="text-xl font-bold">Set Budgets</SheetTitle>
          <SheetDescription className="sr-only">Set spending limits per category</SheetDescription>
        </SheetHeader>

        {/* Period Selector */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {PERIOD_LABELS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handlePeriodChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                period === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        {period === "custom" && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Start</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 rounded-lg bg-muted px-3 text-[14px] text-foreground outline-none border-0"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground font-medium mb-1 block">End</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 rounded-lg bg-muted px-3 text-[14px] text-foreground outline-none border-0"
              />
            </div>
          </div>
        )}

        {/* Date summary for presets */}
        {period !== "custom" && startDate && endDate && (
          <p className="text-[12px] text-muted-foreground mb-4">
            {format(new Date(startDate + "T00:00:00"), "d MMM")} – {format(new Date(endDate + "T00:00:00"), "d MMM yyyy")}
          </p>
        )}

        <div className="space-y-3">
          {budgets.map((budget, i) => {
            const meta = CATEGORY_META[budget.category] || CATEGORY_META.other;
            return (
              <div key={budget.category} className="flex items-center gap-3">
                <span className="text-lg w-8 text-center">{meta.emoji}</span>
                <p className="text-[14px] font-medium text-foreground flex-1">{meta.label}</p>
                <div className="flex items-center gap-1 w-28">
                  <span className="text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={budget.amount}
                    onChange={(e) => {
                      const updated = [...budgets];
                      updated[i] = { ...updated[i], amount: e.target.value };
                      setBudgets(updated);
                    }}
                    className="w-full h-10 rounded-lg bg-muted px-2 text-[15px] text-foreground text-right outline-none border-0"
                  />
                </div>
              </div>
            );
          })}

          <Button onClick={handleSave} disabled={loading} className="w-full h-12 rounded-xl text-[15px] font-semibold mt-4">
            {loading ? "Saving..." : "Save Budgets"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SetBudgetSheet;
