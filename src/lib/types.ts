export type Priority = "high" | "medium" | "low";
export type Category = "DSA" | "System Design" | "Building" | "AI & ML" | "Health" | "Other";

export interface Goal {
  id: string;
  title: string;
  horizon: string;
  target_minutes: number;
  logged_minutes: number;
  target_date: string | null;
  status: "active" | "completed" | "archived";
}

export interface Task {
  id: string;
  goal_id: string | null;
  title: string;
  priority: Priority;
  is_daily_focus: boolean;
  scheduled_date: string;
  is_done: boolean;
  completed_at: string | null;
}

export interface ActivityLog {
  id: string;
  goal_id: string | null;
  task_id: string | null;
  title: string;
  category: Category;
  duration_mins: number;
  logged_date: string;
}

export interface DailyRollup {
  rollup_date: string;
  total_minutes: number;
  tasks_completed: number;
  session_count: number;
}