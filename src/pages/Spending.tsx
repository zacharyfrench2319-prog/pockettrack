import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { getCategoryMeta } from "@/lib/categories";
import CATEGORY_META from "@/lib/categories";
import { formatAUD, formatSmartDate } from "@/lib/formatters";
import AddTransactionSheet from "@/components/AddTransactionSheet";
import TransactionDetailSheet from "@/components/TransactionDetailSheet";
import AddSubscriptionSheet from "@/components/AddSubscriptionSheet";
import SubscriptionsList from "@/components/SubscriptionsList";
import BudgetProgressCard from "@/components/BudgetProgressCard";
import ScheduledTransactionsList from "@/components/ScheduledTransactionsList";
import SetBudgetSheet from "@/components/SetBudgetSheet";
import { TransactionListSkeleton } from "@/components/Skeletons";
import { Plus, Search, ChevronDown, ChevronUp, Landmark, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { format, parseISO, startOfMonth } from "date-fns";
import PullToRefresh from "@/components/PullToRefresh";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Button } from "@/components/ui/button";

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

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  category: string | null;
  frequency: string | null;
  is_active: boolean | null;
  last_charged: string | null;
  next_charge_date: string | null;
  created_at: string | null;
};

type FilterKey = "all" | "income" | "expense" | "subscriptions" | "scheduled";

