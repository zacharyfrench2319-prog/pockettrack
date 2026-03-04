interface GoalProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  status?: "on_track" | "behind" | "far_behind";
  showLabel?: boolean;
  animate?: boolean;
}

const GoalProgressRing = ({ percent, size = 56, strokeWidth = 5, status = "on_track", showLabel = true, animate = true }: GoalProgressRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  const colorMap = {
    on_track: "hsl(var(--success))",
    behind: "hsl(36, 100%, 50%)",
    far_behind: "hsl(var(--destructive))",
  };

  const ringColor = colorMap[status];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animate ? offset : circumference}
          style={animate ? {
            transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
            animation: "ring-fill 1s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          } : undefined}
        >
          {animate && (
            <animate
              attributeName="stroke-dashoffset"
              from={String(circumference)}
              to={String(offset)}
              dur="1s"
              fill="freeze"
              calcMode="spline"
              keySplines="0.4 0 0.2 1"
            />
          )}
        </circle>
      </svg>
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-foreground font-bold" style={{ fontSize: size * 0.22 }}>
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
};

export default GoalProgressRing;
