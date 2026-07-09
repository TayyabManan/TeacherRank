export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  full_name?: string;
  role: 'user' | 'admin' | 'moderator';
  created_at: string;
}

export interface Teacher {
  id: string;
  name: string;
  institute: string;
  department?: string | null;
  designation: string;
  city: string;
  linkedin_url?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at: string;
}

export interface TeacherWithStats extends Teacher {
  average_rating?: number | null;
  ratings_count?: number;
}

export interface Rating {
  id: string;
  teacher_id: string;
  student_id?: string | null;
  score: number;
  comment?: string;
  created_at: string;
  updated_at?: string;
}

export interface RatingWithRelations extends Rating {
  teacher?: Teacher;
  student?: Profile;
}

export interface TeacherAggregate {
  teacher_id: string;
  avg_rating: number;
  ratings_count: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}