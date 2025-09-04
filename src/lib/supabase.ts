import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key-for-demo-mode-testing';
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key-for-demo-mode-testing';

// Check if Supabase is configured
const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseServiceRoleKey &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey !== 'placeholder-anon-key-for-demo-mode-testing' &&
  supabaseServiceRoleKey !== 'placeholder-service-role-key-for-demo-mode-testing' &&
  supabaseUrl.includes('.supabase.co') &&
  supabaseAnonKey.length > 50 &&
  supabaseServiceRoleKey.length > 50
);

console.log('Supabase configuration check:', {
  url: supabaseUrl,
  anonKeyLength: supabaseAnonKey?.length,
  serviceKeyLength: supabaseServiceRoleKey?.length,
  isConfigured: isSupabaseConfigured
});

// Create Supabase client (with fallback for demo mode)
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

// Create admin client for user management
export const supabaseAdmin = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;
// Export demo mode status
export const isDemoMode = !isSupabaseConfigured;

console.log(`Application mode: ${isDemoMode ? 'DEMO' : 'PRODUCTION'}`);
console.log(`Supabase client: ${supabase ? 'READY' : 'NOT AVAILABLE'}`);

// Database types
export interface Database {
  public: {
    Tables: {
      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          level: number;
          is_active: boolean;
          menu_access: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          level?: number;
          is_active?: boolean;
          menu_access?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          level?: number;
          is_active?: boolean;
          menu_access?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          name: string;
          role_id: string;
          is_active: boolean;
          jurisdiction: string | null;
          zone: string | null;
          region: string | null;
          district: string | null;
          employee_id: string | null;
          phone_number: string | null;
          profile_image: string | null;
          parent_id: string | null;
          last_login: string | null;
          password_changed_at: string;
          failed_login_attempts: number;
          locked_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          name: string;
          role_id: string;
          is_active?: boolean;
          jurisdiction?: string | null;
          zone?: string | null;
          region?: string | null;
          district?: string | null;
          employee_id?: string | null;
          phone_number?: string | null;
          profile_image?: string | null;
          parent_id?: string | null;
          last_login?: string | null;
          password_changed_at?: string;
          failed_login_attempts?: number;
          locked_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          name?: string;
          role_id?: string;
          is_active?: boolean;
          jurisdiction?: string | null;
          zone?: string | null;
          region?: string | null;
          district?: string | null;
          employee_id?: string | null;
          phone_number?: string | null;
          profile_image?: string | null;
          parent_id?: string | null;
          last_login?: string | null;
          password_changed_at?: string;
          failed_login_attempts?: number;
          locked_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      surveys: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          target_date: string;
          duration: number;
          total_questions: number;
          passing_score: number;
          max_attempts: number;
          is_active: boolean;
          assigned_zones: string[] | null;
          assigned_regions: string[] | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          target_date: string;
          duration?: number;
          total_questions?: number;
          passing_score?: number;
          max_attempts?: number;
          is_active?: boolean;
          assigned_zones?: string[] | null;
          assigned_regions?: string[] | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          target_date?: string;
          duration?: number;
          total_questions?: number;
          passing_score?: number;
          max_attempts?: number;
          is_active?: boolean;
          assigned_zones?: string[] | null;
          assigned_regions?: string[] | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      test_sessions: {
        Row: {
          id: string;
          user_id: string;
          survey_id: string;
          start_time: string;
          end_time: string | null;
          time_remaining: number;
          current_question_index: number;
          session_status: string;
          attempt_number: number;
          score: number | null;
          is_passed: boolean | null;
          completed_at: string | null;
          pause_time: string | null;
          resume_time: string | null;
          total_pause_duration: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          survey_id: string;
          start_time?: string;
          end_time?: string | null;
          time_remaining: number;
          current_question_index?: number;
          session_status?: string;
          attempt_number?: number;
          score?: number | null;
          is_passed?: boolean | null;
          completed_at?: string | null;
          pause_time?: string | null;
          resume_time?: string | null;
          total_pause_duration?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          survey_id?: string;
          start_time?: string;
          end_time?: string | null;
          time_remaining?: number;
          current_question_index?: number;
          session_status?: string;
          attempt_number?: number;
          score?: number | null;
          is_passed?: boolean | null;
          completed_at?: string | null;
          pause_time?: string | null;
          resume_time?: string | null;
          total_pause_duration?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      test_results: {
        Row: {
          id: string;
          user_id: string;
          survey_id: string;
          session_id: string;
          score: number;
          total_questions: number;
          correct_answers: number;
          is_passed: boolean;
          time_spent: number;
          attempt_number: number;
          grade: string | null;
          completed_at: string;
          certificate_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          survey_id: string;
          session_id: string;
          score: number;
          total_questions: number;
          correct_answers: number;
          is_passed: boolean;
          time_spent: number;
          attempt_number: number;
          grade?: string | null;
          completed_at?: string;
          certificate_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          survey_id?: string;
          session_id?: string;
          score?: number;
          total_questions?: number;
          correct_answers?: number;
          is_passed?: boolean;
          time_spent?: number;
          attempt_number?: number;
          grade?: string | null;
          completed_at?: string;
          certificate_id?: string | null;
          created_at?: string;
        };
      };
      certificates: {
        Row: {
          id: string;
          user_id: string;
          survey_id: string;
          result_id: string;
          certificate_number: string;
          issued_at: string;
          valid_until: string | null;
          download_count: number;
          certificate_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          survey_id: string;
          result_id: string;
          certificate_number: string;
          issued_at?: string;
          valid_until?: string | null;
          download_count?: number;
          certificate_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          survey_id?: string;
          result_id?: string;
          certificate_number?: string;
          issued_at?: string;
          valid_until?: string | null;
          download_count?: number;
          certificate_status?: string;
          created_at?: string;
        };
      };
      system_settings: {
        Row: {
          id: string;
          category: string;
          setting_key: string;
          setting_value: string;
          description: string | null;
          setting_type: string;
          is_editable: boolean;
          options: string[] | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          category: string;
          setting_key: string;
          setting_value: string;
          description?: string | null;
          setting_type?: string;
          is_editable?: boolean;
          options?: string[] | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          category?: string;
          setting_key?: string;
          setting_value?: string;
          description?: string | null;
          setting_type?: string;
          is_editable?: boolean;
          options?: string[] | null;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
    };
  };
}