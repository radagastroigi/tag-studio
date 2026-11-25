-- 1. Goal Target & Deadline for Real ETA & Efficiency Estimation
ALTER TABLE public.monk_goals
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS target_total_value NUMERIC(12,2) NOT NULL DEFAULT 100 CHECK (target_total_value > 0),
  ADD COLUMN IF NOT EXISTS metric_unit TEXT NOT NULL DEFAULT 'hours'; -- hours | count | sessions | km

-- 2. Time-Based OR Count-Based OR Timeless Activities (International SI Storage)
ALTER TABLE public.monk_habits
  ALTER COLUMN scheduled_time DROP NOT NULL, -- NULL = Timeless / Anytime activity!
  ADD COLUMN IF NOT EXISTS time_slot TEXT NOT NULL DEFAULT 'anytime'
    CHECK (time_slot IN ('morning', 'afternoon', 'evening', 'anytime', 'custom')),
  ADD COLUMN IF NOT EXISTS tracking_type TEXT NOT NULL DEFAULT 'time'
    CHECK (tracking_type IN ('time', 'count', 'binary')),
  ADD COLUMN IF NOT EXISTS unit_code TEXT NOT NULL DEFAULT 's'
    CHECK (unit_code IN ('s', 'min', 'hr', 'count', 'reps', 'problems', 'pages', 'm', 'km', 'g', 'kg')),
  ADD COLUMN IF NOT EXISTS daily_target_value NUMERIC(12,2) NOT NULL DEFAULT 1800 CHECK (daily_target_value > 0);
  -- Example: 30 min = tracking_type='time', unit_code='s', daily_target_value=1800
  -- Example: 15 pushups = tracking_type='count', unit_code='reps', daily_target_value=15

-- 3. Precision Check-In Ledger (Exact SI Value + Efficiency Ratio)
ALTER TABLE public.monk_checkins
  ADD COLUMN IF NOT EXISTS actual_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (actual_value >= 0),
  ADD COLUMN IF NOT EXISTS target_value_snapshot NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (target_value_snapshot > 0),
  ADD COLUMN IF NOT EXISTS efficiency_pct SMALLINT GENERATED ALWAYS AS (
    LEAST(200, ROUND((actual_value / NULLIF(target_value_snapshot, 0)) * 100))::SMALLINT
  ) STORED;

-- 4. Flexible Evaluations (Weekly | Monthly | Ad-Hoc — Never Daily)
ALTER TABLE public.monk_weekly_reviews
  DROP CONSTRAINT IF EXISTS monk_weekly_reviews_user_id_week_start_key,
  ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT 'weekly'
    CHECK (cadence IN ('weekly', 'monthly', 'adhoc')),
  ADD COLUMN IF NOT EXISTS period_end DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_monk_reviews_user_period
  ON public.monk_weekly_reviews (user_id, cadence, created_at DESC);

-- 5. Pre-Aggregated Daily Rollup Table for Instant Progress Cards & Charts
CREATE TABLE IF NOT EXISTS public.monk_daily_rollups (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.monk_goals(id) ON DELETE CASCADE,
  rollup_date DATE NOT NULL,
  showed_up_count INT NOT NULL DEFAULT 0,
  total_time_secs INT NOT NULL DEFAULT 0,
  total_count_units NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_efficiency_pct SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, goal_id, rollup_date)
);

ALTER TABLE public.monk_daily_rollups ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'monk_daily_rollups' AND policyname = 'Own rollups'
  ) THEN
    CREATE POLICY "Own rollups" ON public.monk_daily_rollups FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;