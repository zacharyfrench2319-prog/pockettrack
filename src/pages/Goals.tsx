import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import GoalProgressRing from "@/components/GoalProgressRing";
import UpgradeModal from "@/components/UpgradeModal";
import { GoalsSkeleton } from "@/components/Skeletons";
import PullToRefresh from "@/components/PullToRefresh";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number | null;
  deadline: string | null;
  icon: string | null;
  created_at: string | null;
};

const ICONS = [
  { id: "piggy-bank", emoji: "🐷" },
  { id: "car", emoji: "🚗" },
  { id: "plane", emoji: "✈️" },
  { id: "house", emoji: "🏠" },
  { id: "graduation-cap", emoji: "🎓" },
  { id: "gift", emoji: "🎁" },
  { id: "phone", emoji: "📱" },
  { id: "laptop", emoji: "💻" },
  { id: "shirt", emoji: "👕" },
  { id: "dumbbell", emoji: "🏋️" },
];

const getIconEmoji = (icon: string | null) =>
  ICONS.find((i) => i.id === icon)?.emoji || "🐷";

const getGoalStatus = (goal: Goal): "on_track" | "behind" | "far_behind" => {
  if (!goal.deadline) return "on_track";
  const now = new Date();
  const created = goal.created_at ? parseISO(goal.created_at) : now;
  const deadline = parseISO(goal.deadline);
  const totalDays = Math.max(differenceInDays(deadline, created), 1);
  const elapsedDays = differenceInDays(now, created);
  const expectedProgress = Math.min(elapsedDays / totalDays, 1);
  const actualProgress = (goal.current_amount || 0) / goal.target_amount;

  if (actualProgress >= expectedProgress * 0.8) return "on_track";
  if (actualProgress >= expectedProgress * 0.5) return "behind";
  return "far_behind";
};

