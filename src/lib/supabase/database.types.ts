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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_data: Json
          event_type: string
          id: string
          trip_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          trip_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json
          trip_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json
          trip_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          page_path: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page_path: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page_path?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_feedback_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beta_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_shares: {
        Row: {
          amount_owed_cents: number
          created_at: string
          expense_id: string
          id: string
          trip_member_id: string
        }
        Insert: {
          amount_owed_cents: number
          created_at?: string
          expense_id: string
          id?: string
          trip_member_id: string
        }
        Update: {
          amount_owed_cents?: number
          created_at?: string
          expense_id?: string
          id?: string
          trip_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_shares_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_shares_trip_member_id_fkey"
            columns: ["trip_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          due_date: string | null
          expense_date: string | null
          id: string
          notes: string | null
          paid_by_member_id: string | null
          split_method: Database["public"]["Enums"]["split_method"]
          title: string
          total_amount_cents: number
          trip_id: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          expense_date?: string | null
          id?: string
          notes?: string | null
          paid_by_member_id?: string | null
          split_method?: Database["public"]["Enums"]["split_method"]
          title: string
          total_amount_cents: number
          trip_id: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          expense_date?: string | null
          id?: string
          notes?: string | null
          paid_by_member_id?: string | null
          split_method?: Database["public"]["Enums"]["split_method"]
          title?: string
          total_amount_cents?: number
          trip_id?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          paid_at: string
          payer_member_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          recipient_member_id: string | null
          reference_note: string | null
          reported_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          trip_id: string
        }
        Insert: {
          amount_cents: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          paid_at?: string
          payer_member_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          recipient_member_id?: string | null
          reference_note?: string | null
          reported_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          trip_id: string
        }
        Update: {
          amount_cents?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          paid_at?: string
          payer_member_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          recipient_member_id?: string | null
          reference_note?: string | null
          reported_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_member_id_fkey"
            columns: ["payer_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recipient_member_id_fkey"
            columns: ["recipient_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_payment_instructions: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_payment_instructions?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_payment_instructions?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trip_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          trip_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          trip_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_invitations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          trip_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          trip_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          trip_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          destination: string | null
          end_date: string | null
          id: string
          name: string
          owner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          destination?: string | null
          end_date?: string | null
          id?: string
          name: string
          owner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          destination?: string | null
          end_date?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_trip_invitation: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          trip_id: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "trip_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_payment: {
        Args: { p_payment_id: string }
        Returns: {
          amount_cents: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          paid_at: string
          payer_member_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          recipient_member_id: string | null
          reference_note: string | null
          reported_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          trip_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_expense_with_shares: {
        Args: {
          p_category?: Database["public"]["Enums"]["expense_category"]
          p_due_date?: string
          p_expense_date?: string
          p_notes?: string
          p_paid_by_member_id?: string
          p_shares: Json
          p_split_method?: Database["public"]["Enums"]["split_method"]
          p_title: string
          p_total_amount_cents: number
          p_trip_id: string
          p_vendor?: string
        }
        Returns: {
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          due_date: string | null
          expense_date: string | null
          id: string
          notes: string | null
          paid_by_member_id: string | null
          split_method: Database["public"]["Enums"]["split_method"]
          title: string
          total_amount_cents: number
          trip_id: string
          updated_at: string
          vendor: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_trip: {
        Args: {
          p_currency?: string
          p_description?: string
          p_destination?: string
          p_end_date?: string
          p_name: string
          p_start_date?: string
        }
        Returns: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          destination: string | null
          end_date: string | null
          id: string
          name: string
          owner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decline_trip_invitation: { Args: { p_token: string }; Returns: undefined }
      enforce_rate_limit: {
        Args: {
          p_event_type: string
          p_max_count: number
          p_trip_id: string
          p_window: string
        }
        Returns: undefined
      }
      get_invitation_preview: { Args: { p_token: string }; Returns: Json }
      invite_trip_member: {
        Args: {
          p_display_name: string
          p_email: string
          p_role?: Database["public"]["Enums"]["member_role"]
          p_trip_id: string
        }
        Returns: Json
      }
      is_trip_captain: { Args: { p_trip_id: string }; Returns: boolean }
      is_trip_member: { Args: { p_trip_id: string }; Returns: boolean }
      log_reminder_sent: {
        Args: {
          p_channel: string
          p_kind: string
          p_target_member_id?: string
          p_tone: string
          p_trip_id: string
        }
        Returns: undefined
      }
      reject_payment: {
        Args: { p_payment_id: string; p_reason?: string }
        Returns: {
          amount_cents: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          paid_at: string
          payer_member_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          recipient_member_id: string | null
          reference_note: string | null
          reported_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          trip_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resend_trip_invitation: {
        Args: { p_trip_member_id: string }
        Returns: Json
      }
      revoke_trip_invitation: {
        Args: { p_trip_member_id: string }
        Returns: undefined
      }
      set_trip_member_role: {
        Args: {
          p_role: Database["public"]["Enums"]["member_role"]
          p_trip_member_id: string
        }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          trip_id: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "trip_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shares_active_trip_with: {
        Args: { p_other_user_id: string }
        Returns: boolean
      }
      transfer_trip_ownership: {
        Args: { p_new_owner_trip_member_id: string; p_trip_id: string }
        Returns: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          destination: string | null
          end_date: string | null
          id: string
          name: string
          owner_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_expense_with_shares: {
        Args: {
          p_category?: Database["public"]["Enums"]["expense_category"]
          p_due_date?: string
          p_expense_date?: string
          p_expense_id: string
          p_notes?: string
          p_paid_by_member_id?: string
          p_shares: Json
          p_split_method?: Database["public"]["Enums"]["split_method"]
          p_title: string
          p_total_amount_cents: number
          p_vendor?: string
        }
        Returns: {
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          due_date: string | null
          expense_date: string | null
          id: string
          notes: string | null
          paid_by_member_id: string | null
          split_method: Database["public"]["Enums"]["split_method"]
          title: string
          total_amount_cents: number
          trip_id: string
          updated_at: string
          vendor: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      expense_category:
        | "lodging"
        | "golf"
        | "transportation"
        | "food"
        | "merchandise"
        | "activity"
        | "other"
      invitation_status: "pending" | "accepted" | "declined" | "revoked"
      member_role: "captain" | "member"
      member_status: "invited" | "active" | "declined" | "removed"
      payment_method: "venmo" | "zelle" | "paypal" | "cash" | "check" | "other"
      payment_status: "reported" | "confirmed" | "rejected"
      split_method: "equal" | "selected" | "custom"
      trip_status: "planning" | "active" | "completed" | "cancelled"
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
    Enums: {
      expense_category: [
        "lodging",
        "golf",
        "transportation",
        "food",
        "merchandise",
        "activity",
        "other",
      ],
      invitation_status: ["pending", "accepted", "declined", "revoked"],
      member_role: ["captain", "member"],
      member_status: ["invited", "active", "declined", "removed"],
      payment_method: ["venmo", "zelle", "paypal", "cash", "check", "other"],
      payment_status: ["reported", "confirmed", "rejected"],
      split_method: ["equal", "selected", "custom"],
      trip_status: ["planning", "active", "completed", "cancelled"],
    },
  },
} as const
