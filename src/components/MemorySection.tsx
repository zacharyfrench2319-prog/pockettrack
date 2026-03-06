import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Brain, Pencil, Check } from "lucide-react";
import { toast } from "sonner";

interface MemorySectionProps {
  monthlyIncome: number | null;
  payFrequency: string | null;
  nextPayDate: string | null;
  spendingConcerns: string[] | null;
  personalContext: string | null;
  savingGoal: string | null;
  onUpdated: () => void;
}

const MemorySection = ({
  monthlyIncome,
  payFrequency,
  nextPayDate,
  spendingConcerns,
  personalContext,
  savingGoal,
  onUpdated,
}: MemorySectionProps) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (field: string, value: string) => {
    setEditing(field);
    setEditValue(value);
  };

  const saveField = async (field: string, value: any) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("profiles").update({ [field]: value } as any).eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Updated");
    setEditing(null);
    onUpdated();
  };

  const rows: Array<{ label: string; field: string; value: string; type?: string }> = [
    { label: "Monthly Income", field: "monthly_income", value: monthlyIncome ? `$${monthlyIncome.toLocaleString()}` : "Not set" },
    { label: "Pay Frequency", field: "pay_frequency", value: payFrequency || "Not set" },
    { label: "Next Pay Day", field: "next_pay_date", value: nextPayDate || "Not set", type: "date" },
    { label: "Saving For", field: "saving_goal", value: savingGoal || "Not set" },
  ];

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1 flex items-center gap-1.5">
        <Brain size={12} /> Memory
      </p>
      <div className="rounded-2xl bg-card overflow-hidden">
        {rows.map((row, i) => (
          <div key={row.field} className={`px-5 py-3.5 ${i > 0 ? "border-t border-border/40" : ""}`}>
            {editing === row.field ? (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted-foreground w-28 shrink-0">{row.label}</span>
                {row.field === "pay_frequency" ? (
                  <Select value={editValue} onValueChange={(v) => { setEditValue(v); saveField(row.field, v); }}>
                    <SelectTrigger className="h-8 rounded-lg bg-secondary border-0 text-sm flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <Input
                      type={row.type === "date" ? "date" : row.field === "monthly_income" ? "number" : "text"}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-8 rounded-lg bg-secondary border-0 text-sm flex-1"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        const val = row.field === "monthly_income" ? (editValue ? parseFloat(editValue) : null) : (editValue || null);
                        saveField(row.field, val);
                      }}
                      disabled={saving}
                    >
                      <Check size={16} className="text-primary" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  const raw = row.field === "monthly_income" ? (monthlyIncome?.toString() || "") :
                    row.field === "pay_frequency" ? (payFrequency || "") :
                    row.field === "next_pay_date" ? (nextPayDate || "") :
                    (savingGoal || "");
                  startEdit(row.field, raw);
                }}
                className="w-full flex items-center justify-between"
              >
                <span className="text-[13px] text-muted-foreground">{row.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] text-foreground">{row.value}</span>
                  <Pencil size={12} className="text-muted-foreground" />
                </div>
              </button>
            )}
          </div>
        ))}

        {/* Spending Concerns */}
        <div className="px-5 py-3.5 border-t border-border/40">
          <p className="text-[13px] text-muted-foreground mb-2">Spending Concerns</p>
          {spendingConcerns && spendingConcerns.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {spendingConcerns.map((c) => (
                <span key={c} className="text-[11px] bg-primary/10 text-primary px-2.5 py-1 rounded-full">{c}</span>
              ))}
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground/60">Not set</span>
          )}
        </div>

        {/* Personal Context */}
        <div className="px-5 py-3.5 border-t border-border/40">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] text-muted-foreground">About You</p>
            {editing !== "personal_context" && (
              <button onClick={() => startEdit("personal_context", personalContext || "")}>
                <Pencil size={12} className="text-muted-foreground" />
              </button>
            )}
          </div>
          {editing === "personal_context" ? (
            <div className="space-y-2">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="min-h-[80px] rounded-xl bg-secondary border-0 text-[13px] resize-none"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => saveField("personal_context", editValue || null)}
                disabled={saving}
                className="h-8 rounded-lg text-xs"
              >
                Save
              </Button>
            </div>
          ) : (
            <p className="text-[13px] text-foreground leading-relaxed">
              {personalContext || <span className="text-muted-foreground/60">Not set — tap edit to add context for better AI advice</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemorySection;
