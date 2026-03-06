import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async (authUser: User | null) => {
      if (!authUser) {
        navigate("/auth");
        setLoading(false);
        return;
      }

      // Check if onboarding is completed
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (!profile || !profile.onboarding_completed) {
        navigate("/onboarding");
        setLoading(false);
        return;
      }

      setUser(authUser);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        checkAuth(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuth(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
};

export default AuthGuard;
