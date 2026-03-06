export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          balance: number
          currency: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: string
          balance?: number
          currency?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string
          balance?: number
          currency?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category: string
          amount: number
          period: string | null
          start_date: string | null
          end_date: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          category: string
          amount: number
          period?: string | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          amount?: number
          period?: string | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      net_worth_snapshots: {
        Row: {
          id: string
          user_id: string
          total: number
          snapshot_date: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          total: number
          snapshot_date?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          total?: number
          snapshot_date?: string
          created_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bank_connected: boolean | null
          bank_name: string | null
          basiq_user_id: string | null
          created_at: string
          display_name: string | null
          id: string
          monthly_income: number | null
          next_pay_date: string | null
          onboarding_completed: boolean
          pay_cycle_date: number | null
          pay_frequency: string | null
          personal_context: string | null
          saving_goal: string | null
          spending_concerns: string[] | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_connected?: boolean | null
          bank_name?: string | null
          basiq_user_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          monthly_income?: number | null
          next_pay_date?: string | null
          onboarding_completed?: boolean
          pay_cycle_date?: number | null
          pay_frequency?: string | null
          personal_context?: string | null
          saving_goal?: string | null
          spending_concerns?: string[] | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_connected?: boolean | null
          bank_name?: string | null
          basiq_user_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          monthly_income?: number | null
          next_pay_date?: string | null
          onboarding_completed?: boolean
          pay_cycle_date?: number | null
          pay_frequency?: string | null
          personal_context?: string | null
          saving_goal?: string | null
          spending_concerns?: string[] | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          created_at: string | null
          current_amount: number | null
          deadline: string | null
          icon: string | null
          id: string
          name: string
          target_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          icon?: string | null
          id?: string
          name: string
          target_amount: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          icon?: string | null
          id?: string
          name?: string
          target_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      scheduled_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: string
          category: string | null
          description: string | null
          merchant: string | null
          frequency: string
          next_date: string
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          type?: string
          category?: string | null
          description?: string | null
          merchant?: string | null
          frequency?: string
          next_date: string
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          type?: string
          category?: string | null
          description?: string | null
          merchant?: string | null
          frequency?: string
          next_date?: string
          is_active?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      scans: {
        Row: {
          created_at: string | null
          extracted_data: Json | null
          id: string
          image_url: string | null
          scan_type: string | null
          user_id: string
          verdict: string | null
          verdict_reason: string | null
        }
        Insert: {
          created_at?: string | null
          extracted_data?: Json | null
          id?: string
          image_url?: string | null
          scan_type?: string | null
          user_id: string
          verdict?: string | null
          verdict_reason?: string | null
        }
        Update: {
          created_at?: string | null
          extracted_data?: Json | null
          id?: string
          image_url?: string | null
          scan_type?: string | null
          user_id?: string
          verdict?: string | null
          verdict_reason?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          last_charged: string | null
          next_charge_date: string | null
          name: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          last_charged?: string | null
          next_charge_date?: string | null
          name: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          last_charged?: string | null
          next_charge_date?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          date: string
          description: string | null
          id: string
          is_subscription: boolean | null
          merchant: string | null
          receipt_url: string | null
          source: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          is_subscription?: boolean | null
          merchant?: string | null
          receipt_url?: string | null
          source?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          is_subscription?: boolean | null
          merchant?: string | null
          receipt_url?: string | null
          source?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
