import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

interface ChartData {
  label: string;
  amount: number;
}

interface SpendingChartProps {
  dailyData: ChartData[];
  weeklyData: ChartData[];
}

const SpendingChart = ({ dailyData, weeklyData }: SpendingChartProps) => {
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const data = view === "daily" ? dailyData : weeklyData;
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div className="rounded-2xl bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-foreground">Spending</h3>
        <div className="flex rounded-lg bg-muted p-0.5">
          <button
            onClick={() => setView("daily")}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
              view === "daily"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setView("weekly")}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
              view === "weekly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            Weekly
          </button>
        </div>
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
            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={32}>
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#purpleGradient)`}
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
