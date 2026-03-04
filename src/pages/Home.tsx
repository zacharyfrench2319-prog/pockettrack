import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryMeta } from "@/lib/categories";
import { formatAUD, formatSmartDate } from "@/lib/formatters";
import SpendingChart from "@/components/SpendingChart";
import AddTransactionSheet from "@/components/AddTransactionSheet";
import GoalCard from "@/components/GoalCard";
import Logo from "@/components/Logo";
import { DashboardSkeleton } from "@/components/Skeletons";
import { Camera, Plus, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, startOfMonth, subDays, parseISO } from "date-fns";

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

type Profile = {
  display_name: string | null;
  monthly_income: number | null;
};

type SavingsGoal = {
  name: string;
  target_amount: number;
  current_amount: number | null;
  deadline: string | null;
  icon: string | null;
  created_at: string | null;
};

const Home = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<SavingsGoal | null | undefined>(undefined);
  const [subsTotal, setSubsTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, txRes, goalsRes, subsRes] = await Promise.all([
      supabase.from("profiles").select("display_name, monthly_income").eq("user_id", user.id).single(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(100),
      supabase.from("savings_goals").select("*").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1),
      supabase.from("subscriptions").select("amount, frequency").eq("user_id", user.id).eq("is_active", true),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (txRes.data) setTransactions(txRes.data);
    setPrimaryGoal(goalsRes.data && goalsRes.data.length > 0 ? goalsRes.data[0] : null);
    if (subsRes.data) {
      const total = subsRes.data.reduce((sum, s) => {
        if (s.frequency === "yearly") return sum + (s.amount as number) / 12;
        if (s.frequency === "weekly") return sum + (s.amount as number) * 4.33;
        return sum + (s.amount as number);
      }, 0);
      setSubsTotal(total);
    }
    setLoading(false);
  }, []);

  // Auto-sync bank transactions on load
  useEffect(() => {
    const autoSync = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("bank_connected").eq("user_id", user.id).single();
      if ((prof as any)?.bank_connected) {
        await supabase.functions.invoke("basiq-sync");
        loadData();
      }
    };
    autoSync();
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

  if (loading) return <DashboardSkeleton />;

  const hasData = transactions.length > 0;

  return (
    <div className="px-5 pt-12 pb-4 space-y-4">
      {/* Logo */}
      <div className="flex justify-center opacity-60">
        <Logo />
      </div>

      {/* Greeting */}
      <div className="space-y-1 animate-fade-in">
        <h1 className="text-[28px] font-bold text-foreground">
          Hey, {profile?.display_name || "there"} 👋
        </h1>
        <p className="text-[15px] text-muted-foreground">Here's your spending snapshot</p>
      </div>

      {!hasData ? (
        /* Empty State */
        <div className="rounded-2xl bg-card p-8 flex flex-col items-center text-center space-y-4 animate-fade-in" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Camera size={28} className="text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Start tracking your spending</h3>
            <p className="text-sm text-muted-foreground">Scan a receipt or add a transaction to get started</p>
          </div>
          <Button onClick={() => navigate("/scan")} className="rounded-xl h-11 px-6 text-[14px] font-semibold">
            Scan a Receipt
          </Button>
        </div>
      ) : (
        <>
          {/* Balance Card */}
          <div className="rounded-2xl bg-card p-5 space-y-3 animate-fade-in" style={{ boxShadow: "var(--card-shadow)" }}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Balance</p>
            <p className="text-[32px] font-bold text-foreground">{formatAUD(balance)}</p>
            <p className="text-sm">
              <span className="text-muted-foreground">This week: </span>
              <span className="text-destructive font-semibold">-{formatAUD(spendWeek)}</span>
            </p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Today", value: spendToday },
              { label: "This Week", value: spendWeek },
              { label: "This Month", value: spendMonth },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="rounded-2xl bg-card p-3.5 space-y-1 animate-fade-in"
                style={{ boxShadow: "var(--card-shadow)", animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
              >
                <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
                <p className="text-[17px] font-bold text-destructive">{formatAUD(stat.value, 0)}</p>
              </div>
            ))}
          </div>

          {/* Subscriptions stat */}
          {subsTotal > 0 && (
            <div
              onClick={() => navigate("/spending")}
              className="rounded-2xl bg-card p-3.5 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform animate-fade-in"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🔄</span>
                <p className="text-[13px] text-muted-foreground font-medium">Subscriptions</p>
              </div>
              <p className="text-[15px] font-bold text-foreground">{formatAUD(subsTotal)}/mo</p>
            </div>
          )}

          {/* Spending Chart */}
          <div className="animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
            <SpendingChart dailyData={dailyChartData} weeklyData={weeklyChartData} />
          </div>

          {/* Savings Goal */}
          {primaryGoal !== undefined && (
            <div className="space-y-2 animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
              <h2 className="text-lg font-semibold text-foreground">Savings Goal</h2>
              <GoalCard goal={primaryGoal} />
            </div>
          )}

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
                    className={`flex items-center gap-3 px-4 py-3 animate-fade-in ${
                      i < recentTx.length - 1 ? "border-b border-border/50" : ""
                    }`}
                    style={{ animationDelay: `${400 + i * 60}ms`, animationFillMode: "both" }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 relative"
                      style={{ backgroundColor: meta.color + "22" }}
                    >
                      {meta.emoji}
                      {tx.source === "bank" && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                          <Landmark size={9} className="text-primary" />
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-foreground truncate">
                        {tx.merchant || tx.description || meta.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {meta.label} · {formatSmartDate(tx.date)}
                      </p>
                    </div>
                    <p className={`text-[15px] font-semibold shrink-0 ${isIncome ? "text-success" : "text-destructive"}`}>
                      {isIncome ? "+" : "-"}{formatAUD(tx.amount)}
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
