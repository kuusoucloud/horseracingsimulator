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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      horses: {
        Row: {
          created_at: string | null
          elo: number
          id: string
          name: string
          recent_form: number[]
          total_races: number
          updated_at: string | null
          velocity: number | null
          wins: number
        }
        Insert: {
          created_at?: string | null
          elo?: number
          id?: string
          name: string
          recent_form?: number[]
          total_races?: number
          updated_at?: string | null
          velocity?: number | null
          wins?: number
        }
        Update: {
          created_at?: string | null
          elo?: number
          id?: string
          name?: string
          recent_form?: number[]
          total_races?: number
          updated_at?: string | null
          velocity?: number | null
          wins?: number
        }
        Relationships: []
      }
      race_control: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_tick: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_tick?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_tick?: string | null
        }
        Relationships: []
      }
      race_state: {
        Row: {
          countdown_start_time: string | null
          countdown_timer: number | null
          created_at: string | null
          finish_timer: number | null
          horses: Json
          id: string
          last_update_time: string | null
          photo_finish_results: Json | null
          pre_race_timer: number
          race_progress: Json
          race_results: Json
          race_start_time: string | null
          race_state: string
          race_timer: number | null
          show_photo_finish: boolean | null
          show_results: boolean | null
          timer_owner: string | null
          updated_at: string | null
          weather_conditions: Json | null
        }
        Insert: {
          countdown_start_time?: string | null
          countdown_timer?: number | null
          created_at?: string | null
          finish_timer?: number | null
          horses?: Json
          id?: string
          last_update_time?: string | null
          photo_finish_results?: Json | null
          pre_race_timer?: number
          race_progress?: Json
          race_results?: Json
          race_start_time?: string | null
          race_state?: string
          race_timer?: number | null
          show_photo_finish?: boolean | null
          show_results?: boolean | null
          timer_owner?: string | null
          updated_at?: string | null
          weather_conditions?: Json | null
        }
        Update: {
          countdown_start_time?: string | null
          countdown_timer?: number | null
          created_at?: string | null
          finish_timer?: number | null
          horses?: Json
          id?: string
          last_update_time?: string | null
          photo_finish_results?: Json | null
          pre_race_timer?: number
          race_progress?: Json
          race_results?: Json
          race_start_time?: string | null
          race_state?: string
          race_timer?: number | null
          show_photo_finish?: boolean | null
          show_results?: boolean | null
          timer_owner?: string | null
          updated_at?: string | null
          weather_conditions?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_race_state: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      calculate_elo_change: {
        Args: {
          current_elo: number
          opponent_avg_elo: number
          placement: number
          total_horses: number
        }
        Returns: number
      }
      generate_race_horses: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      race_tick: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      start_new_race: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      trigger_race_tick: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_horse_elo_after_race: {
        Args: { race_results: Json }
        Returns: undefined
      }
      update_race_state_high_frequency: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_race_tick: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
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
