import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryMeta } from "@/lib/categories";
import SpendingChart from "@/components/SpendingChart";
import AddTransactionSheet from "@/components/AddTransactionSheet";
import Logo from "@/components/Logo";
import { Camera, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, startOfMonth, subDays, isToday, parseISO } from "date-fns";

type Transaction = {
  id: string;
  amount: number;
  type: string;
  category: string | null;
  date: string;
  description: string | null;
  merchant: string | null;
};

type Profile = {
  display_name: string | null;
  monthly_income: number | null;
};

const Home = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, txRes] = await Promise.all([
      supabase.from("profiles").select("display_name, monthly_income").eq("user_id", user.id).single(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(100),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (txRes.data) setTransactions(txRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const totalIncome = useMemo(() =>
    transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );

  const totalExpenses = useMemo(() =>
    transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );

  const balance = totalIncome - totalExpenses;

  const spendToday = useMemo(() =>
    transactions.filter((t) => t.type === "expense" && t.date === todayStr).reduce((s, t) => s + t.amount, 0),
    [transactions, todayStr]
  );

  const spendWeek = useMemo(() =>
    transactions.filter((t) => {
      if (t.type !== "expense") return false;
      const d = parseISO(t.date);
      return d >= weekStart && d <= endOfWeek(now, { weekStartsOn: 1 });
    }).reduce((s, t) => s + t.amount, 0),
    [transactions, weekStart]
  );

  const spendMonth = useMemo(() =>
    transactions.filter((t) => {
      if (t.type !== "expense") return false;
      return parseISO(t.date) >= monthStart;
    }).reduce((s, t) => s + t.amount, 0),
    [transactions, monthStart]
  );

  // Daily chart data for current week
  const dailyChartData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((label, i) => {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      const dayStr = format(day, "yyyy-MM-dd");
      const amount = transactions
        .filter((t) => t.type === "expense" && t.date === dayStr)
        .reduce((s, t) => s + t.amount, 0);
      return { label, amount };
    });
  }, [transactions, weekStart]);

  // Weekly chart data for last 4 weeks
  const weeklyChartData = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => {
      const ws = subDays(weekStart, (3 - i) * 7);
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const amount = transactions
        .filter((t) => {
          if (t.type !== "expense") return false;
          const d = parseISO(t.date);
          return d >= ws && d <= we;
        })
        .reduce((s, t) => s + t.amount, 0);
      return { label: `W${i + 1}`, amount };
    });
  }, [transactions, weekStart]);

  const recentTx = transactions.slice(0, 5);
  const greeting = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasData = transactions.length > 0;

  return (
    <div className="px-5 pt-12 pb-4 space-y-4">
      {/* Logo */}
      <div className="flex justify-center opacity-60">
        <Logo />
      </div>

      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-[28px] font-bold text-foreground">
          Hey, {profile?.display_name || "there"} 👋
        </h1>
        <p className="text-[15px] text-muted-foreground">Here's your spending snapshot</p>
      </div>

      {!hasData ? (
        /* Empty State */
        <div className="rounded-2xl bg-card p-8 flex flex-col items-center text-center space-y-4" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Camera size={28} className="text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">No transactions yet</h3>
            <p className="text-sm text-muted-foreground">Start tracking by scanning a receipt or adding a transaction</p>
          </div>
          <Button onClick={() => navigate("/scan")} className="rounded-xl h-11 px-6 text-[14px] font-semibold">
            Scan a Receipt
          </Button>
        </div>
      ) : (
        <>
          {/* Balance Card */}
          <div className="rounded-2xl bg-card p-5 space-y-3" style={{ boxShadow: "var(--card-shadow)" }}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Balance</p>
            <p className="text-[32px] font-bold text-foreground">
              ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">This week: </span>
              <span className="text-destructive font-semibold">
                -${spendWeek.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Today", value: spendToday },
              { label: "This Week", value: spendWeek },
              { label: "This Month", value: spendMonth },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-card p-3.5 space-y-1" style={{ boxShadow: "var(--card-shadow)" }}>
                <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
                <p className="text-[17px] font-bold text-destructive">
                  ${stat.value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>

          {/* Spending Chart */}
          <SpendingChart dailyData={dailyChartData} weeklyData={weeklyChartData} />

          {/* Recent Transactions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Recent</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAddOpen(true)}
                  className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center"
                >
                  <Plus size={16} className="text-primary" />
                </button>
                <button
                  onClick={() => navigate("/spending")}
                  className="text-sm text-primary font-medium"
                >
                  See All
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-card overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
              {recentTx.map((tx, i) => {
                const meta = getCategoryMeta(tx.category, tx.type);
                const isIncome = tx.type === "income";
                return (
                  <div
                    key={tx.id}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      i < recentTx.length - 1 ? "border-b border-border/50" : ""
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
                      style={{ backgroundColor: meta.color + "22" }}
                    >
                      {meta.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-foreground truncate">
                        {tx.merchant || tx.description || meta.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {meta.label} · {format(parseISO(tx.date), "MMM d")}
                      </p>
                    </div>
                    <p className={`text-[15px] font-semibold shrink-0 ${isIncome ? "text-success" : "text-destructive"}`}>
                      {isIncome ? "+" : "-"}${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <AddTransactionSheet open={addOpen} onOpenChange={setAddOpen} onSaved={loadData} />
    </div>
  );
};

export default Home;
