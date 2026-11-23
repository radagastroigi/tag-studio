-- Monkthetics TAG Studio v1.0 — Production PostgreSQL + Supabase Schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Builder',
  daily_focus_target_mins INT NOT NULL DEFAULT 120 CHECK (daily_focus_target_mins > 0),
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  streak_freezes_available INT NOT NULL DEFAULT 1,
  last_active_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  horizon TEXT NOT NULL DEFAULT '100 Days',
  target_minutes INT NOT NULL DEFAULT 2400 CHECK (target_minutes > 0),
  logged_minutes INT NOT NULL DEFAULT 0 CHECK (logged_minutes >= 0),
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  client_mutation_id UUID UNIQUE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  is_daily_focus BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  client_mutation_id UUID UNIQUE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  category TEXT NOT NULL DEFAULT 'Building' CHECK (category IN ('DSA', 'System Design', 'Building', 'AI & ML', 'Health', 'Other')),
  duration_mins INT NOT NULL CHECK (duration_mins BETWEEN 1 AND 720),
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_rollups (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rollup_date DATE NOT NULL,
  total_minutes INT NOT NULL DEFAULT 0,
  tasks_completed INT NOT NULL DEFAULT 0,
  session_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, rollup_date)
);

-- Composite & Partial Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_active
  ON public.tasks (user_id, is_done, scheduled_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_user_history
  ON public.tasks (user_id, completed_at DESC, id DESC)
  WHERE is_done = TRUE;

CREATE INDEX IF NOT EXISTS idx_activity_user_date
  ON public.activity_logs (user_id, logged_date DESC, category);

CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON public.goals (user_id, status, created_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Builder'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_activity_rollup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.goal_id IS NOT NULL THEN
    UPDATE public.goals
    SET logged_minutes = logged_minutes + NEW.duration_mins,
        updated_at = NOW()
    WHERE id = NEW.goal_id AND user_id = NEW.user_id;
  END IF;

  INSERT INTO public.daily_rollups (user_id, rollup_date, total_minutes, session_count)
  VALUES (NEW.user_id, NEW.logged_date, NEW.duration_mins, 1)
  ON CONFLICT (user_id, rollup_date)
  DO UPDATE SET
    total_minutes = public.daily_rollups.total_minutes + EXCLUDED.total_minutes,
    session_count = public.daily_rollups.session_count + 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_insert_rollup ON public.activity_logs;
CREATE TRIGGER trg_activity_insert_rollup
  AFTER INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.sync_activity_rollup();

-- Row-Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users manage own goals" ON public.goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own activity logs" ON public.activity_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own rollups" ON public.daily_rollups FOR SELECT USING (auth.uid() = user_id);