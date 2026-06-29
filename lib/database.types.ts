export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          has_set_password: boolean;
          monthly_budget: number;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          has_set_password?: boolean;
          monthly_budget?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          has_set_password?: boolean;
          monthly_budget?: number;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: 'fixed' | 'variable';
          icon: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: 'fixed' | 'variable';
          icon?: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: 'fixed' | 'variable';
          icon?: string;
          is_default?: boolean;
          created_at?: string;
        };
      };
      salary_entries: {
        Row: {
          id: string;
          user_id: string;
          job_name: string;
          amount: number;
          month: number;
          year: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_name: string;
          amount: number;
          month: number;
          year: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_name?: string;
          amount?: number;
          month?: number;
          year?: number;
          note?: string | null;
          created_at?: string;
        };
      };
      fixed_expenses: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          amount: number;
          category_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          amount: number;
          category_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          amount?: number;
          category_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          description: string;
          category_id: string | null;
          type: 'expense' | 'income';
          date: string;
          is_shared: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          description: string;
          category_id?: string | null;
          type: 'expense' | 'income';
          date?: string;
          is_shared?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          description?: string;
          category_id?: string | null;
          type?: 'expense' | 'income';
          date?: string;
          is_shared?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
      };
      budget_overrides: {
        Row: {
          id: string;
          user_id: string;
          month: number;
          year: number;
          week_number: number;
          original_amount: number;
          adjusted_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: number;
          year: number;
          week_number: number;
          original_amount: number;
          adjusted_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: number;
          year?: number;
          week_number?: number;
          original_amount?: number;
          adjusted_amount?: number;
          created_at?: string;
        };
      };
      savings_goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_amount: number;
          current_amount: number;
          deadline: string | null;
          icon: string;
          color: string;
          is_completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          target_amount: number;
          current_amount?: number;
          deadline?: string | null;
          icon?: string;
          color?: string;
          is_completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          target_amount?: number;
          current_amount?: number;
          deadline?: string | null;
          icon?: string;
          color?: string;
          is_completed?: boolean;
          created_at?: string;
        };
      };
      savings_entries: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          amount: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          amount: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          goal_id?: string;
          user_id?: string;
          amount?: number;
          note?: string | null;
          created_at?: string;
        };
      };
      households: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_by: string;
          settings: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string;
          invite_code: string;
          created_by: string;
          settings?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          created_by?: string;
          settings?: any;
          created_at?: string;
        };
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          role?: string;
          joined_at?: string;
        };
      };
      household_messages: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
        };
      };
      household_activity: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          type: string;
          data: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          type: string;
          data?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          type?: string;
          data?: any;
          created_at?: string;
        };
      };
      installment_plans: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          store: string;
          category_id: string | null;
          total_amount: number;
          down_payment: number;
          financed_amount: number;
          installment_count: number;
          installment_amount: number;
          payment_frequency: string;
          interest_type: string;
          tna: number | null;
          tea: number | null;
          tem: number | null;
          cft: number | null;
          amortization_system: string;
          start_date: string;
          end_date: string;
          status: string;
          notes: string;
          is_shared: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          store?: string;
          category_id?: string | null;
          total_amount: number;
          down_payment?: number;
          financed_amount: number;
          installment_count: number;
          installment_amount: number;
          payment_frequency?: string;
          interest_type?: string;
          tna?: number | null;
          tea?: number | null;
          tem?: number | null;
          cft?: number | null;
          amortization_system?: string;
          start_date: string;
          end_date: string;
          status?: string;
          notes?: string;
          is_shared?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          store?: string;
          category_id?: string | null;
          total_amount?: number;
          down_payment?: number;
          financed_amount?: number;
          installment_count?: number;
          installment_amount?: number;
          payment_frequency?: string;
          interest_type?: string;
          tna?: number | null;
          tea?: number | null;
          tem?: number | null;
          cft?: number | null;
          amortization_system?: string;
          start_date?: string;
          end_date?: string;
          status?: string;
          notes?: string;
          is_shared?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
      };
      installment_payments: {
        Row: {
          id: string;
          plan_id: string;
          user_id: string;
          installment_number: number;
          due_date: string;
          amount: number;
          capital_amount: number;
          interest_amount: number;
          iva_amount: number;
          status: string;
          paid_amount: number;
          paid_date: string | null;
          payment_method: string;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          user_id: string;
          installment_number: number;
          due_date: string;
          amount: number;
          capital_amount?: number;
          interest_amount?: number;
          iva_amount?: number;
          status?: string;
          paid_amount?: number;
          paid_date?: string | null;
          payment_method?: string;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          user_id?: string;
          installment_number?: number;
          due_date?: string;
          amount?: number;
          capital_amount?: number;
          interest_amount?: number;
          iva_amount?: number;
          status?: string;
          paid_amount?: number;
          paid_date?: string | null;
          payment_method?: string;
          notes?: string;
          created_at?: string;
        };
      };
    };
  };
}
