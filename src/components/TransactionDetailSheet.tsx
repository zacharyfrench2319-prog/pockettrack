import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryMeta } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Trash2, Edit3, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string | null;
  date: string;
  description: string | null;
  merchant: string | null;
  source: string | null;
}

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const TransactionDetailSheet = ({ transaction, open, onOpenChange, onUpdated }: TransactionDetailSheetProps) => {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    if (!transaction) return;
    setAmount(String(transaction.amount));
    setDescription(transaction.description || "");
    setMerchant(transaction.merchant || "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!transaction) return;
    setSaving(true);
    const { error } = await supabase
      .from("transactions")
      .update({
        amount: parseFloat(amount),
        description: description || null,
        merchant: merchant || null,
      })
      .eq("id", transaction.id);

    if (error) toast.error("Failed to update");
    else {
      toast.success("Updated!");
      setEditing(false);
      onOpenChange(false);
      onUpdated();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!transaction) return;
    setDeleting(true);
    const { error } = await supabase.from("transactions").delete().eq("id", transaction.id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Deleted!");
      onOpenChange(false);
      onUpdated();
    }
    setDeleting(false);
  };

  if (!transaction) return null;

  const meta = getCategoryMeta(transaction.category, transaction.type);
  const isIncome = transaction.type === "income";

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEditing(false); }}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-0 h-[90vh] overflow-y-auto px-6 sm:px-8 pb-8">
        <SheetHeader className="pt-2 pb-4">
          <SheetTitle className="text-xl font-bold">Transaction Details</SheetTitle>
          <SheetDescription className="sr-only">View, edit, or delete transaction</SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Amount Display */}
          <div className="text-center space-y-2">
            <div
              className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-xl"
              style={{ backgroundColor: meta.color + "22" }}
            >
              {meta.emoji}
            </div>
            {editing ? (
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl font-bold text-foreground">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-3xl font-bold text-foreground bg-transparent border-0 outline-none text-center w-40"
                />
              </div>
            ) : (
              <p className={`text-3xl font-bold ${isIncome ? "text-success" : "text-destructive"}`}>
                {isIncome ? "+" : "-"}${transaction.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            )}
            <p className="text-sm text-muted-foreground">{meta.label} · {format(parseISO(transaction.date), "MMMM d, yyyy")}</p>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {editing ? (
              <>
                <Input
                  placeholder="Merchant"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="h-12 rounded-xl bg-muted border-0 text-[15px]"
                />
                <Input
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-12 rounded-xl bg-muted border-0 text-[15px]"
                />
              </>
            ) : (
              <div className="rounded-2xl bg-muted/50 p-4 space-y-2">
                {transaction.merchant && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Merchant</span>
                    <span className="text-foreground font-medium">{transaction.merchant}</span>
                  </div>
                )}
                {transaction.description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Description</span>
                    <span className="text-foreground font-medium">{transaction.description}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Source</span>
                  <span className="text-foreground font-medium capitalize">{transaction.source || "manual"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {editing ? (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1 h-12 rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 h-12 rounded-xl font-semibold">
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" onClick={startEdit} className="flex-1 h-12 rounded-xl gap-2">
                <Edit3 size={16} /> Edit
              </Button>
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              >
                <Trash2 size={16} /> {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TransactionDetailSheet;
