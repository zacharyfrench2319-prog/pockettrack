import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getCategoryMeta } from "@/lib/categories";
import CATEGORY_META from "@/lib/categories";
import { formatAUD, formatSmartDate } from "@/lib/formatters";
import SpendingChart from "@/components/SpendingChart";
import AddTransactionSheet from "@/components/AddTransactionSheet";
import GoalCard from "@/components/GoalCard";
import Logo from "@/components/Logo";
import AccountsCard from "@/components/AccountsCard";
import MonthlyInsightsCard from "@/components/MonthlyInsightsCard";
import AiCoachSheet from "@/components/AiCoachSheet";
import { DashboardSkeleton } from "@/components/Skeletons";
import SetBudgetSheet from "@/components/SetBudgetSheet";
import BudgetProgressCard from "@/components/BudgetProgressCard";
import PullToRefresh from "@/components/PullToRefresh";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useAutoChargeSubscriptions } from "@/hooks/useAutoChargeSubscriptions";
import { useTransactions, useSubscriptions, useProfile, useGoals, useBudgets, useScheduledTransactions, useInvalidateQueries } from "@/hooks/useSupabaseQueries";
import { Camera, Plus, Landmark, Sparkles, AlertTriangle, CalendarClock, Receipt, ShoppingBag, Wallet, BarChart3, Brain, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, startOfMonth, subMonths, subDays, parseISO } from "date-fns";

