import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
}

const UpgradeModal = ({ open, onOpenChange, feature = "this feature" }: UpgradeModalProps) => {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("create-checkout");
    setLoading(false);
    if (error || !data?.url) return;
    window.open(data.url, "_blank");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="sr-only">Upgrade to Pro</SheetTitle>
          <SheetDescription className="sr-only">Unlock premium features</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col items-center text-center space-y-5 py-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Sparkles size={32} className="text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Upgrade to PocketTrack Pro</h2>
            <p className="text-sm text-muted-foreground">
              You've reached the free limit for {feature}. Upgrade for unlimited access.
            </p>
          </div>

          <div className="w-full space-y-2 text-left">
            {[
              "Unlimited AI scans",
              "Unlimited savings goals",
              "Subscription detector",
              "CSV data export",
              "Priority support",
            ].map((b) => (
              <div key={b} className="flex items-center gap-2 text-sm text-foreground">
                <Sparkles size={14} className="text-primary shrink-0" />
                <span>{b}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full h-12 rounded-xl text-[15px] font-semibold"
          >
            {loading ? "Loading..." : "$9.99/mo AUD — Start 7-Day Free Trial"}
          </Button>

          <button onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground">
            Maybe later
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UpgradeModal;
