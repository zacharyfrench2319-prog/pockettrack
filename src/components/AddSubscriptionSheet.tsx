import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, addDays, addMonths, addYears } from "date-fns";
import { RefreshCw } from "lucide-react";
import CATEGORY_META from "@/lib/categories";

interface AddSubscriptionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const categories = Object.entries(CATEGORY_META)
  .filter(([key]) => key !== "income")
  .map(([key, meta]) => ({ key, ...meta }));

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly", description: "Every 7 days" },
  { value: "fortnightly", label: "Fortnightly", description: "Every 2 weeks" },
  { value: "monthly", label: "Monthly", description: "Every month" },
  { value: "quarterly", label: "Quarterly", description: "Every 3 months" },
  { value: "yearly", label: "Yearly", description: "Every year" },
];

function computeNextDate(fromDate: string, frequency: string): string {
  const d = new Date(fromDate + "T00:00:00");
  switch (frequency) {
    case "weekly": return format(addDays(d, 7), "yyyy-MM-dd");
    case "fortnightly": return format(addDays(d, 14), "yyyy-MM-dd");
    case "monthly": return format(addMonths(d, 1), "yyyy-MM-dd");
    case "quarterly": return format(addMonths(d, 3), "yyyy-MM-dd");
    case "yearly": return format(addYears(d, 1), "yyyy-MM-dd");
    default: return format(addMonths(d, 1), "yyyy-MM-dd");
  }
}

const AddSubscriptionSheet = ({ open, onOpenChange, onSaved }: AddSubscriptionSheetProps) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [category, setCategory] = useState("other");
  const [nextChargeDate, setNextChargeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !amount) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase.from("subscriptions").insert({
      user_id: user.id,
      name,
      amount: parseFloat(amount),
      frequency,
      category,
      is_active: true,
      next_charge_date: nextChargeDate,
    });

    setSaving(false);
    if (error) { console.error("Subscription insert error:", error); toast.error("Failed to add subscription: " + error.message); return; }
    toast.success("Subscription added!");
    setName(""); setAmount(""); setFrequency("monthly"); setCategory("other");
    setNextChargeDate(format(new Date(), "yyyy-MM-dd"));
    onOpenChange(false);
    onSaved();
  };

  const freqLabel = FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.description || "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-0 max-h-[90dvh] overflow-y-auto px-6 sm:px-8 pb-8">
        <SheetHeader>
          <SheetTitle>Add Subscription</SheetTitle>
          <SheetDescription>Track a recurring charge — expenses are logged automatically</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Service Name</label>
            <Input placeholder="e.g. Netflix" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl bg-secondary border-0" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input type="number" inputMode="decimal" placeholder="9.99" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl bg-secondary border-0 pl-7" />
            </div>
          </div>

          {/* Frequency selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">How often does it charge?</label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="rounded-xl bg-secondary border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Next charge date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Next charge date</label>
            <Input
              type="date"
              value={nextChargeDate}
              onChange={(e) => setNextChargeDate(e.target.value)}
              className="rounded-xl bg-secondary border-0"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-xl bg-secondary border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.emoji} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-charge info */}
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 flex items-start gap-2.5">
            <RefreshCw size={16} className="text-primary mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-[13px] font-medium text-foreground">Auto-tracked expense</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                An expense of ${amount || "0.00"} will be automatically logged {freqLabel.toLowerCase()} starting from your next charge date. No need to add it manually each time.
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={!name || !amount || saving} className="w-full rounded-xl h-12 text-[15px] font-semibold">
            {saving ? "Saving..." : "Add Subscription"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export { computeNextDate };
export default AddSubscriptionSheet;
