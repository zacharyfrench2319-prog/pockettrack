import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("amount", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, monthly_income, bank_connected, bank_name, saving_goal, pay_frequency, next_pay_date, spending_concerns, personal_context")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from("budgets")
        .select("category, amount")
        .eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useScheduledTransactions() {
  return useQuery({
    queryKey: ["scheduled_transactions"],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from("scheduled_transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("next_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  return (...keys: string[]) => {
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };
}
