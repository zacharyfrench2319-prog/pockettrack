import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { getCategoryMeta } from "@/lib/categories";
import CATEGORY_META from "@/lib/categories";
import AddTransactionSheet from "@/components/AddTransactionSheet";
import TransactionDetailSheet from "@/components/TransactionDetailSheet";
import AddSubscriptionSheet from "@/components/AddSubscriptionSheet";
import SubscriptionsList from "@/components/SubscriptionsList";
import { Plus, Search, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { format, parseISO, startOfMonth } from "date-fns";
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
  created_at: string | null;
};

type FilterKey = "all" | "income" | "expense" | "subscriptions";

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

  const loadTransactions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: txData } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false });
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

    // Group expenses by merchant (case-insensitive)
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

      // Check amount variance (within 10%)
      const amounts = txs.map((t) => t.amount);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const withinVariance = amounts.every((a) => Math.abs(a - avgAmount) / avgAmount <= 0.1);
      if (!withinVariance) continue;

      // Check regularity by sorting dates and checking intervals
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
      const { error } = await supabase.from("subscriptions").insert(
        newSubs.map((s) => ({
          user_id: user.id,
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

  // When subscriptions tab is selected, load + detect
  useEffect(() => {
    if (filter === "subscriptions" && isPro) {
      loadSubscriptions().then(() => {
        // Detect runs after subs are loaded
      });
    }
  }, [filter, isPro, loadSubscriptions]);

  // Run detection after subs load
  useEffect(() => {
    if (filter === "subscriptions" && isPro && transactions.length > 0) {
      detectSubscriptions();
    }
  }, [filter, isPro, transactions.length]); // intentionally not including detectSubscriptions to avoid loops

  const filtered = useMemo(() => {
    let list = transactions;
    if (filter === "income") list = list.filter((t) => t.type === "income");
    if (filter === "expense") list = list.filter((t) => t.type === "expense");
    if (search.trim() && filter !== "subscriptions") {
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
    const monthStart = startOfMonth(new Date());
    const monthExpenses = transactions.filter(
      (t) => t.type === "expense" && parseISO(t.date) >= monthStart
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

  const maxMonthly = Math.max(...monthlyData.map((d) => d.amount), 1);

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "income", label: "Income" },
    { key: "expense", label: "Expenses" },
    { key: "subscriptions", label: "Subs" },
  ];

  const isSubsTab = filter === "subscriptions";

  return (
    <div className="px-5 pt-14 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-foreground">Spending</h1>
        <button
          onClick={() => isSubsTab && isPro ? setAddSubOpen(true) : setAddOpen(true)}
          className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center"
        >
          <Plus size={20} className="text-primary-foreground" />
        </button>
      </div>

      {/* Search */}
      {!isSubsTab && (
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 rounded-xl bg-card pl-10 pr-4 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
            style={{ boxShadow: "var(--card-shadow)" }}
          />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
              filter === f.key
                ? "bg-primary/15 text-primary"
                : "bg-card text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* SUBSCRIPTIONS TAB */}
      {isSubsTab ? (
        !isPro ? (
          /* Pro Gate */
          <div className="rounded-2xl bg-card p-8 flex flex-col items-center text-center space-y-4" style={{ boxShadow: "var(--card-shadow)" }}>
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Lock size={28} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Subscription Detector</h3>
            <p className="text-sm text-muted-foreground">
              Automatically detect recurring charges and track your subscriptions. Upgrade to Pro to unlock this feature.
            </p>
            <Button className="rounded-xl h-11 px-6 text-[14px] font-semibold">
              Upgrade to Pro
            </Button>
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
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-center" style={{ boxShadow: "var(--card-shadow)" }}>
              <p className="text-sm text-muted-foreground">
                {search || filter !== "all" ? "No matching transactions" : "No transactions yet. Tap + to add one!"}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-card overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
              {filtered.map((tx, i) => {
                const meta = getCategoryMeta(tx.category, tx.type);
                const isIncome = tx.type === "income";
                return (
                  <button
                    key={tx.id}
                    onClick={() => { setDetailTx(tx); setDetailOpen(true); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors ${
                      i < filtered.length - 1 ? "border-b border-border/40" : ""
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
                      <p className="text-[11px] text-muted-foreground">{meta.label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[15px] font-semibold ${isIncome ? "text-success" : "text-destructive"}`}>
                        {isIncome ? "+" : "-"}${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{format(parseISO(tx.date), "MMM d")}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="space-y-2">
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
                <div className="rounded-2xl bg-card p-4 space-y-3" style={{ boxShadow: "var(--card-shadow)" }}>
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
                            ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}
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
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Monthly Comparison</h2>
              <div className="rounded-2xl bg-card p-5" style={{ boxShadow: "var(--card-shadow)" }}>
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
                            opacity={0.4 + (0.6 * entry.amount) / maxMonthly}
                          />
                        ))}
                      </Bar>
                      <defs>
                        <linearGradient id="monthlyPurple" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(263, 86%, 76%)" />
                          <stop offset="100%" stopColor="hsl(263, 70%, 55%)" />
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

      {/* Sheets */}
      <AddTransactionSheet open={addOpen} onOpenChange={setAddOpen} onSaved={loadTransactions} />
      <TransactionDetailSheet
        transaction={detailTx}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={loadTransactions}
      />
      <AddSubscriptionSheet open={addSubOpen} onOpenChange={setAddSubOpen} onSaved={loadSubscriptions} />
    </div>
  );
};

export default Spending;
