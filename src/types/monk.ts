export interface MonkProfile {
  user_id: string;
  display_name: string;
  age: number | null;
  location: string;
  domain: string;
  industry: string;
  growth_aspect: string;
  onboarding_step: number;
}

export interface CoreGoal {
  id: string;
  horizon: "long_term" | "short_term";
  title: string;
  why_statement: string;
  target_hours: number;
  target_date: string;
}

export interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  due_date: string | null;
  is_completed: boolean;
}

export interface DailyActivity {
  id: string;
  goal_id: string;
  title: string;
  scheduled_time: string | null;
  daily_target_mins: number;
}

export interface WorkSession {
  id: string;
  activity_id: string;
  session_date: string;
  started_at: string | null;
  ended_at: string | null;
  duration_mins: number;
  status: "running" | "done" | "partly" | "skipped";
}
