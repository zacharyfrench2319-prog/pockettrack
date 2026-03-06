import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatAUD } from "@/lib/formatters";
import AddAccountSheet from "@/components/AddAccountSheet";
import { Plus, TrendingUp, TrendingDown, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string | null;
};

type Snapshot = {
  total: number;
  snapshot_date: string;
};

interface AccountsCardProps {
  /** Transaction running balance (income - expenses). Merged into unified balance. */
  transactionBalance?: number;
  /** This week's spending from transactions, shown as activity indicator. */
  weeklySpend?: number;
}

const ACCOUNT_EMOJI: Record<string, string> = {
  checking: "🏦",
  savings: "💰",
  credit_card: "💳",
  investment: "📈",
  cash: "💵",
};

const AccountsCard = ({ transactionBalance = 0, weeklySpend = 0 }: AccountsCardProps) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadAccounts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("accounts").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    if (data) setAccounts(data);
  }, []);

  const loadSnapshots = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("net_worth_snapshots").select("total, snapshot_date").eq("user_id", user.id).order("snapshot_date", { ascending: true }).limit(90);
    if (data) setSnapshots(data);
  }, []);

  // Save daily snapshot when accounts change
  const saveSnapshot = useCallback(async (snapshotValue: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    await supabase.from("net_worth_snapshots").upsert({
      user_id: user.id,
      total: snapshotValue,
      snapshot_date: today,
    }, { onConflict: "user_id,snapshot_date" }).then(() => {}).catch(() => {});
  }, []);

  useEffect(() => { loadAccounts(); loadSnapshots(); }, [loadAccounts, loadSnapshots]);

  // Account-based net worth (assets minus credit card debt)
  const accountNetWorth = useMemo(() =>
    accounts.reduce((sum, a) => sum + (a.type === "credit_card" ? -a.balance : a.balance), 0),
    [accounts]
  );

  // Unified balance: accounts + transaction flow
  const hasAccounts = accounts.length > 0;
  const unifiedBalance = hasAccounts
    ? accountNetWorth + transactionBalance
    : transactionBalance;

  // Save snapshot of unified balance whenever it changes
  useEffect(() => {
    if (hasAccounts || transactionBalance !== 0) {
      saveSnapshot(unifiedBalance);
    }
  }, [hasAccounts, transactionBalance, unifiedBalance, saveSnapshot]);

  const chartData = useMemo(() =>
    snapshots.map((s) => ({
      date: format(parseISO(s.snapshot_date), "d MMM"),
      value: s.total,
    })),
    [snapshots]
  );

  const growthPct = useMemo(() => {
    if (snapshots.length < 2) return null;
    const first = snapshots[0].total;
    const last = snapshots[snapshots.length - 1].total;
    if (first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
  }, [snapshots]);

  const loadAiInsight = useCallback(async () => {
    if (aiInsight || aiLoading) return;
    setAiLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAiLoading(false); return; }

    try {
      const { data, error } = await supabase.functions.invoke("ai-coach", {
        body: {
          question: "Give me a brief 2-3 sentence personalized tip on how to grow my balance based on my spending habits, accounts, and goals. Be specific with numbers from my data. Focus on the single most impactful thing I can do right now.",
          user_id: user.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiInsight(data.answer || "");
    } catch {
      setAiInsight("");
    }
    setAiLoading(false);
  }, [aiInsight, aiLoading]);

  const handleAccountSaved = useCallback(async () => {
    await loadAccounts();
    loadSnapshots();
    setAiInsight(""); // Reset AI insight so it refreshes next time
  }, [loadAccounts, loadSnapshots]);

  // If no accounts AND no transaction data, show empty state prompt
  if (!hasAccounts && transactionBalance === 0) {
    return (
      <>
        <div
          onClick={() => setAddOpen(true)}
          className="rounded-2xl bg-card p-5 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform animate-fade-in"
         
        >
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Balance</p>
            <p className="text-sm text-muted-foreground">Add an account or transaction to start tracking</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Plus size={18} className="text-primary" />
          </div>
        </div>
        <AddAccountSheet open={addOpen} onOpenChange={setAddOpen} onSaved={handleAccountSaved} />
      </>
    );
  }

  return (
    <>
      <div className="space-y-2 animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Balance</h2>
          <button onClick={() => { setEditAccount(null); setAddOpen(true); }} className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Plus size={16} className="text-primary" />
          </button>
        </div>

        <div className="rounded-2xl bg-card p-5 space-y-4">
          {/* Unified Balance + Growth */}
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className={`text-[28px] font-bold ${unifiedBalance >= 0 ? "text-success" : "text-destructive"}`}>
                {unifiedBalance < 0 ? "-" : ""}{formatAUD(Math.abs(unifiedBalance))}
              </p>
              {weeklySpend > 0 && (
                <p className="text-[12px] text-muted-foreground">
                  This week: <span className="text-destructive font-medium">-{formatAUD(weeklySpend)}</span>
                </p>
              )}
            </div>
            {growthPct !== null && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${growthPct >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                {growthPct >= 0 ? <TrendingUp size={14} className="text-success" /> : <TrendingDown size={14} className="text-destructive" />}
                <span className={`text-[12px] font-semibold ${growthPct >= 0 ? "text-success" : "text-destructive"}`}>
                  {growthPct > 0 ? "+" : ""}{growthPct.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Breakdown: accounts vs transactions (only if both exist) */}
          {hasAccounts && transactionBalance !== 0 && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>Accounts: {formatAUD(accountNetWorth)}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>Cash flow: {transactionBalance >= 0 ? "+" : "-"}{formatAUD(Math.abs(transactionBalance))}</span>
            </div>
          )}

          {/* Line Chart */}
          {chartData.length >= 2 && (
            <div className="h-28 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <defs>
                    <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={unifiedBalance >= 0 ? "hsl(142, 71%, 50%)" : "hsl(0, 84%, 60%)"} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={unifiedBalance >= 0 ? "hsl(142, 71%, 50%)" : "hsl(0, 84%, 60%)"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide domain={["dataMin - 100", "dataMax + 100"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [formatAUD(value), "Balance"]}
                    labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "11px" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={unifiedBalance >= 0 ? "hsl(142, 71%, 50%)" : "hsl(0, 84%, 60%)"}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: unifiedBalance >= 0 ? "hsl(142, 71%, 50%)" : "hsl(0, 84%, 60%)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* AI Insight */}
          <div className="space-y-2">
            {!aiInsight && !aiLoading && (
              <button
                onClick={loadAiInsight}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary text-[13px] font-medium hover:bg-primary/15 transition-colors"
              >
                <Sparkles size={14} /> Get AI insight on your balance
              </button>
            )}
            {aiLoading && (
              <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-muted">
                <Loader2 size={14} className="text-primary animate-spin" />
                <p className="text-[12px] text-muted-foreground">Analyzing your finances...</p>
              </div>
            )}
            {aiInsight && !aiLoading && (
              <div className="rounded-xl bg-primary/5 border border-primary/10 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-[12px] text-foreground leading-relaxed">{aiInsight}</p>
                </div>
              </div>
            )}
          </div>

          {/* Accounts List (expandable) — only show if accounts exist */}
          {hasAccounts && (
            <>
              <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between pt-2 border-t border-border/40">
                <p className="text-[13px] text-muted-foreground font-medium">{accounts.length} account{accounts.length !== 1 ? "s" : ""}</p>
                {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </button>

              {expanded && (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => { setEditAccount(account); setAddOpen(true); }}
                      className="w-full flex items-center gap-3 py-2 text-left hover:bg-muted/30 rounded-lg transition-colors px-1"
                    >
                      <span className="text-lg">{ACCOUNT_EMOJI[account.type] || "🏦"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-foreground truncate">{account.name}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{account.type.replace("_", " ")}</p>
                      </div>
                      <p className={`text-[15px] font-semibold ${account.type === "credit_card" ? "text-destructive" : "text-foreground"}`}>
                        {account.type === "credit_card" ? "-" : ""}{formatAUD(account.balance)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AddAccountSheet open={addOpen} onOpenChange={setAddOpen} onSaved={handleAccountSaved} editAccount={editAccount} />
    </>
  );
};

export default AccountsCard;
