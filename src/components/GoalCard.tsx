import { useNavigate } from "react-router-dom";
import { differenceInDays, parseISO } from "date-fns";
import GoalProgressRing from "./GoalProgressRing";

interface GoalCardProps {
  goal: {
    name: string;
    target_amount: number;
    current_amount: number | null;
    deadline: string | null;
    icon: string | null;
    created_at: string | null;
  } | null;
}

const ICONS: Record<string, string> = {
  "piggy-bank": "🐷", car: "🚗", plane: "✈️", house: "🏠", "graduation-cap": "🎓",
  gift: "🎁", phone: "📱", laptop: "💻", shirt: "👕", dumbbell: "🏋️",
};

const GoalCard = ({ goal }: GoalCardProps) => {
  const navigate = useNavigate();

  if (!goal) {
    return (
      <div
        onClick={() => navigate("/goals")}
        className="rounded-2xl bg-card p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
       
      >
        <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-xl">🎯</div>
        <div>
          <p className="text-[14px] font-semibold text-foreground">Set a savings goal</p>
          <p className="text-[12px] text-muted-foreground">Start tracking your progress</p>
        </div>
      </div>
    );
  }

  const percent = goal.target_amount > 0 ? ((goal.current_amount || 0) / goal.target_amount) * 100 : 0;
  const daysLeft = goal.deadline ? Math.max(differenceInDays(parseISO(goal.deadline), new Date()), 0) : null;

  return (
    <div
      onClick={() => navigate("/goals")}
      className="rounded-2xl bg-card p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
     
    >
      <GoalProgressRing percent={percent} size={44} strokeWidth={4} showLabel={false} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{ICONS[goal.icon || "piggy-bank"] || "🐷"}</span>
          <p className="text-[14px] font-semibold text-foreground truncate">{goal.name}</p>
        </div>
        <p className="text-[12px] text-muted-foreground">
          ${(goal.current_amount || 0).toLocaleString()} of ${goal.target_amount.toLocaleString()}
          {daysLeft !== null && ` · ${daysLeft}d left`}
        </p>
      </div>
    </div>
  );
};

export default GoalCard;
