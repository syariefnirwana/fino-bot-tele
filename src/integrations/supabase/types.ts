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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          chat_id: number | null
          command: string | null
          created_at: string
          duration_ms: number | null
          id: string
          level: string
          message: string
          plugin_key: string | null
          telegram_id: number | null
          trace_id: string | null
        }
        Insert: {
          chat_id?: number | null
          command?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          level?: string
          message?: string
          plugin_key?: string | null
          telegram_id?: number | null
          trace_id?: string | null
        }
        Update: {
          chat_id?: number | null
          command?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          level?: string
          message?: string
          plugin_key?: string | null
          telegram_id?: number | null
          trace_id?: string | null
        }
        Relationships: []
      }
      api_providers: {
        Row: {
          base_url: string | null
          category: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          name: string
          priority: number
          secret_name: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          category?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          priority?: number
          secret_name?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          category?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          priority?: number
          secret_name?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          bot_name: string
          bot_username: string | null
          created_at: string
          default_language: string
          id: string
          maintenance_message: string
          maintenance_mode: boolean
          rate_limit_per_minute: number
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          bot_name?: string
          bot_username?: string | null
          created_at?: string
          default_language?: string
          id?: string
          maintenance_message?: string
          maintenance_mode?: boolean
          rate_limit_per_minute?: number
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          bot_name?: string
          bot_username?: string | null
          created_at?: string
          default_language?: string
          id?: string
          maintenance_message?: string
          maintenance_mode?: boolean
          rate_limit_per_minute?: number
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      plugin_versions: {
        Row: {
          code: string
          commands: string[]
          config: Json
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          plugin_id: string
          version: number
        }
        Insert: {
          code?: string
          commands?: string[]
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          plugin_id: string
          version: number
        }
        Update: {
          code?: string
          commands?: string[]
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          plugin_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plugin_versions_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      plugins: {
        Row: {
          category: string
          code: string
          code_updated_at: string | null
          commands: string[]
          config: Json
          created_at: string
          dependencies: string[]
          description: string
          enabled: boolean
          id: string
          is_core: boolean
          key: string
          name: string
          required_role: Database["public"]["Enums"]["app_role"]
          scope: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          category?: string
          code?: string
          code_updated_at?: string | null
          commands?: string[]
          config?: Json
          created_at?: string
          dependencies?: string[]
          description?: string
          enabled?: boolean
          id?: string
          is_core?: boolean
          key: string
          name: string
          required_role?: Database["public"]["Enums"]["app_role"]
          scope?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          category?: string
          code?: string
          code_updated_at?: string | null
          commands?: string[]
          config?: Json
          created_at?: string
          dependencies?: string[]
          description?: string
          enabled?: boolean
          id?: string
          is_core?: boolean
          key?: string
          name?: string
          required_role?: Database["public"]["Enums"]["app_role"]
          scope?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      telegram_groups: {
        Row: {
          chat_id: number
          chat_type: string
          created_at: string
          enabled: boolean
          id: string
          last_seen_at: string
          message_count: number
          title: string | null
        }
        Insert: {
          chat_id: number
          chat_type?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_seen_at?: string
          message_count?: number
          title?: string | null
        }
        Update: {
          chat_id?: number
          chat_type?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_seen_at?: string
          message_count?: number
          title?: string | null
        }
        Relationships: []
      }
      telegram_users: {
        Row: {
          banned: boolean
          created_at: string
          first_name: string | null
          id: string
          language_code: string | null
          last_name: string | null
          last_seen_at: string
          message_count: number
          role: Database["public"]["Enums"]["app_role"]
          telegram_id: number
          username: string | null
        }
        Insert: {
          banned?: boolean
          created_at?: string
          first_name?: string | null
          id?: string
          language_code?: string | null
          last_name?: string | null
          last_seen_at?: string
          message_count?: number
          role?: Database["public"]["Enums"]["app_role"]
          telegram_id: number
          username?: string | null
        }
        Update: {
          banned?: boolean
          created_at?: string
          first_name?: string | null
          id?: string
          language_code?: string | null
          last_name?: string | null
          last_seen_at?: string
          message_count?: number
          role?: Database["public"]["Enums"]["app_role"]
          telegram_id?: number
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "moderator" | "developer" | "user"
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
      app_role: ["owner", "admin", "moderator", "developer", "user"],
    },
  },
} as const