const Goals = () => {
  const { isPro } = useSubscription();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Add/edit form
  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formDeadline, setFormDeadline] = useState<Date | undefined>();
  const [formIcon, setFormIcon] = useState("piggy-bank");
  const [saving, setSaving] = useState(false);

  // Quick add money
  const [addAmount, setAddAmount] = useState("");

  const loadGoals = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load goals:", error);
      const { toast } = await import("sonner");
      toast.error("Failed to load goals");
    }
    if (data) setGoals(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const { pullDistance, refreshing } = usePullToRefresh({ onRefresh: loadGoals });

  const resetForm = () => {
    setFormName("");
    setFormTarget("");
    setFormDeadline(undefined);
    setFormIcon("piggy-bank");
  };

  const handleCreate = async () => {
    if (!formName || !formTarget) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("savings_goals").insert({
      user_id: user.id,
      name: formName,
      target_amount: parseFloat(formTarget),
      deadline: formDeadline ? format(formDeadline, "yyyy-MM-dd") : null,
      icon: formIcon,
    });

    setSaving(false);
    if (error) { toast.error("Failed to create goal"); return; }
    toast.success("Goal created!");
    setAddOpen(false);
    resetForm();
    loadGoals();
  };

  const handleUpdate = async () => {
    if (!detailGoal || !formName || !formTarget) return;
    setSaving(true);
    const { error } = await supabase
      .from("savings_goals")
      .update({
        name: formName,
        target_amount: parseFloat(formTarget),
        deadline: formDeadline ? format(formDeadline, "yyyy-MM-dd") : null,
        icon: formIcon,
      })
      .eq("id", detailGoal.id);

    setSaving(false);
    if (error) { toast.error("Failed to update goal"); return; }
    toast.success("Goal updated!");
    setEditMode(false);
    loadGoals();
    setDetailGoal((prev) => prev ? { ...prev, name: formName, target_amount: parseFloat(formTarget), deadline: formDeadline ? format(formDeadline, "yyyy-MM-dd") : null, icon: formIcon } : null);
  };

  const handleDelete = async () => {
    if (!detailGoal) return;
    const { error } = await supabase.from("savings_goals").delete().eq("id", detailGoal.id);
    if (error) { toast.error("Failed to delete goal"); return; }
    toast.success("Goal deleted");
    setDetailGoal(null);
    loadGoals();
  };

  const handleAddMoney = async () => {
    if (!detailGoal || !addAmount) return;
    const newAmount = (detailGoal.current_amount || 0) + parseFloat(addAmount);
    const { error } = await supabase
      .from("savings_goals")
      .update({ current_amount: newAmount })
      .eq("id", detailGoal.id);

    if (error) { toast.error("Failed to add money"); return; }
    toast.success(`Added $${parseFloat(addAmount).toFixed(2)}!`);
    setAddAmount("");
    setDetailGoal((prev) => prev ? { ...prev, current_amount: newAmount } : null);
    loadGoals();
  };

  const handleQuickAdd = async (goal: Goal) => {
    // Open detail for quick-add
    setDetailGoal(goal);
    setEditMode(false);
  };

  const openEdit = () => {
    if (!detailGoal) return;
    setFormName(detailGoal.name);
    setFormTarget(String(detailGoal.target_amount));
    setFormDeadline(detailGoal.deadline ? parseISO(detailGoal.deadline) : undefined);
    setFormIcon(detailGoal.icon || "piggy-bank");
    setEditMode(true);
  };

  if (loading) return <GoalsSkeleton />;

  return (
    <div className="px-6 sm:px-8 pt-safe-top pb-4 space-y-4">
      <PullToRefresh pullDistance={pullDistance} refreshing={refreshing} />
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <h1 className="text-[28px] font-bold text-foreground">Goals</h1>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1 text-primary"
          onClick={() => {
            if (!isPro && goals.length >= 1) {
              setUpgradeOpen(true);
              return;
            }
            resetForm();
            setAddOpen(true);
          }}
        >
          <Plus size={18} /> New Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 flex flex-col items-center text-center space-y-4 animate-fade-in">
          <div className="text-5xl">🎯</div>
          <h3 className="text-lg font-semibold text-foreground">Set your first savings goal</h3>
          <p className="text-sm text-muted-foreground">Track your progress towards the things that matter most</p>
          <Button onClick={() => { resetForm(); setAddOpen(true); }} className="rounded-xl h-11 px-6 text-[14px] font-semibold">
            Create Your First Goal
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal, i) => {
            const percent = goal.target_amount > 0 ? ((goal.current_amount || 0) / goal.target_amount) * 100 : 0;
            const daysLeft = goal.deadline ? Math.max(differenceInDays(parseISO(goal.deadline), new Date()), 0) : null;
            const status = getGoalStatus(goal);

            return (
              <div
                key={goal.id}
                className="rounded-2xl bg-card p-4 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform animate-fade-in"
                style={{ boxShadow: "var(--card-shadow)", animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
                onClick={() => { setDetailGoal(goal); setEditMode(false); setAddAmount(""); }}
              >
                <GoalProgressRing percent={percent} size={56} status={status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{getIconEmoji(goal.icon)}</span>
                    <h3 className="text-[15px] font-semibold text-foreground truncate">{goal.name}</h3>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    ${(goal.current_amount || 0).toLocaleString()} / ${goal.target_amount.toLocaleString()}
                  </p>
                  {daysLeft !== null && (
                    <p className="text-[11px] text-muted-foreground">{daysLeft} days left</p>
                  )}
                </div>
                <Button
                  size="sm"
                  className="rounded-full h-8 px-4 text-xs font-semibold shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleQuickAdd(goal); }}
                >
                  Add
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD GOAL SHEET */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-card border-0 max-h-[90dvh] overflow-y-auto px-6 sm:px-8 pb-8">
          <SheetHeader>
            <SheetTitle>Create Goal</SheetTitle>
            <SheetDescription>Set a new savings target</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Goal Name</label>
              <Input placeholder="e.g. New Laptop" value={formName} onChange={(e) => setFormName(e.target.value)} className="rounded-xl bg-secondary border-0" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Target Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input type="number" placeholder="1000" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} className="rounded-xl bg-secondary border-0 pl-7" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Deadline</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full rounded-xl justify-start text-left font-normal bg-secondary border-0", !formDeadline && "text-muted-foreground")}>
                    {formDeadline ? format(formDeadline, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={formDeadline} onSelect={setFormDeadline} disabled={(d) => d < new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Icon</label>
              <div className="grid grid-cols-5 gap-2">
                {ICONS.map((ic) => (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setFormIcon(ic.id)}
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all",
                      formIcon === ic.id ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary"
                    )}
                  >
                    {ic.emoji}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleCreate} disabled={!formName || !formTarget || saving} className="w-full rounded-xl h-12 text-[15px] font-semibold">
              {saving ? "Creating..." : "Create Goal"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* GOAL DETAIL SHEET */}
      <Sheet open={!!detailGoal} onOpenChange={(open) => { if (!open) { setDetailGoal(null); setEditMode(false); } }}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-card border-0 max-h-[90dvh] overflow-y-auto px-6 sm:px-8 pb-8">
          {detailGoal && !editMode && (() => {
            const percent = detailGoal.target_amount > 0 ? ((detailGoal.current_amount || 0) / detailGoal.target_amount) * 100 : 0;
            const daysLeft = detailGoal.deadline ? Math.max(differenceInDays(parseISO(detailGoal.deadline), new Date()), 0) : null;
            const status = getGoalStatus(detailGoal);

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="sr-only">{detailGoal.name}</SheetTitle>
                  <SheetDescription className="sr-only">Goal details</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col items-center space-y-4 pt-2">
                  <GoalProgressRing percent={percent} size={120} strokeWidth={10} status={status} />

                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl">{getIconEmoji(detailGoal.icon)}</span>
                      <h2 className="text-xl font-bold text-foreground">{detailGoal.name}</h2>
                    </div>
                    <p className="text-[15px] text-muted-foreground">
                      ${(detailGoal.current_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} of ${detailGoal.target_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full space-y-1">
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(percent, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{Math.round(percent)}% complete</span>
                      {daysLeft !== null && <span>{daysLeft} days left</span>}
                    </div>
                  </div>

                  {/* Add Money */}
                  <div className="w-full rounded-2xl bg-secondary p-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Add Money</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={addAmount}
                          onChange={(e) => setAddAmount(e.target.value)}
                          className="rounded-xl bg-card border-0 pl-7"
                        />
                      </div>
                      <Button onClick={handleAddMoney} disabled={!addAmount || parseFloat(addAmount) <= 0} className="rounded-xl px-6">
                        Add
                      </Button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="w-full flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-xl gap-2" onClick={openEdit}>
                      <Pencil size={16} /> Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 gap-2">
                          <Trash2 size={16} /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete "{detailGoal.name}". This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </>
            );
          })()}

          {detailGoal && editMode && (
            <>
              <SheetHeader>
                <SheetTitle>Edit Goal</SheetTitle>
                <SheetDescription>Update your savings goal</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Goal Name</label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="rounded-xl bg-secondary border-0" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Target Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                    <Input type="number" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} className="rounded-xl bg-secondary border-0 pl-7" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Deadline</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full rounded-xl justify-start text-left font-normal bg-secondary border-0", !formDeadline && "text-muted-foreground")}>
                        {formDeadline ? format(formDeadline, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={formDeadline} onSelect={setFormDeadline} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Icon</label>
                  <div className="grid grid-cols-5 gap-2">
                    {ICONS.map((ic) => (
                      <button key={ic.id} type="button" onClick={() => setFormIcon(ic.id)} className={cn("w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all", formIcon === ic.id ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary")}>
                        {ic.emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditMode(false)}>Cancel</Button>
                  <Button onClick={handleUpdate} disabled={!formName || !formTarget || saving} className="flex-1 rounded-xl">
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="savings goals" />
    </div>
  );
};

export default Goals;
