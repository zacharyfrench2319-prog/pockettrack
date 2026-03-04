import { Target, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const Goals = () => {
  const goals = [
    { name: "Emergency Fund", current: 3200, target: 10000, emoji: "🛡️" },
    { name: "Vacation", current: 850, target: 3000, emoji: "✈️" },
    { name: "New Laptop", current: 400, target: 1500, emoji: "💻" },
  ];

  return (
    <div className="px-5 pt-14 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-foreground">Goals</h1>
        <Button size="icon" variant="ghost" className="rounded-xl">
          <Plus size={22} />
        </Button>
      </div>

      {/* Summary */}
      <div className="rounded-2xl bg-primary/10 p-4 flex items-center gap-3">
        <Target size={20} className="text-primary" />
        <p className="text-sm text-foreground">
          You're <span className="font-semibold text-primary">32%</span> of the way to your goals!
        </p>
      </div>

      {/* Goal Cards */}
      {goals.map((goal, i) => {
        const percent = Math.round((goal.current / goal.target) * 100);
        return (
          <div key={i} className="rounded-2xl bg-card p-5 space-y-3" style={{ boxShadow: "var(--card-shadow)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{goal.emoji}</span>
                <h3 className="text-[15px] font-semibold text-foreground">{goal.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{percent}%</p>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>${goal.current.toLocaleString()}</span>
              <span>${goal.target.toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Goals;
