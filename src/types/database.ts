export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          display_name: string | null
          role: 'user' | 'admin' | 'moderator' | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          display_name?: string | null
          role?: 'user' | 'admin' | 'moderator' | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          display_name?: string | null
          role?: 'user' | 'admin' | 'moderator' | null
          created_at?: string
        }
      }
      teachers: {
        Row: {
          id: string
          name: string
          institute: string | null
          department: string | null
          designation: string
          city: string
          linkedin_url: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          // Denormalized rating stats, maintained by a DB trigger (migration 012)
          avg_rating: number | null
          ratings_count: number
        }
        Insert: {
          id?: string
          name: string
          institute?: string | null
          department?: string | null
          designation: string
          city: string
          linkedin_url?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          institute?: string | null
          department?: string | null
          designation?: string
          city?: string
          linkedin_url?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
        }
      }
      ratings: {
        Row: {
          id: string
          teacher_id: string | null
          student_id: string | null
          score: number | null
          comment: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          teacher_id?: string | null
          student_id?: string | null
          score?: number | null
          comment?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          teacher_id?: string | null
          student_id?: string | null
          score?: number | null
          comment?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
    }
    Views: {
      teacher_aggregates: {
        Row: {
          teacher_id: string | null
          avg_rating: number | null
          ratings_count: number | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}