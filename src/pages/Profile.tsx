import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { LogOut, Moon, Sun, ChevronRight, Pencil, Download, CreditCard, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import ConnectedAccountsSection from "@/components/ConnectedAccountsSection";
import MemorySection from "@/components/MemorySection";

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isPro, refreshSubscription } = useSubscription();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [bankConnected, setBankConnected] = useState(false);
  const [bankName, setBankName] = useState<string | null>(null);

  // Memory fields
  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);
  const [payFrequency, setPayFrequency] = useState<string | null>(null);
  const [nextPayDate, setNextPayDate] = useState<string | null>(null);
  const [spendingConcerns, setSpendingConcerns] = useState<string[] | null>(null);
  const [personalContext, setPersonalContext] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setEmail(user.email || "");
    const { data } = await supabase
      .from("profiles")
      .select("display_name, bank_connected, bank_name, monthly_income, saving_goal, pay_frequency, next_pay_date, spending_concerns, personal_context")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setDisplayName((data as any).display_name || "");
      setBankConnected(!!(data as any).bank_connected);
      setBankName((data as any).bank_name || null);
      setMonthlyIncome((data as any).monthly_income);
      setPayFrequency((data as any).pay_frequency || null);
      setNextPayDate((data as any).next_pay_date || null);
      setSpendingConcerns((data as any).spending_concerns || null);
      setPersonalContext((data as any).personal_context || null);
      setSavingGoal((data as any).saving_goal || null);
    }
  }, []);

  useEffect(() => {
    const dark = document.documentElement.classList.contains("dark");
    setIsDark(dark);
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Welcome to PocketTrack Pro! 🎉");
      refreshSubscription();
    }
  }, [searchParams, refreshSubscription]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSaveName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ display_name: displayName }).eq("user_id", user.id);
    toast.success("Name updated");
    setEditingName(false);
  };

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    const { data, error } = await supabase.functions.invoke("create-checkout");
    setCheckoutLoading(false);
    if (error || !data?.url) { toast.error("Failed to start checkout"); return; }
    window.open(data.url, "_blank");
  };

  const handleManageSub = async () => {
    setPortalLoading(true);
    const { data, error } = await supabase.functions.invoke("customer-portal");
    setPortalLoading(false);
    if (error || !data?.url) { toast.error("Failed to open portal"); return; }
    window.open(data.url, "_blank");
  };

  const handleRedeem = async () => {
    if (redeemCode.trim() === "POCKETTRACK2026") {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("profiles").update({ subscription_status: "pro" }).eq("user_id", user.id);
      if (error) { toast.error("Failed to redeem code"); return; }
      setRedeemOpen(false);
      setRedeemCode("");
      await refreshSubscription();
      toast.success("Pro unlocked! 🎉");
    } else {
      toast.error("Invalid code");
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setExportLoading(false); return; }

    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (!transactions || transactions.length === 0) {
      toast.error("No transactions to export");
      setExportLoading(false);
      return;
    }

    const headers = ["Date", "Type", "Amount", "Category", "Merchant", "Description", "Source"];
    const rows = transactions.map((t) => [
      t.date, t.type, t.amount, t.category || "", t.merchant || "", t.description || "", t.source || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pockettrack-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
    toast.success("CSV downloaded!");
  };

  const handleDeleteAccount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await Promise.all([
      supabase.from("transactions").delete().eq("user_id", user.id),
      supabase.from("savings_goals").delete().eq("user_id", user.id),
      supabase.from("scans").delete().eq("user_id", user.id),
      supabase.from("subscriptions").delete().eq("user_id", user.id),
      supabase.from("profiles").delete().eq("user_id", user.id),
    ]);
    await supabase.auth.signOut();
    toast.success("Account deleted");
    navigate("/auth");
  };

  return (
    <div className="px-5 pt-14 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-foreground">Profile</h1>
        {isPro && (
          <div className="flex items-center gap-1.5 bg-primary/15 px-3 py-1 rounded-full">
            <Sparkles size={14} className="text-primary" />
            <span className="text-xs font-semibold text-primary">Pro Active</span>
          </div>
        )}
      </div>

      {/* User Card */}
      <div className="rounded-2xl bg-card p-5 flex items-center gap-4" style={{ boxShadow: "var(--card-shadow)" }}>
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-lg font-bold text-primary">
            {displayName ? displayName[0].toUpperCase() : email ? email[0].toUpperCase() : "?"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-8 rounded-lg bg-secondary border-0 text-sm" autoFocus />
              <Button size="sm" onClick={handleSaveName} className="h-8 rounded-lg text-xs">Save</Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-[15px] font-semibold text-foreground truncate">{displayName || email}</p>
              <button onClick={() => setEditingName(true)}>
                <Pencil size={12} className="text-muted-foreground" />
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
      </div>

      {/* Upgrade Card (free users only) */}
      {!isPro && (
        <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-5 space-y-3" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            <h3 className="text-[16px] font-bold text-foreground">Upgrade to PocketTrack Pro</h3>
          </div>
          <ul className="space-y-1.5">
            {["Unlimited AI scans", "Unlimited savings goals", "Subscription detector", "CSV data export"].map((b) => (
              <li key={b} className="flex items-center gap-2 text-[13px] text-foreground">
                <span className="text-primary">✓</span> {b}
              </li>
            ))}
          </ul>
          <Button onClick={handleUpgrade} disabled={checkoutLoading} className="w-full h-11 rounded-xl text-[14px] font-semibold">
            {checkoutLoading ? "Loading..." : "$9.99/mo AUD — Start Free Trial"}
          </Button>
        </div>
      )}

      {/* ACCOUNT section */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1">Account</p>
        <div className="rounded-2xl bg-card overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
          <button onClick={() => setEditingName(true)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
            <Pencil size={20} className="text-muted-foreground" />
            <span className="flex-1 text-[15px] text-foreground text-left">Edit Profile</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
          {isPro ? (
            <button onClick={handleManageSub} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors border-t border-border/40">
              <CreditCard size={20} className="text-muted-foreground" />
              <span className="flex-1 text-[15px] text-foreground text-left">Manage Subscription</span>
              <span className="text-xs text-primary font-medium">Pro</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          ) : (
            <button onClick={handleUpgrade} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors border-t border-border/40">
              <CreditCard size={20} className="text-muted-foreground" />
              <span className="flex-1 text-[15px] text-foreground text-left">Upgrade to Pro</span>
              <span className="text-xs text-muted-foreground">Free</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* MEMORY section */}
      <MemorySection
        monthlyIncome={monthlyIncome}
        payFrequency={payFrequency}
        nextPayDate={nextPayDate}
        spendingConcerns={spendingConcerns}
        personalContext={personalContext}
        savingGoal={savingGoal}
        onUpdated={loadProfile}
      />

      {/* CONNECTED ACCOUNTS section */}
      <ConnectedAccountsSection
        bankConnected={bankConnected}
        bankName={bankName}
        onStatusChange={() => loadProfile()}
      />

      {/* PREFERENCES section */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1">Preferences</p>
        <div className="rounded-2xl bg-card overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
          <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
            {isDark ? <Sun size={20} className="text-muted-foreground" /> : <Moon size={20} className="text-muted-foreground" />}
            <span className="flex-1 text-[15px] text-foreground text-left">{isDark ? "Light Mode" : "Dark Mode"}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
          <button onClick={handleExport} disabled={exportLoading} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors border-t border-border/40">
            <Download size={20} className="text-muted-foreground" />
            <span className="flex-1 text-[15px] text-foreground text-left">Export Data (CSV)</span>
            {!isPro && <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">Pro</span>}
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1">Danger Zone</p>
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full h-12 rounded-2xl text-destructive hover:text-destructive hover:bg-destructive/10 text-[15px] font-medium gap-2"
          >
            <LogOut size={18} /> Sign Out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full h-12 rounded-2xl text-destructive/60 hover:text-destructive hover:bg-destructive/10 text-[13px] font-medium gap-2">
                <Trash2 size={16} /> Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete all your data. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Redeem Code */}
      {!isPro && (
        <div className="flex justify-center pt-2">
          {!redeemOpen ? (
            <button onClick={() => setRedeemOpen(true)} className="text-[12px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              Redeem Code
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                className="h-8 w-40 rounded-lg bg-secondary border-0 text-xs text-center"
                onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              />
              <Button size="sm" variant="ghost" onClick={handleRedeem} className="h-8 text-xs">Apply</Button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center pt-2 pb-4">
        <Logo />
      </div>
    </div>
  );
};

export default Profile;
