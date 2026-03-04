import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [savingGoal, setSavingGoal] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      navigate("/auth");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : null,
        saving_goal: savingGoal || null,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to save profile");
    } else {
      navigate("/home");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Logo size="large" />
        </div>

        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">Step {step} of 2</p>
          <div className="flex gap-2 justify-center">
            <div className={`h-1 w-12 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-1 w-12 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
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
            <Button
              onClick={() => setStep(2)}
              className="w-full h-12 rounded-xl text-[15px] font-semibold"
            >
              Continue
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">What are you saving for?</h2>
              <p className="text-sm text-muted-foreground">A vacation, emergency fund, new car?</p>
            </div>
            <Input
              type="text"
              placeholder="e.g. Emergency fund"
              value={savingGoal}
              onChange={(e) => setSavingGoal(e.target.value)}
              className="h-12 rounded-xl bg-card border-0 text-[15px] placeholder:text-muted-foreground"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 h-12 rounded-xl text-[15px]"
              >
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
