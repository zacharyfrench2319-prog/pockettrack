import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  pullDistance: number;
  refreshing: boolean;
  threshold?: number;
}

const PullToRefresh = ({ pullDistance, refreshing, threshold = 80 }: PullToRefreshProps) => {
  if (pullDistance <= 0 && !refreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;

  return (
    <div
      className="flex justify-center overflow-hidden transition-[height] duration-200"
      style={{ height: `${pullDistance}px` }}
    >
      <div className="flex items-center justify-center pt-2">
        {refreshing ? (
          <Loader2 size={20} className="text-primary animate-spin" />
        ) : (
          <div
            className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary transition-transform"
            style={{ transform: `rotate(${rotation}deg)`, opacity: progress }}
          />
        )}
      </div>
    </div>
  );
};

export default PullToRefresh;
