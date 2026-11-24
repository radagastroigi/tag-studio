-- Run this once in Supabase -> SQL Editor (safe, additive migration)
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS why TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS public.daily_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  daily_target_mins INT NOT NULL DEFAULT 30 CHECK (daily_target_mins BETWEEN 5 AND 480),
  xp_multiplier NUMERIC(3,1) NOT NULL DEFAULT 1.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.daily_activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS xp_earned INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_daily_activities_user_goal
  ON public.daily_activities (user_id, goal_id, created_at ASC);

ALTER TABLE public.daily_activities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_activities' AND policyname = 'Users manage own daily activities'
  ) THEN
    CREATE POLICY "Users manage own daily activities"
      ON public.daily_activities FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;