const Spending = () => {
  const { isPro } = useSubscription();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);

  const loadTransactions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: txData, error } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false });
    if (error) {
      console.error("Failed to load transactions:", error);
      const { toast } = await import("sonner");
      toast.error("Failed to load transactions");
    }
    if (txData) setTransactions(txData);
    setLoading(false);
  }, []);

  const loadSubscriptions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).order("amount", { ascending: false });
    if (data) setSubscriptions(data);
  }, []);

  const detectSubscriptions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const expenses = transactions.filter((t) => t.type === "expense" && t.merchant);
    const groups: Record<string, Transaction[]> = {};
    expenses.forEach((t) => {
      const key = (t.merchant || "").toLowerCase().trim();
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    const existingNames = new Set(subscriptions.map((s) => s.name.toLowerCase().trim()));
    const newSubs: Array<{ name: string; amount: number; category: string | null; frequency: string; last_charged: string }> = [];

    for (const [, txs] of Object.entries(groups)) {
      if (txs.length < 2) continue;

      const amounts = txs.map((t) => t.amount);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const withinVariance = amounts.every((a) => Math.abs(a - avgAmount) / avgAmount <= 0.1);
      if (!withinVariance) continue;

      const dates = txs.map((t) => parseISO(t.date).getTime()).sort((a, b) => a - b);
      const intervals: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      }

      let frequency = "";
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval >= 25 && avgInterval <= 35) frequency = "monthly";
      else if (avgInterval >= 6 && avgInterval <= 8) frequency = "weekly";
      else if (avgInterval >= 350 && avgInterval <= 380) frequency = "yearly";
      else continue;

      const merchantName = txs[0].merchant || "";
      if (existingNames.has(merchantName.toLowerCase().trim())) continue;

      newSubs.push({
        name: merchantName,
        amount: Math.round(avgAmount * 100) / 100,
        category: txs[0].category,
        frequency,
        last_charged: txs.sort((a, b) => b.date.localeCompare(a.date))[0].date,
      });
    }

    if (newSubs.length > 0) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;
      const { error } = await supabase.from("subscriptions").insert(
        newSubs.map((s) => ({
          user_id: currentUser.id,
          name: s.name,
          amount: s.amount,
          category: s.category,
          frequency: s.frequency,
          last_charged: s.last_charged,
          is_active: true,
        }))
      );
      if (!error) loadSubscriptions();
    }
  }, [transactions, subscriptions, loadSubscriptions]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const handleRefresh = useCallback(async () => {
    await loadTransactions();
    await loadSubscriptions();
  }, [loadTransactions, loadSubscriptions]);

  const { pullDistance, refreshing } = usePullToRefresh({ onRefresh: handleRefresh });

  useEffect(() => {
    if (filter === "subscriptions") {
      loadSubscriptions();
    }
  }, [filter, loadSubscriptions]);

  useEffect(() => {
    if (filter === "subscriptions" && isPro && transactions.length > 0) {
      detectSubscriptions();
    }
  }, [filter, isPro, transactions.length, detectSubscriptions]);

  const filtered = useMemo(() => {
    let list = transactions;
    if (filter === "income") list = list.filter((t) => t.type === "income");
    if (filter === "expense") list = list.filter((t) => t.type === "expense");
    if (search.trim() && filter !== "subscriptions" && filter !== "scheduled") {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.merchant?.toLowerCase().includes(q)) ||
          (t.description?.toLowerCase().includes(q)) ||
          (t.category?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [transactions, filter, search]);

  const categoryBreakdown = useMemo(() => {
    const ms = startOfMonth(new Date());
    const monthExpenses = transactions.filter(
      (t) => t.type === "expense" && parseISO(t.date) >= ms
    );
    const total = monthExpenses.reduce((s, t) => s + t.amount, 0);
    const byCategory: Record<string, number> = {};
    monthExpenses.forEach((t) => {
      const cat = t.category || "other";
      byCategory[cat] = (byCategory[cat] || 0) + t.amount;
    });
    return Object.entries(byCategory)
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
        meta: CATEGORY_META[cat] || CATEGORY_META.other,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const monthlyData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const key = format(parseISO(t.date), "yyyy-MM");
        byMonth[key] = (byMonth[key] || 0) + t.amount;
      });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, amount]) => ({
        label: format(parseISO(key + "-01"), "MMM"),
        amount,
      }));
  }, [transactions]);

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "income", label: "Income" },
    { key: "expense", label: "Expenses" },
    { key: "subscriptions", label: "Subs" },
    { key: "scheduled", label: "Scheduled" },
  ];

  const isSubsTab = filter === "subscriptions";
  const isScheduledTab = filter === "scheduled";

  const handleAddClick = () => {
    if (isSubsTab) setAddSubOpen(true);
    else setAddOpen(true);
  };

  return (
    <div className="px-6 sm:px-8 pt-safe-top pb-4 space-y-4">
      <PullToRefresh pullDistance={pullDistance} refreshing={refreshing} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-foreground">Spending</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBudgetSheetOpen(true)}
            className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"
          >
            <Target size={18} className="text-primary" />
          </button>
          {!isScheduledTab && (
            <button
              onClick={handleAddClick}
              className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center"
            >
              <Plus size={20} className="text-primary-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {!isSubsTab && !isScheduledTab && (
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 rounded-xl bg-card pl-10 pr-4 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
           
          />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap ${
              filter === f.key
                ? "bg-primary/15 text-primary"
                : "bg-card text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Budget Progress */}
      {!isSubsTab && !isScheduledTab && (
        <BudgetProgressCard key={budgetRefreshKey} transactions={transactions} />
      )}

      {/* SCHEDULED TAB */}
      {isScheduledTab ? (
        <ScheduledTransactionsList />
      ) : isSubsTab ? (
        subscriptions.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 flex flex-col items-center text-center space-y-4 animate-fade-in">
            <div className="text-5xl">🔄</div>
            <h3 className="text-lg font-semibold text-foreground">No subscriptions detected yet</h3>
            <p className="text-sm text-muted-foreground">Add transactions to start — we'll automatically detect recurring charges</p>
          </div>
        ) : (
          <SubscriptionsList
            subscriptions={subscriptions}
            onRefresh={loadSubscriptions}
          />
        )
      ) : (
        <>
          {/* Transaction List */}
          {loading ? (
            <TransactionListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-card p-8 flex flex-col items-center text-center space-y-4 animate-fade-in">
              <div className="text-5xl">📝</div>
              <h3 className="text-lg font-semibold text-foreground">
                {search || filter !== "all" ? "No matching transactions" : "No transactions yet"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {search || filter !== "all" ? "Try a different search or filter" : "Tap + to add your first transaction"}
              </p>
              {!search && filter === "all" && (
                <Button onClick={() => setAddOpen(true)} className="rounded-xl h-11 px-6 text-[14px] font-semibold">
                  <Plus size={16} className="mr-1" /> Add Transaction
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-card overflow-hidden">
              {filtered.map((tx, i) => {
                const meta = getCategoryMeta(tx.category, tx.type);
                const isIncome = tx.type === "income";
                return (
                  <button
                    key={tx.id}
                    onClick={() => { setDetailTx(tx); setDetailOpen(true); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors animate-fade-in ${
                      i < filtered.length - 1 ? "border-b border-border/40" : ""
                    }`}
                    style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
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
                      <p className="text-[11px] text-muted-foreground">{meta.label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[15px] font-semibold ${isIncome ? "text-success" : "text-destructive"}`}>
                        {isIncome ? "+" : "-"}{formatAUD(tx.amount)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatSmartDate(tx.date)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="space-y-2 animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
              <button
                onClick={() => setBreakdownOpen(!breakdownOpen)}
                className="flex items-center justify-between w-full"
              >
                <h2 className="text-lg font-semibold text-foreground">Category Breakdown</h2>
                {breakdownOpen ? (
                  <ChevronUp size={18} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={18} className="text-muted-foreground" />
                )}
              </button>

              {breakdownOpen && (
                <div className="rounded-2xl bg-card p-4 space-y-3">
                  {categoryBreakdown.map((item) => (
                    <div key={item.category} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.meta.color }}
                          />
                          <span className="text-[13px] text-foreground">{item.meta.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground">
                            {formatAUD(item.amount, 0)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{item.percent}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${item.percent}%`, backgroundColor: item.meta.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Monthly Comparison */}
          {monthlyData.length > 1 && (
            <div className="space-y-3 animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
              <h2 className="text-lg font-semibold text-foreground">Monthly Comparison</h2>
              <div className="rounded-2xl bg-card p-5">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} barCategoryGap="20%">
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis hide />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={36}>
                        {monthlyData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill="url(#monthlyPurple)"
                          />
                        ))}
                      </Bar>
                      <defs>
                        <linearGradient id="monthlyPurple" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(263, 86%, 76%)" />
                          <stop offset="100%" stopColor="hsl(263, 86%, 56%)" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <AddTransactionSheet open={addOpen} onOpenChange={setAddOpen} onSaved={loadTransactions} />
      <TransactionDetailSheet transaction={detailTx} open={detailOpen} onOpenChange={setDetailOpen} onUpdated={loadTransactions} />
      <AddSubscriptionSheet open={addSubOpen} onOpenChange={setAddSubOpen} onSaved={loadSubscriptions} />
      <SetBudgetSheet open={budgetSheetOpen} onOpenChange={setBudgetSheetOpen} onSaved={() => setBudgetRefreshKey((k) => k + 1)} />
    </div>
  );
};

export default Spending;
