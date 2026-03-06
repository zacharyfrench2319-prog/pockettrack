import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CATEGORY_META from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { format, addDays, addMonths, addYears } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AddTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const categories = Object.entries(CATEGORY_META).filter(([k]) => k !== "income");

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

function computeNextChargeDate(fromDate: Date, frequency: string): string {
  switch (frequency) {
    case "weekly": return format(addDays(fromDate, 7), "yyyy-MM-dd");
    case "fortnightly": return format(addDays(fromDate, 14), "yyyy-MM-dd");
    case "quarterly": return format(addMonths(fromDate, 3), "yyyy-MM-dd");
    case "yearly": return format(addYears(fromDate, 1), "yyyy-MM-dd");
    default: return format(addMonths(fromDate, 1), "yyyy-MM-dd");
  }
}

const AddTransactionSheet = ({ open, onOpenChange, onSaved }: AddTransactionSheetProps) => {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  // Recurring subscription fields
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState("monthly");

  const reset = () => {
    setType("expense");
    setAmount("");
    setDescription("");
    setMerchant("");
    setCategory("other");
    setDate(new Date());
    setIsRecurring(false);
    setFrequency("monthly");
  };

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setLoading(false);
      return;
    }

    const dateStr = format(date, "yyyy-MM-dd");

    // Save the transaction
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount: parseFloat(amount),
      type,
      category: type === "income" ? null : category,
      description: description || null,
      merchant: merchant || null,
      date: dateStr,
      source: "manual",
    });

    if (error) {
      toast.error("Failed to save transaction");
      setLoading(false);
      return;
    }

    // If recurring, also create a subscription entry
    if (isRecurring && type === "expense") {
      const subName = merchant || description || "Subscription";
      const nextDate = computeNextChargeDate(date, frequency);

      const { error: subError } = await supabase.from("subscriptions").insert({
        user_id: user.id,
        name: subName,
        amount: parseFloat(amount),
        frequency,
        category,
        is_active: true,
        last_charged: dateStr,
        next_charge_date: nextDate,
      });
      if (subError) {
        // Retry without next_charge_date in case column doesn't exist yet
        await supabase.from("subscriptions").insert({
          user_id: user.id,
          name: subName,
          amount: parseFloat(amount),
          frequency,
          category,
          is_active: true,
          last_charged: dateStr,
        });
      }
    }

    toast.success(isRecurring ? "Recurring expense added!" : "Transaction added!");
    reset();
    onOpenChange(false);
    onSaved();
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-0 h-[90vh] overflow-y-auto px-6 sm:px-8 pb-8">
        <SheetHeader className="pt-2 pb-4">
          <SheetTitle className="text-xl font-bold">Add Transaction</SheetTitle>
          <SheetDescription className="sr-only">Add a new income or expense transaction</SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Type Toggle */}
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            <button
              onClick={() => { setType("income"); setIsRecurring(false); }}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-colors",
                type === "income"
                  ? "bg-success text-success-foreground"
                  : "text-muted-foreground"
              )}
            >
              Income
            </button>
            <button
              onClick={() => setType("expense")}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-colors",
                type === "expense"
                  ? "bg-destructive text-destructive-foreground"
                  : "text-muted-foreground"
              )}
            >
              Expense
            </button>
          </div>

          {/* Amount */}
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Amount</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-3xl font-bold text-foreground">$</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-4xl font-bold text-foreground bg-transparent border-0 outline-none text-center w-48 placeholder:text-muted-foreground/40"
              />
            </div>
          </div>

          {/* Description */}
          <Input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-12 rounded-xl bg-muted border-0 text-[15px] placeholder:text-muted-foreground"
          />

          {/* Merchant */}
          <Input
            placeholder="Merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="h-12 rounded-xl bg-muted border-0 text-[15px] placeholder:text-muted-foreground"
          />

          {/* Category (only for expense) */}
          {type === "expense" && (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 rounded-xl bg-muted border-0 text-[15px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {categories.map(([key, meta]) => (
                  <SelectItem key={key} value={key} className="text-[14px]">
                    <span className="flex items-center gap-2">
                      <span>{meta.emoji}</span>
                      <span>{meta.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl bg-muted border-0 text-[15px] justify-start font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                {format(date, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {/* Recurring Toggle (expense only) */}
          {type === "expense" && (
            <button
              onClick={() => setIsRecurring(!isRecurring)}
              className={cn(
                "w-full h-12 rounded-xl flex items-center justify-between px-4 transition-colors",
                isRecurring ? "bg-primary/10 border border-primary/20" : "bg-muted"
              )}
            >
              <div className="flex items-center gap-2.5">
                <RefreshCw size={16} className={isRecurring ? "text-primary" : "text-muted-foreground"} />
                <span className={cn("text-[15px] font-medium", isRecurring ? "text-primary" : "text-muted-foreground")}>
                  This is a recurring expense
                </span>
              </div>
              <div className={cn(
                "w-10 h-6 rounded-full transition-colors relative",
                isRecurring ? "bg-primary" : "bg-muted-foreground/30"
              )}>
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all",
                  isRecurring ? "left-[18px]" : "left-0.5"
                )} />
              </div>
            </button>
          )}

          {/* Recurring fields */}
          {isRecurring && type === "expense" && (
            <div className="space-y-4 rounded-xl bg-primary/5 border border-primary/10 p-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">How often?</label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted border-0 text-[14px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {FREQUENCY_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value} className="text-[14px]">
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-2">
                <RefreshCw size={14} className="text-primary mt-0.5 shrink-0" />
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  This will be tracked as a subscription and automatically logged as a ${amount || "0.00"} expense every {frequency === "weekly" ? "week" : frequency === "fortnightly" ? "2 weeks" : frequency === "quarterly" ? "3 months" : frequency === "yearly" ? "year" : "month"}.
                </p>
              </div>
            </div>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full h-12 rounded-xl text-[15px] font-semibold"
          >
            {loading ? "Saving..." : isRecurring ? "Save Recurring Expense" : "Save Transaction"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddTransactionSheet;
