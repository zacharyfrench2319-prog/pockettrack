import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import CATEGORY_META from "@/lib/categories";

interface AddSubscriptionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const categories = Object.entries(CATEGORY_META)
  .filter(([key]) => key !== "income")
  .map(([key, meta]) => ({ key, ...meta }));

const AddSubscriptionSheet = ({ open, onOpenChange, onSaved }: AddSubscriptionSheetProps) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [category, setCategory] = useState("other");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !amount) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("subscriptions").insert({
      user_id: user.id,
      name,
      amount: parseFloat(amount),
      frequency,
      category,
      is_active: true,
    });

    setSaving(false);
    if (error) { toast.error("Failed to add subscription"); return; }
    toast.success("Subscription added!");
    setName(""); setAmount(""); setFrequency("monthly"); setCategory("other");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Add Subscription</SheetTitle>
          <SheetDescription>Manually track a recurring charge</SheetDescription>
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
              <Input type="number" placeholder="9.99" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl bg-secondary border-0 pl-7" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Frequency</label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="rounded-xl bg-secondary border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
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
          <Button onClick={handleSave} disabled={!name || !amount || saving} className="w-full rounded-xl h-12 text-[15px] font-semibold">
            {saving ? "Saving..." : "Add Subscription"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddSubscriptionSheet;