const Home = () => {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);

  const { data: profile } = useProfile();
  const { data: transactions = [], isLoading: txLoading, refetch: refetchTx } = useTransactions();
  const { data: goalsData = [], isLoading: goalsLoading, refetch: refetchGoals } = useGoals();
  const { data: subsData = [], refetch: refetchSubs } = useSubscriptions();
  const { data: budgets = [], refetch: refetchBudgets } = useBudgets();
  const { data: upcoming = [], refetch: refetchScheduled } = useScheduledTransactions();
  const invalidate = useInvalidateQueries();

  const loading = txLoading && transactions.length === 0;

  const primaryGoal = goalsData.length > 0
    ? goalsData.reduce((oldest, g) => {
        if (!oldest) return g;
        return (g.created_at || "") < (oldest.created_at || "") ? g : oldest;
      }, goalsData[0])
    : (goalsLoading ? undefined : null);

  const subsTotal = useMemo(() => {
    const activeSubs = subsData.filter((s: any) => s.is_active);
    return activeSubs.reduce((sum: number, s: any) => {
      if (s.frequency === "yearly") return sum + (s.amount as number) / 12;
      if (s.frequency === "weekly") return sum + (s.amount as number) * 4.33;
      return sum + (s.amount as number);
    }, 0);
  }, [subsData]);

  useAutoChargeSubscriptions();

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchTx(), refetchSubs(), refetchGoals(), refetchBudgets(), refetchScheduled()]);
  }, [refetchTx, refetchSubs, refetchGoals, refetchBudgets, refetchScheduled]);

  const { pullDistance, refreshing } = usePullToRefresh({ onRefresh: handleRefresh });

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

  const budgetAlerts = useMemo(() => {
    if (budgets.length === 0) return [];
    const catSpend: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense" && parseISO(t.date) >= monthStart)
      .forEach((t) => {
        const cat = t.category || "other";
        catSpend[cat] = (catSpend[cat] || 0) + t.amount;
      });
    return budgets
      .map((b) => {
        const spent = catSpend[b.category] || 0;
        const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        const meta = CATEGORY_META[b.category] || CATEGORY_META.other;
        return { ...b, spent, pct, meta };
      })
      .filter((b) => b.pct >= 80)
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, transactions, monthStart]);

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

  const monthlyChartData = useMemo(() => {
    const ms = startOfMonth(now);
    return Array.from({ length: 6 }, (_, i) => {
      const mStart = subMonths(ms, 5 - i);
      const key = format(mStart, "yyyy-MM");
      const label = format(mStart, "MMM");
      const amount = transactions
        .filter((t) => t.type === "expense" && format(parseISO(t.date), "yyyy-MM") === key)
        .reduce((s, t) => s + t.amount, 0);
      return { label, amount };
    });
  }, [transactions]);

  const recentTx = transactions.slice(0, 5);

  if (loading) return <DashboardSkeleton />;

  const hasData = transactions.length > 0;

  return (
    <div className="px-6 sm:px-8 pt-safe-top pb-4 space-y-4">
      <PullToRefresh pullDistance={pullDistance} refreshing={refreshing} />
      {/* Logo + Greeting */}
      <div className="space-y-1 animate-fade-in">
        <div className="mb-1">
          <Logo />
        </div>
        <h1 className="text-[28px] font-bold text-foreground">
          Hey, {profile?.display_name || "there"} 👋
        </h1>
        <p className="text-[15px] text-muted-foreground">Here's your spending snapshot</p>
      </div>

      {/* Unified Balance — always visible */}
      <AccountsCard transactionBalance={balance} weeklySpend={spendWeek} />

      {!hasData ? (
        /* Rich Empty State */
        <div className="space-y-4 animate-fade-in">
          {/* Welcome Hero */}
          <div className="rounded-2xl bg-card p-6 text-center space-y-2">
            <h3 className="text-xl font-bold text-foreground">Welcome to PocketTrack!</h3>
            <p className="text-sm text-muted-foreground">Track spending, scan receipts, and get AI-powered insights — all in one place.</p>
          </div>

          {/* 4 Action Cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Receipt, label: "Scan a Receipt", color: "bg-primary/15", iconColor: "text-primary", action: () => navigate("/scan") },
              { icon: Plus, label: "Add Transaction", color: "bg-emerald-500/15", iconColor: "text-emerald-500", action: () => setAddOpen(true) },
              { icon: ShoppingBag, label: "Check a Purchase", color: "bg-amber-500/15", iconColor: "text-amber-500", action: () => navigate("/scan") },
              { icon: Wallet, label: "Set a Budget", color: "bg-violet-500/15", iconColor: "text-violet-500", action: () => setBudgetSheetOpen(true) },
            ].map((card) => (
              <button
                key={card.label}
                onClick={card.action}
                className="rounded-2xl bg-card p-5 flex flex-col items-center gap-3 text-center active:scale-[0.97] transition-transform"

              >
                <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center`}>
                  <card.icon size={22} className={card.iconColor} />
                </div>
                <p className="text-[13px] font-semibold text-foreground">{card.label}</p>
              </button>
            ))}
          </div>

          {/* What you'll unlock */}
          <div className="space-y-2">
            <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wider">What you'll unlock</p>
            <div className="rounded-2xl bg-card p-4">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: BarChart3, label: "Spending Analytics" },
                  { icon: Brain, label: "AI Coach" },
                  { icon: Target, label: "Budget Tracking" },
                  { icon: TrendingUp, label: "Net Worth" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-1.5 opacity-50">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <item.icon size={16} className="text-muted-foreground" />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center leading-tight">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Budget Alerts */}
          {budgetAlerts.length > 0 && (
            <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-destructive" />
                <p className="text-[13px] font-semibold text-destructive">Budget Warning</p>
              </div>
              {budgetAlerts.map((a) => (
                <p key={a.category} className="text-[12px] text-foreground">
                  {a.meta.emoji} {a.meta.label}: {formatAUD(a.spent, 0)} of {formatAUD(a.amount, 0)} ({Math.round(a.pct)}%)
                </p>
              ))}
            </div>
          )}

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

            >
              <div className="flex items-center gap-2">
                <span className="text-base">🔄</span>
                <p className="text-[13px] text-muted-foreground font-medium">Subscriptions</p>
              </div>
              <p className="text-[15px] font-bold text-foreground">{formatAUD(subsTotal)}/mo</p>
            </div>
          )}

          {/* Upcoming Scheduled Transactions */}
          {upcoming.length > 0 && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center gap-2">
                <CalendarClock size={16} className="text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Upcoming</h2>
              </div>
              <div className="rounded-2xl bg-card overflow-hidden">
                {upcoming.map((item, i) => {
                  const meta = getCategoryMeta(item.category, item.type);
                  const isIncome = item.type === "income";
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-4 py-3 ${i < upcoming.length - 1 ? "border-b border-border/40" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: meta.color + "22" }}>
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-foreground truncate">{item.merchant || item.description || meta.label}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{item.frequency} · {format(parseISO(item.next_date), "d MMM")}</p>
                      </div>
                      <p className={`text-[15px] font-semibold shrink-0 ${isIncome ? "text-success" : "text-destructive"}`}>
                        {isIncome ? "+" : "-"}{formatAUD(item.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spending Chart */}
          <div className="animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
            <SpendingChart dailyData={dailyChartData} weeklyData={weeklyChartData} monthlyData={monthlyChartData} />
          </div>

          {/* Monthly Insights */}
          <MonthlyInsightsCard transactions={transactions} />

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

            <div className="rounded-2xl bg-card overflow-hidden">
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

          {/* Spacer for floating button */}
          <div className="h-14" />
        </>
      )}

      {/* AI Coach Floating Button */}
      {hasData && (
        <button
          onClick={() => setCoachOpen(true)}
          className="fixed right-5 w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <Sparkles size={22} className="text-primary-foreground" />
        </button>
      )}

      <AddTransactionSheet open={addOpen} onOpenChange={setAddOpen} onSaved={() => invalidate("transactions", "subscriptions")} />
      <AiCoachSheet open={coachOpen} onOpenChange={setCoachOpen} />
      <SetBudgetSheet open={budgetSheetOpen} onOpenChange={setBudgetSheetOpen} onSaved={() => invalidate("budgets")} />
    </div>
  );
};

export default Home;
