export interface GoalItem {
  id: string;
  title: string;
  why: string;
  targetHours: number;
  deadline: string; // YYYY-MM-DD
}

export interface DailyActivityItem {
  id: string;
  goalId: string;
  title: string;
  dailyTargetMins: number;
  xpMultiplier: number; // 1 | 1.5 | 2
}

export interface MilestoneTaskItem {
  id: string;
  goalId: string;
  title: string;
  done: boolean;
}

export interface TimeLogItem {
  id: string;
  goalId: string;
  activityId: string;
  minutes: number;
  date: string; // YYYY-MM-DD
  xp: number;
}

export interface GoalPaceMetrics {
  loggedMins: number;
  targetMins: number;
  remainingMins: number;
  pct: number;
  daysRemaining: number;
  requiredPerDay: number;
  avgPerDay: number;
  status: "Achieved" | "Ahead of Pace" | "On Track" | "At Risk";
}

export function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeGoalPace(goal: GoalItem, logs: TimeLogItem[]): GoalPaceMetrics {
  const goalLogs = logs.filter((l) => l.goalId === goal.id);
  const loggedMins = goalLogs.reduce((s, l) => s + l.minutes, 0);
  const targetMins = Math.max(60, goal.targetHours * 60);
  const remainingMins = Math.max(0, targetMins - loggedMins);
  const pct = Math.min(100, Math.round((loggedMins / targetMins) * 100));

  const today = new Date(isoOffset(0) + "T00:00:00");
  const end = new Date((goal.deadline || isoOffset(60)) + "T00:00:00");
  const daysRemaining = Math.max(1, Math.ceil((end.getTime() - today.getTime()) / 86400000));
  const requiredPerDay = Math.ceil(remainingMins / daysRemaining);

  const last7 = new Set(Array.from({ length: 7 }, (_, i) => isoOffset(-i)));
  const last7Mins = goalLogs
    .filter((l) => last7.has(l.date))
    .reduce((s, l) => s + l.minutes, 0);
  const avgPerDay = Math.round(last7Mins / 7);

  let status: GoalPaceMetrics["status"] = "On Track";
  if (remainingMins === 0) status = "Achieved";
  else if (avgPerDay >= requiredPerDay * 1.1) status = "Ahead of Pace";
  else if (avgPerDay < requiredPerDay * 0.85) status = "At Risk";

  return { loggedMins, targetMins, remainingMins, pct, daysRemaining, requiredPerDay, avgPerDay, status };
}