import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CATEGORY_META from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AddTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const categories = Object.entries(CATEGORY_META).filter(([k]) => k !== "income");

const AddTransactionSheet = ({ open, onOpenChange, onSaved }: AddTransactionSheetProps) => {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setType("expense");
    setAmount("");
    setDescription("");
    setMerchant("");
    setCategory("other");
    setDate(new Date());
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

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount: parseFloat(amount),
      type,
      category: type === "income" ? null : category,
      description: description || null,
      merchant: merchant || null,
      date: format(date, "yyyy-MM-dd"),
      source: "manual",
    });

    if (error) {
      toast.error("Failed to save transaction");
    } else {
      toast.success("Transaction added!");
      reset();
      onOpenChange(false);
      onSaved();
    }
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-0 max-h-[90vh] overflow-y-auto px-5 pb-8">
        <SheetHeader className="pt-2 pb-4">
          <SheetTitle className="text-xl font-bold">Add Transaction</SheetTitle>
          <SheetDescription className="sr-only">Add a new income or expense transaction</SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Type Toggle */}
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            <button
              onClick={() => setType("income")}
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

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full h-12 rounded-xl text-[15px] font-semibold"
          >
            {loading ? "Saving..." : "Save Transaction"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddTransactionSheet;
