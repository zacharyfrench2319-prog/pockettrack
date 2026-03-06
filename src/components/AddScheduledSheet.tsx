import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import CATEGORY_META from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AddScheduledSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editItem?: {
    id: string;
    amount: number;
    type: string;
    category: string | null;
    description: string | null;
    merchant: string | null;
    frequency: string;
    next_date: string;
  } | null;
}

const categories = Object.entries(CATEGORY_META).filter(([k]) => k !== "income");
const frequencies = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const AddScheduledSheet = ({ open, onOpenChange, onSaved, editItem }: AddScheduledSheetProps) => {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("other");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDate, setNextDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editItem) {
      setType(editItem.type as "income" | "expense");
      setAmount(String(editItem.amount));
      setDescription(editItem.description || "");
      setMerchant(editItem.merchant || "");
      setCategory(editItem.category || "other");
      setFrequency(editItem.frequency);
      setNextDate(new Date(editItem.next_date + "T00:00:00"));
    } else {
      setType("expense");
      setAmount("");
      setDescription("");
      setMerchant("");
      setCategory("other");
      setFrequency("monthly");
      setNextDate(new Date());
    }
  }, [editItem, open]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setLoading(false); return; }

    const payload = {
      amount: parseFloat(amount),
      type,
      category: type === "income" ? null : category,
      description: description || null,
      merchant: merchant || null,
      frequency,
      next_date: format(nextDate, "yyyy-MM-dd"),
    };

    if (editItem) {
      const { error } = await supabase.from("scheduled_transactions").update(payload).eq("id", editItem.id);
      if (error) { toast.error("Failed to update"); setLoading(false); return; }
      toast.success("Updated");
    } else {
      const { error } = await supabase.from("scheduled_transactions").insert({ ...payload, user_id: user.id, is_active: true });
      if (error) { toast.error("Failed to save"); setLoading(false); return; }
      toast.success("Scheduled transaction created");
    }

    setLoading(false);
    onOpenChange(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!editItem) return;
    setLoading(true);
    const { error } = await supabase.from("scheduled_transactions").delete().eq("id", editItem.id);
    if (error) { toast.error("Failed to delete"); setLoading(false); return; }
    toast.success("Deleted");
    setLoading(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-0 h-[90vh] overflow-y-auto px-6 sm:px-8 pb-8">
        <SheetHeader className="pt-2 pb-4">
          <SheetTitle className="text-xl font-bold">{editItem ? "Edit Scheduled" : "Add Scheduled"}</SheetTitle>
          <SheetDescription className="sr-only">Create or edit a recurring transaction</SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Type Toggle */}
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            <button onClick={() => setType("income")} className={cn("flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-colors", type === "income" ? "bg-success text-success-foreground" : "text-muted-foreground")}>Income</button>
            <button onClick={() => setType("expense")} className={cn("flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition-colors", type === "expense" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground")}>Expense</button>
          </div>

          {/* Amount */}
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Amount</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-3xl font-bold text-foreground">$</span>
              <input type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-4xl font-bold text-foreground bg-transparent border-0 outline-none text-center w-48 placeholder:text-muted-foreground/40" />
            </div>
          </div>

          <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="h-12 rounded-xl bg-muted border-0 text-[15px] placeholder:text-muted-foreground" />
          <Input placeholder="Merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} className="h-12 rounded-xl bg-muted border-0 text-[15px] placeholder:text-muted-foreground" />

          {type === "expense" && (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 rounded-xl bg-muted border-0 text-[15px]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                {categories.map(([key, meta]) => (
                  <SelectItem key={key} value={key} className="text-[14px]">
                    <span className="flex items-center gap-2"><span>{meta.emoji}</span><span>{meta.label}</span></span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger className="h-12 rounded-xl bg-muted border-0 text-[15px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              {frequencies.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-[14px]">{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Next Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-12 rounded-xl bg-muted border-0 text-[15px] justify-start font-normal">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                Next: {format(nextDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
              <Calendar mode="single" selected={nextDate} onSelect={(d) => d && setNextDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          <Button onClick={handleSave} disabled={loading} className="w-full h-12 rounded-xl text-[15px] font-semibold">
            {loading ? "Saving..." : editItem ? "Update" : "Create Scheduled Transaction"}
          </Button>

          {editItem && (
            <Button onClick={handleDelete} disabled={loading} variant="ghost" className="w-full h-12 rounded-xl text-[15px] font-semibold text-destructive">
              Delete
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddScheduledSheet;
