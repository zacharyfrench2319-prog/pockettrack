import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryMeta } from "@/lib/categories";
import { differenceInDays, parseISO, format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import type { Subscription } from "@/pages/Spending";

interface SubscriptionsListProps {
  subscriptions: Subscription[];
  onRefresh: () => void;
}

const SubscriptionsList = ({ subscriptions, onRefresh }: SubscriptionsListProps) => {
  const [dismissing, setDismissing] = useState<string | null>(null);

  const activeSubs = subscriptions.filter((s) => s.is_active !== false);
  const totalMonthly = activeSubs.reduce((sum, s) => {
    if (s.frequency === "yearly") return sum + s.amount / 12;
    if (s.frequency === "quarterly") return sum + s.amount / 3;
    if (s.frequency === "weekly") return sum + s.amount * 4.33;
    if (s.frequency === "fortnightly") return sum + s.amount * 2.17;
    return sum + s.amount;
  }, 0);

  const handleDismiss = async (id: string) => {
    setDismissing(id);
    const { error } = await supabase.from("subscriptions").update({ is_active: false }).eq("id", id);
    setDismissing(null);
    if (error) { toast.error("Failed to dismiss"); return; }
    toast.success("Removed from subscriptions");
    onRefresh();
  };

  const getBadge = (sub: Subscription) => {
    if (sub.last_charged) {
      const daysSince = differenceInDays(new Date(), parseISO(sub.last_charged));
      if (daysSince > 60) return <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-500 px-1.5 py-0">Possibly cancelled?</Badge>;
    }
    if (sub.created_at) {
      const daysOld = differenceInDays(new Date(), parseISO(sub.created_at));
      if (daysOld <= 30) return <Badge variant="outline" className="text-[10px] border-primary/50 text-primary px-1.5 py-0">New</Badge>;
    }
    return null;
  };

  const freqLabel = (f: string | null) => {
    if (f === "weekly") return "Weekly";
    if (f === "fortnightly") return "Fortnightly";
    if (f === "quarterly") return "Quarterly";
    if (f === "yearly") return "Yearly";
    return "Monthly";
  };

  return (
    <div className="space-y-4">
      {/* Total Card */}
      <div className="rounded-2xl bg-card p-5 text-center space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monthly Subscriptions</p>
        <p className="text-[28px] font-bold text-foreground">
          ${totalMonthly.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-[15px] text-muted-foreground font-medium">/mo</span>
        </p>
        <p className="text-xs text-muted-foreground">{activeSubs.length} active subscription{activeSubs.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Auto-charge info */}
      <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 flex items-start gap-2.5">
        <RefreshCw size={14} className="text-primary mt-0.5 shrink-0" />
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Subscriptions are automatically logged as expenses on their charge date.
        </p>
      </div>

      {/* Subscription List */}
      {activeSubs.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No subscriptions detected yet. Add transactions to start detecting.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card overflow-hidden">
          {activeSubs.map((sub, i) => {
            const meta = getCategoryMeta(sub.category, "expense");
            const badge = getBadge(sub);

            return (
              <div
                key={sub.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < activeSubs.length - 1 ? "border-b border-border/40" : ""
                }`}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: meta.color + "22" }}
                >
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[14px] font-medium text-foreground truncate">{sub.name}</p>
                    {badge}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {freqLabel(sub.frequency)}
                    {sub.next_charge_date && (
                      <> · Next: {format(parseISO(sub.next_charge_date), "d MMM")}</>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">
                      ${sub.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    {sub.last_charged && (
                      <p className="text-[11px] text-muted-foreground">
                        Last: {parseISO(sub.last_charged).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDismiss(sub.id)}
                    disabled={dismissing === sub.id}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubscriptionsList;
