import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";

interface AddAccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editAccount?: { id: string; name: string; type: string; balance: number } | null;
}

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking", emoji: "🏦" },
  { value: "savings", label: "Savings", emoji: "💰" },
  { value: "credit_card", label: "Credit Card", emoji: "💳" },
  { value: "investment", label: "Investment", emoji: "📈" },
  { value: "cash", label: "Cash", emoji: "💵" },
];

const AddAccountSheet = ({ open, onOpenChange, onSaved, editAccount }: AddAccountSheetProps) => {
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [balance, setBalance] = useState("");
  const [loading, setLoading] = useState(false);

  // Scroll focused input into view when keyboard opens
  const scrollOnFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, []);

  useEffect(() => {
    if (editAccount) {
      setName(editAccount.name);
      setType(editAccount.type);
      setBalance(String(editAccount.balance));
    } else {
      setName("");
      setType("checking");
      setBalance("");
    }
  }, [editAccount, open]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Enter an account name"); return; }
    if (!balance || isNaN(parseFloat(balance))) { toast.error("Enter a valid balance"); return; }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setLoading(false); return; }

    if (editAccount) {
      const { error } = await supabase.from("accounts").update({
        name: name.trim(),
        type,
        balance: parseFloat(balance),
        updated_at: new Date().toISOString(),
      }).eq("id", editAccount.id);
      if (error) { toast.error("Failed to update account"); setLoading(false); return; }
      toast.success("Account updated");
    } else {
      const { error } = await supabase.from("accounts").insert({
        user_id: user.id,
        name: name.trim(),
        type,
        balance: parseFloat(balance),
      });
      if (error) { toast.error("Failed to add account"); setLoading(false); return; }
      toast.success("Account added");
    }

    setLoading(false);
    onOpenChange(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!editAccount) return;
    setLoading(true);
    const { error } = await supabase.from("accounts").delete().eq("id", editAccount.id);
    if (error) { toast.error("Failed to delete account"); setLoading(false); return; }
    toast.success("Account deleted");
    setLoading(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-0 max-h-[90dvh] overflow-y-auto px-6 sm:px-8 pb-8">
        <SheetHeader className="pt-2 pb-4">
          <SheetTitle className="text-xl font-bold">{editAccount ? "Edit Account" : "Add Account"}</SheetTitle>
          <SheetDescription className="sr-only">Add or edit a financial account</SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <Input
            placeholder="Account name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={scrollOnFocus}
            className="h-12 rounded-xl bg-muted border-0 text-[15px] placeholder:text-muted-foreground"
          />

          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-12 rounded-xl bg-muted border-0 text-[15px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {ACCOUNT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-[14px]">
                  <span className="flex items-center gap-2">
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Balance</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-3xl font-bold text-foreground">$</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                onFocus={(e) => scrollOnFocus(e)}
                className="text-4xl font-bold text-foreground bg-transparent border-0 outline-none text-center w-48 placeholder:text-muted-foreground/40"
              />
            </div>
            {type === "credit_card" && (
              <p className="text-xs text-muted-foreground">Enter amount owed (will be subtracted from net worth)</p>
            )}
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full h-12 rounded-xl text-[15px] font-semibold">
            {loading ? "Saving..." : editAccount ? "Update Account" : "Add Account"}
          </Button>

          {editAccount && (
            <Button onClick={handleDelete} disabled={loading} variant="ghost" className="w-full h-12 rounded-xl text-[15px] font-semibold text-destructive">
              Delete Account
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddAccountSheet;
