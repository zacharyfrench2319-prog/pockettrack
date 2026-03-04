import { BarChart3 } from "lucide-react";

const Spending = () => {
  const categories = [
    { name: "Groceries", amount: 342.80, percent: 35, emoji: "🛒" },
    { name: "Transport", amount: 198.40, percent: 20, emoji: "⛽" },
    { name: "Dining", amount: 156.20, percent: 16, emoji: "🍽️" },
    { name: "Entertainment", amount: 89.99, percent: 9, emoji: "🎬" },
    { name: "Utilities", amount: 210.00, percent: 20, emoji: "💡" },
  ];

  return (
    <div className="px-5 pt-14 pb-4 space-y-4">
      <h1 className="text-[28px] font-bold text-foreground">Spending</h1>

      {/* Monthly Overview */}
      <div className="rounded-2xl bg-card p-5 space-y-3" style={{ boxShadow: "var(--card-shadow)" }}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">March 2026</p>
          <BarChart3 size={16} className="text-muted-foreground" />
        </div>
        <p className="text-[32px] font-bold text-foreground">$997.39</p>
        <p className="text-sm text-muted-foreground">spent this month</p>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">By Category</h2>
        {categories.map((cat, i) => (
          <div key={i} className="rounded-2xl bg-card p-4 space-y-2" style={{ boxShadow: "var(--card-shadow)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat.emoji}</span>
                <p className="text-[15px] font-medium text-foreground">{cat.name}</p>
              </div>
              <p className="text-[15px] font-semibold text-foreground">${cat.amount.toFixed(2)}</p>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${cat.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Spending;
