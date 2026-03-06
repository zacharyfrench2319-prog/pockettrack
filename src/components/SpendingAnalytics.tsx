import { useMemo } from "react";
import CATEGORY_META from "@/lib/categories";
import { formatAUD } from "@/lib/formatters";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import {
  format, parseISO, startOfMonth, subMonths,
  getDaysInMonth, differenceInDays,
} from "date-fns";

type Transaction = {
  id: string;
  amount: number;
  type: string;
  category: string | null;
  date: string;
  description: string | null;
  merchant: string | null;
  source: string | null;
};

const DONUT_COLORS = Object.values(CATEGORY_META).map((m) => m.color);

const SpendingAnalytics = ({ transactions }: { transactions: Transaction[] }) => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const dayOfMonth = now.getDate();
  const daysInMonth = getDaysInMonth(now);

  // --- Category Donut Data ---
  const { donutData, totalSpent } = useMemo(() => {
    const monthExpenses = transactions.filter(
      (t) => t.type === "expense" && parseISO(t.date) >= monthStart
    );
    const total = monthExpenses.reduce((s, t) => s + t.amount, 0);
    const byCategory: Record<string, number> = {};
    monthExpenses.forEach((t) => {
      const cat = t.category || "other";
      byCategory[cat] = (byCategory[cat] || 0) + t.amount;
    });
    const data = Object.entries(byCategory)
      .map(([cat, amount]) => ({
        name: cat,
        value: amount,
        meta: CATEGORY_META[cat] || CATEGORY_META.other,
      }))
      .sort((a, b) => b.value - a.value);
    return { donutData: data, totalSpent: total };
  }, [transactions, monthStart]);

  // --- Spending Trends ---
  const trends = useMemo(() => {
    const lastMonthStart = subMonths(monthStart, 1);
    const lastMonthEnd = monthStart;

    const thisMonthExpenses = transactions.filter(
      (t) => t.type === "expense" && parseISO(t.date) >= monthStart
    );
    const lastMonthExpenses = transactions.filter(
      (t) => t.type === "expense" && parseISO(t.date) >= lastMonthStart && parseISO(t.date) < lastMonthEnd
    );

    const thisTotal = thisMonthExpenses.reduce((s, t) => s + t.amount, 0);
    const lastTotal = lastMonthExpenses.reduce((s, t) => s + t.amount, 0);

    const dailyAvg = dayOfMonth > 0 ? thisTotal / dayOfMonth : 0;
    const projected = dailyAvg * daysInMonth;

    const lastDaysInMonth = getDaysInMonth(subMonths(now, 1));
    const lastDailyAvg = lastTotal / lastDaysInMonth;
    const changePercent = lastDailyAvg > 0
      ? Math.round(((dailyAvg - lastDailyAvg) / lastDailyAvg) * 100)
      : 0;

    // Savings rate
    const thisMonthIncome = transactions
      .filter((t) => t.type === "income" && parseISO(t.date) >= monthStart)
      .reduce((s, t) => s + t.amount, 0);
    const savingsRate = thisMonthIncome > 0
      ? Math.round(((thisMonthIncome - thisTotal) / thisMonthIncome) * 100)
      : null;

    return { dailyAvg, projected, changePercent, lastTotal, savingsRate };
  }, [transactions, monthStart, dayOfMonth, daysInMonth, now]);

  // --- Income vs Expenses (last 6 months) ---
  const incomeVsExpenses = useMemo(() => {
    const months: { key: string; label: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ms = subMonths(monthStart, i);
      const key = format(ms, "yyyy-MM");
      const label = format(ms, "MMM");
      const monthTxs = transactions.filter((t) => {
        const d = parseISO(t.date);
        return format(d, "yyyy-MM") === key;
      });
      const income = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expenses = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      months.push({ key, label, income, expenses });
    }
    return months;
  }, [transactions, monthStart]);

  const hasData = totalSpent > 0 || incomeVsExpenses.some((m) => m.income > 0 || m.expenses > 0);
  if (!hasData) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Category Donut Chart */}
      {donutData.length > 0 && (
        <div className="rounded-2xl bg-card p-5 space-y-3">
          <h3 className="text-[15px] font-semibold text-foreground">This Month by Category</h3>
          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.meta.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatAUD(value)}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] text-muted-foreground">Total</span>
                <span className="text-[17px] font-bold text-foreground">{formatAUD(totalSpent, 0)}</span>
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {donutData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 min-w-0">
                <span className="text-sm shrink-0">{item.meta.emoji}</span>
                <span className="text-[12px] text-muted-foreground truncate">{item.meta.label}</span>
                <span className="text-[12px] font-medium text-foreground ml-auto shrink-0">
                  {formatAUD(item.value, 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spending Trends */}
      {totalSpent > 0 && (
        <div className="rounded-2xl bg-card p-5 space-y-3">
          <h3 className="text-[15px] font-semibold text-foreground">Spending Trends</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-muted-foreground">Daily Average</p>
              <p className="text-[17px] font-bold text-foreground">{formatAUD(trends.dailyAvg, 0)}</p>
              {trends.changePercent !== 0 && (
                <p className={`text-[11px] font-medium ${trends.changePercent > 0 ? "text-destructive" : "text-success"}`}>
                  {trends.changePercent > 0 ? "↑" : "↓"} {Math.abs(trends.changePercent)}% vs last month
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Projected Total</p>
              <p className="text-[17px] font-bold text-foreground">{formatAUD(trends.projected, 0)}</p>
              {trends.lastTotal > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Last month: {formatAUD(trends.lastTotal, 0)}
                </p>
              )}
            </div>
            {trends.savingsRate !== null && (
              <div className="col-span-2">
                <p className="text-[11px] text-muted-foreground">Savings Rate</p>
                <p className={`text-[17px] font-bold ${trends.savingsRate >= 0 ? "text-success" : "text-destructive"}`}>
                  {trends.savingsRate}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Income vs Expenses */}
      {incomeVsExpenses.some((m) => m.income > 0 || m.expenses > 0) && (
        <div className="rounded-2xl bg-card p-5 space-y-3">
          <h3 className="text-[15px] font-semibold text-foreground">Income vs Expenses</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeVsExpenses} barGap={2} barCategoryGap="20%">
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatAUD(value, 0),
                    name === "income" ? "Income" : "Expenses",
                  ]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="income" radius={[4, 4, 0, 0]} maxBarSize={24} fill="hsl(142, 71%, 50%)" />
                <Bar dataKey="expenses" radius={[4, 4, 0, 0]} maxBarSize={24} fill="hsl(263, 86%, 66%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Net savings labels */}
          <div className="flex justify-between px-1">
            {incomeVsExpenses.map((m) => {
              const net = m.income - m.expenses;
              if (m.income === 0 && m.expenses === 0) return <div key={m.key} className="flex-1" />;
              return (
                <div key={m.key} className="flex-1 text-center">
                  <span className={`text-[10px] font-medium ${net >= 0 ? "text-success" : "text-destructive"}`}>
                    {net >= 0 ? "+" : ""}{formatAUD(net, 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpendingAnalytics;
