-- Profiles (user metadata)
create table if not exists profiles (
  id uuid primary key,
  email text,
  display_name text,
  role text check (role in ('student','teacher')),
  created_at timestamptz default now()
);

-- Teachers
create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institute text,
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);

-- Ratings
create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade,
  student_id uuid references profiles(id) on delete set null,
  score int check (score >= 1 and score <= 5),
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Unique constraint to prevent duplicate rating rows (teacher_id + student_id)
create unique index if not exists ratings_teacher_student_unique on ratings(teacher_id, student_id);

-- Trigger to update updated_at
create or replace function trg_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end$$ language plpgsql;

create trigger set_updated_at before update on ratings for each row execute function trg_set_updated_at();

-- Aggregates view (server-side averages)
create or replace view teacher_aggregates as
select
  teacher_id,
  avg(score)::numeric(3,2) as avg_rating,
  count(*) as ratings_count
from ratings
group by teacher_id;