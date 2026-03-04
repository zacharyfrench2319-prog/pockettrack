import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Landmark, RefreshCw, Unlink, Lock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import UpgradeModal from "@/components/UpgradeModal";

interface Props {
  bankConnected: boolean;
  bankName: string | null;
  onStatusChange: () => void;
}

const ConnectedAccountsSection = ({ bankConnected, bankName, onStatusChange }: Props) => {
  const { isPro } = useSubscription();
  const [connectLoading, setConnectLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const handleConnect = async () => {
    if (!isPro) {
      setUpgradeOpen(true);
      return;
    }
    setConnectLoading(true);
    const { data, error } = await supabase.functions.invoke("basiq-connect");
    setConnectLoading(false);
    if (error || !data?.url) {
      toast.error(data?.error || "Failed to start bank connection");
      return;
    }
    window.open(data.url, "_blank");
    toast.info("Complete bank linking in the new tab, then tap Sync Now");
  };

  const handleSync = async () => {
    setSyncLoading(true);
    const { data, error } = await supabase.functions.invoke("basiq-sync");
    setSyncLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || "Sync failed");
      return;
    }
    toast.success(`Synced ${data?.imported || 0} new transactions`);
    onStatusChange();
  };

  const handleDisconnect = async () => {
    setDisconnectLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({
        bank_connected: false,
        bank_name: null,
        basiq_user_id: null,
      } as any).eq("user_id", user.id);
    }
    setDisconnectLoading(false);
    toast.success("Bank disconnected");
    onStatusChange();
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1">
        Connected Accounts
      </p>
      <div className="rounded-2xl bg-card overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
        {bankConnected ? (
          <>
            {/* Connected state */}
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Landmark size={20} className="text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-foreground">{bankName || "Bank"}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Connected</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncLoading}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors border-t border-border/40"
            >
              <RefreshCw size={18} className={`text-muted-foreground ${syncLoading ? "animate-spin" : ""}`} />
              <span className="flex-1 text-[15px] text-foreground text-left">
                {syncLoading ? "Syncing..." : "Sync Now"}
              </span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnectLoading}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors border-t border-border/40"
            >
              <Unlink size={18} className="text-muted-foreground" />
              <span className="flex-1 text-[15px] text-foreground text-left">
                {disconnectLoading ? "Disconnecting..." : "Disconnect"}
              </span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </>
        ) : (
          /* Not connected */
          <button
            onClick={handleConnect}
            disabled={connectLoading}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors"
          >
            <Landmark size={20} className="text-muted-foreground" />
            <span className="flex-1 text-[15px] text-foreground text-left">
              {connectLoading ? "Connecting..." : "Connect Bank Account"}
            </span>
            {!isPro && (
              <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Lock size={10} /> Pro
              </span>
            )}
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        )}
      </div>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="bank linking" />
    </div>
  );
};

export default ConnectedAccountsSection;
