import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

const Home = () => {
  const [greeting, setGreeting] = useState("Good morning");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 17) setGreeting("Good evening");
    else if (hour >= 12) setGreeting("Good afternoon");

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setDisplayName(user.email?.split("@")[0] || "");
      }
    });
  }, []);

  return (
    <div className="px-5 pt-14 pb-4 space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{greeting}</p>
        <h1 className="text-[28px] font-bold text-foreground">{displayName || "there"} 👋</h1>
      </div>

      {/* Balance Card */}
      <div className="rounded-2xl bg-card p-5 space-y-4" style={{ boxShadow: "var(--card-shadow)" }}>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Balance</p>
          <p className="text-[32px] font-bold text-foreground">$4,280.50</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
              <TrendingUp size={16} className="text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Income</p>
              <p className="text-sm font-semibold text-foreground">$6,200</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center">
              <TrendingDown size={16} className="text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expenses</p>
              <p className="text-sm font-semibold text-foreground">$1,919.50</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insight Card */}
      <div className="rounded-2xl bg-primary/10 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-primary" />
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">AI Insight</p>
        </div>
        <p className="text-sm text-foreground leading-relaxed">
          You're spending 18% less on dining this month. Keep it up and you'll save an extra $120! 🎉
        </p>
      </div>

      {/* Recent Transactions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recent Transactions</h2>
        {[
          { name: "Grocery Store", amount: -82.40, category: "🛒 Groceries", time: "Today" },
          { name: "Salary Deposit", amount: 3100.00, category: "💼 Income", time: "Yesterday" },
          { name: "Netflix", amount: -15.99, category: "🎬 Entertainment", time: "Mar 1" },
          { name: "Gas Station", amount: -45.20, category: "⛽ Transport", time: "Mar 1" },
        ].map((tx, i) => (
          <div key={i} className="rounded-2xl bg-card p-4 flex items-center justify-between" style={{ boxShadow: "var(--card-shadow)" }}>
            <div className="space-y-0.5">
              <p className="text-[15px] font-medium text-foreground">{tx.name}</p>
              <p className="text-xs text-muted-foreground">{tx.category} · {tx.time}</p>
            </div>
            <p className={`text-[15px] font-semibold ${tx.amount > 0 ? "text-success" : "text-destructive"}`}>
              {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
