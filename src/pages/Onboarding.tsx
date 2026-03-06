import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TOTAL_STEPS = 5;

const CONCERN_OPTIONS = [
  "I spend too much on food",
  "I want to save more",
  "I lose track of subscriptions",
  "I impulse buy too much",
  "I don't know where my money goes",
  "I want to hit a savings goal",
];

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking", emoji: "🏦" },
  { value: "savings", label: "Savings", emoji: "💰" },
  { value: "credit_card", label: "Credit Card", emoji: "💳" },
  { value: "investment", label: "Investment", emoji: "📈" },
  { value: "cash", label: "Cash", emoji: "💵" },
];

type OnboardingAccount = {
  name: string;
  type: string;
  balance: string;
};

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0 = loading
  const [displayName, setDisplayName] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [payFrequency, setPayFrequency] = useState("");
  const [nextPayDate, setNextPayDate] = useState("");
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [otherConcern, setOtherConcern] = useState("");
  const [personalContext, setPersonalContext] = useState("");
  const [accounts, setAccounts] = useState<OnboardingAccount[]>([
    { name: "", type: "checking", balance: "" },
  ]);
  const [loading, setLoading] = useState(false);

  // Load existing progress on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if already completed
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.onboarding_completed) {
        navigate("/home");
        return;
      }

      // Restore saved progress
      if (profile) {
        if ((profile as any).display_name) setDisplayName((profile as any).display_name);
        if ((profile as any).monthly_income) setMonthlyIncome(String((profile as any).monthly_income));
        if ((profile as any).pay_frequency) setPayFrequency((profile as any).pay_frequency);
        if ((profile as any).next_pay_date) setNextPayDate((profile as any).next_pay_date);
        if ((profile as any).spending_concerns) {
          const concerns = (profile as any).spending_concerns as string[];
          const known = concerns.filter((c: string) => CONCERN_OPTIONS.includes(c));
          const other = concerns.find((c: string) => !CONCERN_OPTIONS.includes(c));
          setSelectedConcerns(known);
          if (other) setOtherConcern(other);
        }
        if ((profile as any).personal_context) setPersonalContext((profile as any).personal_context);
      }

      // Load saved accounts
      const { data: savedAccounts } = await supabase
        .from("accounts")
        .select("name, type, balance")
        .eq("user_id", user.id);

      if (savedAccounts && savedAccounts.length > 0) {
        setAccounts(savedAccounts.map((a) => ({
          name: a.name,
          type: a.type,
          balance: String(a.balance),
        })));
      }

      // Determine resume step
      if (profile) {
        const concerns = (profile as any).spending_concerns;
        if (concerns && concerns.length > 0) {
          setStep(5); // Concerns done, show personal context
        } else if (savedAccounts && savedAccounts.length > 0) {
          setStep(4); // Accounts done, show concerns
        } else if ((profile as any).monthly_income || (profile as any).pay_frequency) {
          setStep(3); // Income done, show accounts
        } else if ((profile as any).display_name) {
          setStep(2); // Name done, show income
        } else {
          setStep(1);
        }
      } else {
        setStep(1);
      }
    })();
  }, [navigate]);

  const toggleConcern = (c: string) => {
    setSelectedConcerns((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const addAccount = () => {
    setAccounts([...accounts, { name: "", type: "checking", balance: "" }]);
  };

  const removeAccount = (index: number) => {
    setAccounts(accounts.filter((_, i) => i !== index));
  };

  const updateAccount = (index: number, field: keyof OnboardingAccount, value: string) => {
    const updated = [...accounts];
    updated[index] = { ...updated[index], [field]: value };
    setAccounts(updated);
  };

  // Save partial profile data (called on each step transition)
  const saveProgress = async (data: Record<string, any>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .upsert({ user_id: user.id, ...data } as any, { onConflict: "user_id" });
  };

  const goToStep = async (nextStep: number, saveData?: Record<string, any>) => {
    if (saveData) await saveProgress(saveData);
    setStep(nextStep);
  };

  // Save accounts to Supabase (step 3 → 4)
  const saveAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const validAccounts = accounts.filter((a) => a.name.trim() && a.balance && parseFloat(a.balance) >= 0);
    if (validAccounts.length > 0) {
      // Clear existing onboarding accounts and re-insert
      await supabase.from("accounts").delete().eq("user_id", user.id);
      await supabase.from("accounts").insert(
        validAccounts.map((a) => ({
          user_id: user.id,
          name: a.name.trim(),
          type: a.type,
          balance: parseFloat(a.balance),
        }))
      );
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      navigate("/auth");
      return;
    }

    const concerns = [...selectedConcerns];
    if (otherConcern.trim()) concerns.push(otherConcern.trim());

    const profileData = {
      user_id: user.id,
      display_name: displayName || null,
      monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : null,
      pay_frequency: payFrequency || null,
      next_pay_date: nextPayDate || null,
      spending_concerns: concerns.length > 0 ? concerns : null,
      personal_context: personalContext || null,
      onboarding_completed: true,
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(profileData as any, { onConflict: "user_id" });

    if (error) {
      console.error("Profile save error:", error);
      toast.error("Failed to save profile: " + error.message);
      setLoading(false);
      return;
    }

    // Save accounts if not already saved
    await saveAccounts();

    // Save initial net worth snapshot
    const validAccounts = accounts.filter((a) => a.name.trim() && a.balance && parseFloat(a.balance) >= 0);
    if (validAccounts.length > 0) {
      const netWorth = validAccounts.reduce((sum, a) => {
        const bal = parseFloat(a.balance) || 0;
        return sum + (a.type === "credit_card" ? -bal : bal);
      }, 0);
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("net_worth_snapshots").upsert({
        user_id: user.id,
        total: netWorth,
        snapshot_date: today,
      } as any, { onConflict: "user_id,snapshot_date" }).then(() => {}).catch(() => {});
    }

    setLoading(false);
    navigate("/home");
  };

  // Show loading while determining step
  if (step === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Logo size="large" />
        </div>

        {/* Progress bar */}
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">Step {step} of {TOTAL_STEPS}</p>
          <div className="flex gap-2 justify-center">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`h-1 w-8 rounded-full transition-colors ${
                  step >= i + 1 ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">What's your name?</h2>
              <p className="text-sm text-muted-foreground">So we can personalise your experience.</p>
            </div>
            <Input
              type="text"
              placeholder="e.g. Sarah"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-12 rounded-xl bg-card border-0 text-[15px] placeholder:text-muted-foreground"
              autoFocus
            />
            <Button
              onClick={() => goToStep(2, { display_name: displayName || null })}
              className="w-full h-12 rounded-xl text-[15px] font-semibold"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 2: Income & Pay */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">What's your monthly income?</h2>
              <p className="text-sm text-muted-foreground">This helps us set smart budgets for you.</p>
            </div>
            <Input
              type="number"
              placeholder="e.g. 5000"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              className="h-12 rounded-xl bg-card border-0 text-[15px] placeholder:text-muted-foreground"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">When do you get paid?</label>
              <Select value={payFrequency} onValueChange={setPayFrequency}>
                <SelectTrigger className="h-12 rounded-xl bg-card border-0 text-[15px]">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {payFrequency && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Next pay day</label>
                <Input
                  type="date"
                  value={nextPayDate}
                  onChange={(e) => setNextPayDate(e.target.value)}
                  className="h-12 rounded-xl bg-card border-0 text-[15px]"
                />
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl text-[15px]">
                Back
              </Button>
              <Button
                onClick={() => goToStep(3, {
                  monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : null,
                  pay_frequency: payFrequency || null,
                  next_pay_date: nextPayDate || null,
                })}
                className="flex-1 h-12 rounded-xl text-[15px] font-semibold"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Accounts & Net Worth */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Your accounts</h2>
              <p className="text-sm text-muted-foreground">Add your bank accounts, cards, and savings to track your net worth.</p>
            </div>

            <div className="space-y-3">
              {accounts.map((acc, i) => (
                <div key={i} className="rounded-xl bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-muted-foreground">Account {i + 1}</p>
                    {accounts.length > 1 && (
                      <button onClick={() => removeAccount(i)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <Input
                    placeholder="Account name (e.g. CommBank Everyday)"
                    value={acc.name}
                    onChange={(e) => updateAccount(i, "name", e.target.value)}
                    className="h-11 rounded-lg bg-muted border-0 text-[14px] placeholder:text-muted-foreground"
                  />
                  <Select value={acc.type} onValueChange={(v) => updateAccount(i, "type", v)}>
                    <SelectTrigger className="h-11 rounded-lg bg-muted border-0 text-[14px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-[13px]">
                          <span className="flex items-center gap-2">
                            <span>{t.emoji}</span><span>{t.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder={acc.type === "credit_card" ? "Amount owed" : "Current balance"}
                      value={acc.balance}
                      onChange={(e) => updateAccount(i, "balance", e.target.value)}
                      className="h-11 rounded-lg bg-muted border-0 text-[14px] placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addAccount}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 text-primary text-[14px] font-medium hover:bg-primary/15 transition-colors"
            >
              <Plus size={16} /> Add another account
            </button>

            {/* Net worth preview */}
            {accounts.some((a) => a.name.trim() && a.balance !== "") && (
              <div className="rounded-xl bg-muted p-4 text-center space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Estimated Net Worth</p>
                <p className="text-[24px] font-bold text-foreground">
                  ${accounts.reduce((sum, a) => {
                    const bal = parseFloat(a.balance) || 0;
                    return sum + (a.type === "credit_card" ? -bal : bal);
                  }, 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-12 rounded-xl text-[15px]">
                Back
              </Button>
              <Button
                onClick={async () => {
                  await saveAccounts();
                  setStep(4);
                }}
                className="flex-1 h-12 rounded-xl text-[15px] font-semibold"
              >
                Continue
              </Button>
            </div>

            <button
              onClick={() => setStep(4)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Step 4: Spending Concerns */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">What do you want to fix?</h2>
              <p className="text-sm text-muted-foreground">Select all that apply — this helps our AI give better advice.</p>
            </div>
            <div className="space-y-2">
              {CONCERN_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleConcern(c)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-[14px] transition-colors ${
                    selectedConcerns.includes(c)
                      ? "bg-primary/15 text-primary font-medium"
                      : "bg-card text-foreground"
                  }`}
                >
                  {selectedConcerns.includes(c) ? "✓ " : ""}{c}
                </button>
              ))}
            </div>
            <Input
              type="text"
              placeholder="Other (type here)"
              value={otherConcern}
              onChange={(e) => setOtherConcern(e.target.value)}
              className="h-12 rounded-xl bg-card border-0 text-[15px] placeholder:text-muted-foreground"
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1 h-12 rounded-xl text-[15px]">
                Back
              </Button>
              <Button
                onClick={() => {
                  const concerns = [...selectedConcerns];
                  if (otherConcern.trim()) concerns.push(otherConcern.trim());
                  goToStep(5, { spending_concerns: concerns.length > 0 ? concerns : null });
                }}
                className="flex-1 h-12 rounded-xl text-[15px] font-semibold"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Personal Context */}
        {step === 5 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Tell us about yourself</h2>
              <p className="text-sm text-muted-foreground">The more we know, the better our AI advice gets.</p>
            </div>
            <Textarea
              placeholder="e.g. I'm a 20 year old uni student, I want to save $5000 for a car by December. I tend to overspend on eating out and clothes..."
              value={personalContext}
              onChange={(e) => setPersonalContext(e.target.value)}
              className="min-h-[140px] rounded-xl bg-card border-0 text-[15px] placeholder:text-muted-foreground resize-none"
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(4)} className="flex-1 h-12 rounded-xl text-[15px]">
                Back
              </Button>
              <Button
                onClick={handleFinish}
                disabled={loading}
                className="flex-1 h-12 rounded-xl text-[15px] font-semibold"
              >
                {loading ? "Saving..." : "Get Started"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
