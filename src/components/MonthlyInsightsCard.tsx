import { useState, useMemo } from "react";
import { formatAUD } from "@/lib/formatters";
import CATEGORY_META from "@/lib/categories";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";
import { parseISO, startOfMonth, subMonths, getDaysInMonth, differenceInDays } from "date-fns";

type Transaction = {
  amount: number;
  type: string;
  category: string | null;
  date: string;
};

interface MonthlyInsightsCardProps {
  transactions: Transaction[];
}

const MonthlyInsightsCard = ({ transactions }: MonthlyInsightsCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const now = useMemo(() => new Date(), []);
  const thisMonthStart = useMemo(() => startOfMonth(now), [now]);
  const lastMonthStart = useMemo(() => subMonths(thisMonthStart, 1), [thisMonthStart]);

  const insights = useMemo(() => {
    const thisMonth = transactions.filter((t) => parseISO(t.date) >= thisMonthStart);
    const lastMonth = transactions.filter((t) => {
      const d = parseISO(t.date);
      return d >= lastMonthStart && d < thisMonthStart;
    });

    const income = thisMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = thisMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const netSavings = income - expenses;
    const savingsRate = income > 0 ? (netSavings / income) * 100 : 0;

    // Top 3 categories this month
    const byCat: Record<string, number> = {};
    thisMonth.filter((t) => t.type === "expense").forEach((t) => {
      const cat = t.category || "other";
      byCat[cat] = (byCat[cat] || 0) + t.amount;
    });
    const topCategories = Object.entries(byCat)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat, amount]) => ({ cat, amount, meta: CATEGORY_META[cat] || CATEGORY_META.other }));

    // vs last month comparison
    const lastByCat: Record<string, number> = {};
    lastMonth.filter((t) => t.type === "expense").forEach((t) => {
      const cat = t.category || "other";
      lastByCat[cat] = (lastByCat[cat] || 0) + t.amount;
    });
    const comparisons = topCategories.map((tc) => {
      const lastAmount = lastByCat[tc.cat] || 0;
      const diff = lastAmount > 0 ? ((tc.amount - lastAmount) / lastAmount) * 100 : 0;
      return { ...tc, diff };
    });

    // Projected end-of-month
    const daysPassed = Math.max(differenceInDays(now, thisMonthStart), 1);
    const daysInMonth = getDaysInMonth(now);
    const dailyRate = expenses / daysPassed;
    const projectedExpenses = dailyRate * daysInMonth;

    return { income, expenses, netSavings, savingsRate, comparisons, projectedExpenses, dailyRate };
  }, [transactions, thisMonthStart, lastMonthStart]);

  const summaryLine = insights.netSavings >= 0
    ? `Saving ${formatAUD(insights.netSavings)} this month`
    : `Overspending by ${formatAUD(Math.abs(insights.netSavings))} this month`;

  if (transactions.length === 0) return null;

  return (
    <div className="space-y-2 animate-fade-in">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full">
        <h2 className="text-lg font-semibold text-foreground">Monthly Insights</h2>
        {expanded ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
      </button>

      <div className="rounded-2xl bg-card p-4">
        {/* Summary line always visible */}
        <div className="flex items-center gap-2">
          {insights.netSavings >= 0
            ? <TrendingUp size={16} className="text-success" />
            : <TrendingDown size={16} className="text-destructive" />
          }
          <p className={`text-[14px] font-medium ${insights.netSavings >= 0 ? "text-success" : "text-destructive"}`}>
            {summaryLine}
          </p>
        </div>

        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Income vs Expenses */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted p-3 space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">Income</p>
                <p className="text-[17px] font-bold text-success">{formatAUD(insights.income, 0)}</p>
              </div>
              <div className="rounded-xl bg-muted p-3 space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">Expenses</p>
                <p className="text-[17px] font-bold text-destructive">{formatAUD(insights.expenses, 0)}</p>
              </div>
            </div>

            {/* Savings Rate */}
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground">Savings Rate</p>
              <p className={`text-[14px] font-semibold ${insights.savingsRate >= 0 ? "text-success" : "text-destructive"}`}>
                {insights.savingsRate.toFixed(1)}%
              </p>
            </div>

            {/* Top Categories with comparison */}
            {insights.comparisons.length > 0 && (
              <div className="space-y-2">
                <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wider">Top Spending</p>
                {insights.comparisons.map((c) => (
                  <div key={c.cat} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{c.meta.emoji}</span>
                      <span className="text-[13px] text-foreground">{c.meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-foreground">{formatAUD(c.amount, 0)}</span>
                      {c.diff !== 0 && (
                        <span className={`text-[11px] ${c.diff > 0 ? "text-destructive" : "text-success"}`}>
                          {c.diff > 0 ? "+" : ""}{c.diff.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Projected */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <p className="text-[13px] text-muted-foreground">Projected month-end spend</p>
              <p className="text-[14px] font-semibold text-foreground">{formatAUD(insights.projectedExpenses, 0)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyInsightsCard;
