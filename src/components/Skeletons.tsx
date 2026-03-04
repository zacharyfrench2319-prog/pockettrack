const SkeletonPulse = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-2xl bg-muted/60 ${className}`} />
);

export const DashboardSkeleton = () => (
  <div className="px-5 pt-12 pb-4 space-y-4">
    <SkeletonPulse className="w-20 h-5 mx-auto" />
    <div className="space-y-1">
      <SkeletonPulse className="w-48 h-8" />
      <SkeletonPulse className="w-56 h-4" />
    </div>
    <SkeletonPulse className="w-full h-28 rounded-2xl" />
    <div className="grid grid-cols-3 gap-3">
      <SkeletonPulse className="h-16 rounded-2xl" />
      <SkeletonPulse className="h-16 rounded-2xl" />
      <SkeletonPulse className="h-16 rounded-2xl" />
    </div>
    <SkeletonPulse className="w-full h-48 rounded-2xl" />
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <SkeletonPulse key={i} className="w-full h-14 rounded-2xl" />
      ))}
    </div>
  </div>
);

export const TransactionListSkeleton = () => (
  <div className="rounded-2xl bg-card overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/20 last:border-0">
        <SkeletonPulse className="w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <SkeletonPulse className="w-32 h-3.5" />
          <SkeletonPulse className="w-20 h-2.5" />
        </div>
        <SkeletonPulse className="w-16 h-4" />
      </div>
    ))}
  </div>
);

export const GoalsSkeleton = () => (
  <div className="px-5 pt-14 pb-4 space-y-4">
    <div className="flex items-center justify-between">
      <SkeletonPulse className="w-20 h-8" />
      <SkeletonPulse className="w-24 h-8 rounded-xl" />
    </div>
    {[...Array(2)].map((_, i) => (
      <div key={i} className="rounded-2xl bg-card p-4 flex items-center gap-4" style={{ boxShadow: "var(--card-shadow)" }}>
        <SkeletonPulse className="w-14 h-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonPulse className="w-32 h-4" />
          <SkeletonPulse className="w-24 h-3" />
        </div>
      </div>
    ))}
  </div>
);

export default SkeletonPulse;
