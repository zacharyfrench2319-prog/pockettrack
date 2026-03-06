import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { formatAUD } from "@/lib/formatters";

interface ChartData {
  label: string;
  amount: number;
}

interface SpendingChartProps {
  dailyData: ChartData[];
  weeklyData: ChartData[];
  monthlyData?: ChartData[];
}

const SpendingChart = ({ dailyData, weeklyData, monthlyData = [] }: SpendingChartProps) => {
  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");
  const data = view === "daily" ? dailyData : view === "weekly" ? weeklyData : monthlyData;
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  const total = useMemo(() => data.reduce((s, d) => s + d.amount, 0), [data]);
  const avg = useMemo(() => (data.length > 0 ? total / data.length : 0), [total, data]);
  const highestDay = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce((max, d) => (d.amount > max.amount ? d : max), data[0]);
  }, [data]);

  const views: Array<{ key: typeof view; label: string }> = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    ...(monthlyData.length > 0 ? [{ key: "monthly" as const, label: "Monthly" }] : []),
  ];

  return (
    <div className="rounded-2xl bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Spending</h3>
          <p className="text-[11px] text-muted-foreground">
            {view === "daily" ? "This week" : view === "weekly" ? "Last 4 weeks" : "Last 6 months"}
          </p>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                view === v.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex gap-4">
        <div>
          <p className="text-[11px] text-muted-foreground">Total</p>
          <p className="text-[15px] font-bold text-foreground">{formatAUD(total, 0)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Average</p>
          <p className="text-[15px] font-bold text-foreground">{formatAUD(avg, 0)}</p>
        </div>
        {highestDay && highestDay.amount > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground">Peak</p>
            <p className="text-[15px] font-bold text-destructive">
              {formatAUD(highestDay.amount, 0)}
              <span className="text-[10px] text-muted-foreground font-normal ml-1">{highestDay.label}</span>
            </p>
          </div>
        )}
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis hide />
            <Tooltip
              formatter={(value: number) => [formatAUD(value, 0), "Spent"]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                fontSize: "12px",
              }}
              cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
            />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={32}>
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill="url(#purpleGradient)"
                  opacity={0.3 + (0.7 * (data[index]?.amount || 0)) / maxAmount}
                />
              ))}
            </Bar>
            <defs>
              <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(263, 86%, 76%)" />
                <stop offset="100%" stopColor="hsl(263, 70%, 55%)" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SpendingChart;
