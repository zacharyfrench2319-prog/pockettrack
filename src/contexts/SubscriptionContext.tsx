import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionContextType {
  isPro: boolean;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPro: false,
  loading: true,
  refreshSubscription: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshSubscription = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsPro(false); setLoading(false); return; }

      // Check local profile first
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("user_id", user.id)
        .single();

      if (profile?.subscription_status === "pro") {
        setIsPro(true);
        setLoading(false);
      } else {
        setIsPro(false);
        setLoading(false);
      }

      // Then verify with Stripe in background
      const { data } = await supabase.functions.invoke("check-subscription");
      if (data && !data.error) {
        setIsPro(data.subscribed === true);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSubscription();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshSubscription();
    });

    return () => subscription.unsubscribe();
  }, [refreshSubscription]);

  return (
    <SubscriptionContext.Provider value={{ isPro, loading, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
