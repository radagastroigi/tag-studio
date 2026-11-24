<#
.SYNOPSIS
  Monkthetics TAG Studio v2.0 — Drop-in Upgrade to Goal Execution Studio
.DESCRIPTION
  Run inside your existing tag-studio project root (e.g., E:\AI_ML_COURSE\projects\tag-studio).
  Upgrades src/ with the full Goal -> Daily Activities -> Live Time Capture & Pace Engine.
  Does NOT touch .env.local, node_modules, or package.json.
#>

$ErrorActionPreference = "Stop"

function Write-ProjectFile {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Content
    )
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $Path), $Content.TrimStart("`r", "`n"), $utf8NoBom)
    Write-Host "  [+] Updated $Path" -ForegroundColor Green
}

Write-Host "`n=== Upgrading TAG Studio -> Goal Execution Studio (v2.0) ===" -ForegroundColor Cyan

# 1. Additive Supabase Migration (Safe to run on existing DB)
Write-ProjectFile -Path "supabase/upgrade_v2.sql" -Content @'
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
'@

# 2. src/lib/tagTypes.ts
Write-ProjectFile -Path "src/lib/tagTypes.ts" -Content @'
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
'@

# 3. src/components/GoalExecutionStudio.tsx
Write-ProjectFile -Path "src/components/GoalExecutionStudio.tsx" -Content @'
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Play,
  Pause,
  Square,
  Flame,
  Target,
  BarChart3,
  CheckCircle2,
  Download,
  Upload,
  LogOut,
  Trash2,
  ShieldCheck,
  X,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  isoOffset,
  computeGoalPace,
  type GoalItem,
  type DailyActivityItem,
  type MilestoneTaskItem,
  type TimeLogItem,
} from "@/lib/tagTypes";

const LOCAL_STORAGE_KEY = "monkthetics_goal_execution_v2";

const SEED_GOALS: GoalItem[] = [
  {
    id: "g1",
    title: "Crack Tier-1 Backend & AI Role",
    why: "Master systems fundamentals & step up compensation",
    targetHours: 100,
    deadline: isoOffset(65),
  },
  {
    id: "g2",
    title: "Ship Monkthetics Flagship Product",
    why: "Build a real, revenue-generating software company",
    targetHours: 60,
    deadline: isoOffset(45),
  },
];

const SEED_ACTIVITIES: DailyActivityItem[] = [
  { id: "act1", goalId: "g1", title: "Zero-AI DSA & Complexity Drill", dailyTargetMins: 45, xpMultiplier: 1.5 },
  { id: "act2", goalId: "g1", title: "System Design & SQL Internals", dailyTargetMins: 40, xpMultiplier: 2 },
  { id: "act3", goalId: "g1", title: "Applied AI & ML Evaluation", dailyTargetMins: 30, xpMultiplier: 1.5 },
  { id: "act4", goalId: "g2", title: "Production Code & Architecture Build", dailyTargetMins: 60, xpMultiplier: 2 },
  { id: "act5", goalId: "g2", title: "User Discovery & Product Polish", dailyTargetMins: 30, xpMultiplier: 1 },
];

const SEED_TASKS: MilestoneTaskItem[] = [
  { id: "t1", goalId: "g1", title: "Implement Sharded LRU Cache in C#", done: true },
  { id: "t2", goalId: "g1", title: "Master URL Shortener Base62 + Redis Flow", done: true },
  { id: "t3", goalId: "g1", title: "Score 75+ on Zero-AI Exam #2", done: false },
  { id: "t4", goalId: "g2", title: "Launch TAG Studio v2.0 Live on Vercel", done: false },
];

const SEED_LOGS: TimeLogItem[] = [
  { id: "l1", goalId: "g1", activityId: "act1", minutes: 45, date: isoOffset(0), xp: 68 },
  { id: "l2", goalId: "g1", activityId: "act2", minutes: 40, date: isoOffset(0), xp: 80 },
  { id: "l3", goalId: "g1", activityId: "act1", minutes: 50, date: isoOffset(-1), xp: 75 },
  { id: "l4", goalId: "g2", activityId: "act4", minutes: 90, date: isoOffset(-1), xp: 180 },
  { id: "l5", goalId: "g1", activityId: "act2", minutes: 60, date: isoOffset(-2), xp: 120 },
  { id: "l6", goalId: "g1", activityId: "act1", minutes: 45, date: isoOffset(-3), xp: 68 },
  { id: "l7", goalId: "g2", activityId: "act4", minutes: 75, date: isoOffset(-4), xp: 150 },
];

type ViewTab = "execute" | "dashboard" | "goals";

export function GoalExecutionStudio() {
  const supabase = useMemo(() => createClient(), []);
  const cloudConfigured = isSupabaseConfigured();

  const [userId, setUserId] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [tab, setTab] = useState<ViewTab>("execute");
  const [activeGoalId, setActiveGoalId] = useState<string>("g1");

  const [goals, setGoals] = useState<GoalItem[]>(SEED_GOALS);
  const [activities, setActivities] = useState<DailyActivityItem[]>(SEED_ACTIVITIES);
  const [tasks, setTasks] = useState<MilestoneTaskItem[]>(SEED_TASKS);
  const [logs, setLogs] = useState<TimeLogItem[]>(SEED_LOGS);

  // Modals & Forms
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [actModalOpen, setActModalOpen] = useState(false);
  const [ngTitle, setNgTitle] = useState("");
  const [ngWhy, setNgWhy] = useState("");
  const [ngHours, setNgHours] = useState(80);
  const [ngDeadline, setNgDeadline] = useState(isoOffset(60));

  const [naGoalId, setNaGoalId] = useState("g1");
  const [naTitle, setNaTitle] = useState("");
  const [naMins, setNaMins] = useState(45);
  const [naTier, setNaTier] = useState(1.5);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Live Stopwatch
  const [timingActId, setTimingActId] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(msg: string) {
    setToastMsg(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToastMsg(null), 2400);
  }

  // Load local first, then hydrate from Supabase if signed in & schema upgraded
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.goals) && p.goals.length) {
          setGoals(p.goals);
          setActiveGoalId(p.activeGoalId || p.goals[0].id);
        }
        if (Array.isArray(p.activities)) setActivities(p.activities);
        if (Array.isArray(p.tasks)) setTasks(p.tasks);
        if (Array.isArray(p.logs)) setLogs(p.logs);
      }
    } catch {}

    if (!cloudConfigured) return;

    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) return;
      setUserId(u.id);
      const [gRes, aRes, tRes, lRes] = await Promise.all([
        supabase.from("goals").select("*").order("created_at", { ascending: false }),
        supabase.from("daily_activities").select("*").order("created_at", { ascending: true }),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("activity_logs").select("*").order("logged_date", { ascending: false }).limit(250),
      ]);
      if (!aRes.error) {
        setCloudReady(true);
        if (gRes.data && gRes.data.length > 0) {
          const mappedGoals: GoalItem[] = gRes.data.map((r) => ({
            id: r.id,
            title: r.title,
            why: r.why || "",
            targetHours: Math.max(1, Math.round((r.target_minutes || 2400) / 60)),
            deadline: r.target_date || isoOffset(60),
          }));
          setGoals(mappedGoals);
          setActiveGoalId(mappedGoals[0].id);
        }
        if (aRes.data && aRes.data.length > 0) {
          setActivities(
            aRes.data.map((r) => ({
              id: r.id,
              goalId: r.goal_id,
              title: r.title,
              dailyTargetMins: r.daily_target_mins,
              xpMultiplier: Number(r.xp_multiplier || 1.5),
            }))
          );
        }
        if (tRes.data && tRes.data.length > 0) {
          setTasks(
            tRes.data.map((r) => ({
              id: r.id,
              goalId: r.goal_id || "",
              title: r.title,
              done: Boolean(r.is_done),
            }))
          );
        }
        if (lRes.data && lRes.data.length > 0) {
          setLogs(
            lRes.data.map((r) => ({
              id: r.id,
              goalId: r.goal_id || "",
              activityId: r.activity_id || "",
              minutes: r.duration_mins,
              date: r.logged_date,
              xp: r.xp_earned || r.duration_mins,
            }))
          );
        }
      }
    });
  }, [cloudConfigured, supabase]);

  // Persist to localStorage automatically
  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ activeGoalId, goals, activities, tasks, logs })
      );
    } catch {}
  }, [activeGoalId, goals, activities, tasks, logs]);

  // Stopwatch tick
  useEffect(() => {
    if (!timerRunning || !timingActId) return;
    const id = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning, timingActId]);

  const scopedActs = useMemo(
    () => (activeGoalId === "ALL" ? activities : activities.filter((a) => a.goalId === activeGoalId)),
    [activities, activeGoalId]
  );
  const scopedLogs = useMemo(
    () => (activeGoalId === "ALL" ? logs : logs.filter((l) => l.goalId === activeGoalId)),
    [logs, activeGoalId]
  );
  const scopedTasks = useMemo(
    () => (activeGoalId === "ALL" ? tasks : tasks.filter((t) => t.goalId === activeGoalId)),
    [tasks, activeGoalId]
  );

  // Builder XP & Streak
  const builderStats = useMemo(() => {
    const totalXp =
      logs.reduce((s, l) => s + (l.xp || l.minutes), 0) +
      tasks.filter((t) => t.done).length * 40;
    const level = Math.floor(totalXp / 250) + 1;
    const xpInLevel = totalXp % 250;

    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const iso = isoOffset(-i);
      const mins = logs.filter((l) => l.date === iso).reduce((s, l) => s + l.minutes, 0);
      if (mins >= 30) streak++;
      else if (i === 0) continue;
      else break;
    }
    return { totalXp, level, xpInLevel, streak };
  }, [logs, tasks]);

  const todayIso = isoOffset(0);
  const todayTargetMins = scopedActs.reduce((s, a) => s + a.dailyTargetMins, 0);
  const todayLoggedMins = scopedLogs
    .filter((l) => l.date === todayIso)
    .reduce((s, l) => s + l.minutes, 0);
  const todayHitPct = todayTargetMins
    ? Math.min(100, Math.round((todayLoggedMins / todayTargetMins) * 100))
    : 0;

  async function logMinutes(activityId: string, minutes: number) {
    const act = activities.find((a) => a.id === activityId);
    if (!act) return;
    const xp = Math.round(minutes * act.xpMultiplier);
    const tempId = crypto.randomUUID();
    const entry: TimeLogItem = {
      id: tempId,
      goalId: act.goalId,
      activityId: act.id,
      minutes,
      date: todayIso,
      xp,
    };
    setLogs((prev) => [entry, ...prev]);
    notify(`Captured ${minutes}m (+${xp} XP)`);

    if (userId && cloudReady) {
      await supabase.from("activity_logs").insert({
        user_id: userId,
        goal_id: act.goalId,
        activity_id: act.id,
        title: act.title,
        category: "Building",
        duration_mins: minutes,
        logged_date: todayIso,
        xp_earned: xp,
        client_mutation_id: tempId,
      });
    }
  }

  function startTimer(activityId: string) {
    setTimingActId(activityId);
    setElapsedSecs(0);
    setTimerRunning(true);
    const act = activities.find((a) => a.id === activityId);
    if (act) notify(`Timing: ${act.title}`);
  }

  function stopAndSaveTimer() {
    if (!timingActId) return;
    const mins = Math.max(1, Math.round(elapsedSecs / 60) || 1);
    logMinutes(timingActId, mins);
    setTimerRunning(false);
    setTimingActId(null);
    setElapsedSecs(0);
  }

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!ngTitle.trim()) return;
    const id = crypto.randomUUID();
    const newGoal: GoalItem = {
      id,
      title: ngTitle.trim(),
      why: ngWhy.trim(),
      targetHours: Math.max(5, ngHours),
      deadline: ngDeadline || isoOffset(60),
    };
    setGoals((prev) => [...prev, newGoal]);
    setActiveGoalId(id);
    setNgTitle("");
    setNgWhy("");
    setGoalModalOpen(false);
    notify("Goal created — now add its daily activities");

    if (userId && cloudReady) {
      await supabase.from("goals").insert({
        id,
        user_id: userId,
        title: newGoal.title,
        why: newGoal.why,
        target_minutes: newGoal.targetHours * 60,
        target_date: newGoal.deadline,
      });
    }
  }

  async function handleCreateActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!naTitle.trim() || !naGoalId) return;
    const id = crypto.randomUUID();
    const item: DailyActivityItem = {
      id,
      goalId: naGoalId,
      title: naTitle.trim(),
      dailyTargetMins: Math.max(5, naMins),
      xpMultiplier: naTier,
    };
    setActivities((prev) => [...prev, item]);
    setNaTitle("");
    setActModalOpen(false);
    notify("Daily activity added");

    if (userId && cloudReady) {
      await supabase.from("daily_activities").insert({
        id,
        user_id: userId,
        goal_id: item.goalId,
        title: item.title,
        daily_target_mins: item.dailyTargetMins,
        xp_multiplier: item.xpMultiplier,
      });
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const goalId = activeGoalId === "ALL" ? goals[0]?.id || "" : activeGoalId;
    const id = crypto.randomUUID();
    const t: MilestoneTaskItem = { id, goalId, title: newTaskTitle.trim(), done: false };
    setTasks((prev) => [t, ...prev]);
    setNewTaskTitle("");
    notify("Milestone added");

    if (userId && cloudReady) {
      await supabase.from("tasks").insert({
        id,
        user_id: userId,
        goal_id: goalId || null,
        title: t.title,
        is_done: false,
      });
    }
  }

  async function toggleTask(id: string) {
    const found = tasks.find((t) => t.id === id);
    if (!found) return;
    const next = !found.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: next } : t)));
    notify(next ? "Milestone shipped (+40 XP)" : "Milestone reopened");
    if (userId && cloudReady) {
      await supabase.from("tasks").update({ is_done: next }).eq("id", id);
    }
  }

  async function deleteGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setActivities((prev) => prev.filter((a) => a.goalId !== id));
    setTasks((prev) => prev.filter((t) => t.goalId !== id));
    if (activeGoalId === id) setActiveGoalId("ALL");
    if (userId && cloudReady) await supabase.from("goals").delete().eq("id", id);
    notify("Goal removed");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ activeGoalId, goals, activities, tasks, logs }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monkthetics-tag-backup-${todayIso}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Backup downloaded");
  }

  function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(String(reader.result));
        if (Array.isArray(p.goals) && Array.isArray(p.activities) && Array.isArray(p.logs)) {
          setGoals(p.goals);
          setActivities(p.activities);
          setTasks(Array.isArray(p.tasks) ? p.tasks : []);
          setLogs(p.logs);
          setActiveGoalId(p.activeGoalId || p.goals[0]?.id || "ALL");
          notify("Backup restored");
        }
      } catch {
        notify("Invalid JSON file");
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  async function signInGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUserId(null);
    setCloudReady(false);
    notify("Signed out");
  }

  // Selected goal pace banner
  const activeGoal = activeGoalId === "ALL" ? null : goals.find((g) => g.id === activeGoalId) || null;
  const activePace = activeGoal ? computeGoalPace(activeGoal, logs) : null;

  // Dashboard 7-day bars
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = isoOffset(-(6 - i));
    const mins = scopedLogs.filter((l) => l.date === date).reduce((s, l) => s + l.minutes, 0);
    const label = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
    return { date, label, mins };
  });
  const maxBar = Math.max(todayTargetMins || 60, ...last7.map((d) => d.mins), 60);

  const timingAct = activities.find((a) => a.id === timingActId);
  const mm = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
  const ss = String(elapsedSecs % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-[#F5F6F4] text-[#161F1C] pb-24 sm:pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-[#E1E6E3]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#161F1C] text-white flex items-center justify-center font-bold text-sm">
              TAG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">Goal Execution Studio</h1>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E8F2EE] text-[#256453]">
                  Lv {builderStats.level} · {builderStats.totalXp} XP
                </span>
              </div>
              <p className="text-xs text-[#5A6762]">
                {cloudReady ? "Cloud Synced" : "Instant Local Sync"} · Pick Goal → Execute Daily Activities · Monkthetics
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <nav className="hidden sm:flex items-center gap-1 bg-[#E8EDE9] p-1 rounded-xl">
              {(
                [
                  ["execute", "Daily Execution"],
                  ["dashboard", "Dashboard"],
                  ["goals", "Goals & Setup"],
                ] as [ViewTab, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    tab === k ? "bg-[#161F1C] text-white" : "text-[#4D5A55] hover:text-[#161F1C]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={exportJson}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-[#D8DFDB] bg-white hover:bg-[#EFF2F0] flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Backup
            </button>
            <label className="px-3 py-2 text-xs font-medium rounded-xl border border-[#D8DFDB] bg-white hover:bg-[#EFF2F0] cursor-pointer flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Restore
              <input type="file" accept="application/json" onChange={importJson} className="hidden" />
            </label>
            {cloudConfigured && !userId && (
              <button
                type="button"
                onClick={signInGoogle}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-[#161F1C] text-white"
              >
                Sign In
              </button>
            )}
            {userId && (
              <button
                type="button"
                onClick={signOut}
                className="p-2 rounded-xl border border-[#D8DFDB] bg-white hover:bg-[#EFF2F0]"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* LIVE STOPWATCH BAR */}
        {timingAct && (
          <div className="rounded-2xl bg-[#161F1C] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#52D1A0] animate-pulse" />
              <div>
                <div className="text-sm font-semibold">{timingAct.title}</div>
                <div className="text-[11px] text-[#A8BCB4]">
                  {goals.find((g) => g.id === timingAct.goalId)?.title || "Active Goal"} · {timingAct.xpMultiplier}x XP
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xl font-bold">{mm}:{ss}</span>
              <button
                type="button"
                onClick={() => setTimerRunning((r) => !r)}
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold flex items-center gap-1"
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {timerRunning ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                onClick={stopAndSaveTimer}
                className="px-3.5 py-1.5 rounded-lg bg-[#256453] hover:bg-[#2F7D68] text-xs font-semibold flex items-center gap-1"
              >
                <Square className="w-3 h-3 fill-current" /> Stop &amp; Save
              </button>
            </div>
          </div>
        )}

        {/* GOAL PICKER CHIPS */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveGoalId("ALL")}
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
                activeGoalId === "ALL"
                  ? "bg-[#161F1C] text-white border-[#161F1C]"
                  : "bg-white text-[#36433E] border-[#D8DFDB] hover:border-[#256453]"
              }`}
            >
              All Goals ({goals.length})
            </button>
            {goals.map((g) => {
              const p = computeGoalPace(g, logs);
              const active = activeGoalId === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveGoalId(g.id)}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    active
                      ? "bg-[#161F1C] text-white border-[#161F1C]"
                      : "bg-white text-[#36433E] border-[#D8DFDB] hover:border-[#256453]"
                  }`}
                >
                  {g.title} <span className="opacity-70 ml-1">{p.pct}%</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setGoalModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#161F1C] hover:bg-[#256453] text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New Goal
          </button>
        </div>

        {/* REAL DEADLINE PACE VERDICT BANNER */}
        <div className="bg-white border border-[#E1E6E3] rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {activeGoal && activePace ? (
            <>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      activePace.status === "At Risk"
                        ? "bg-[#FCECEC] text-[#B43E3E]"
                        : "bg-[#E8F2EE] text-[#256453]"
                    }`}
                  >
                    {activePace.status}
                  </span>
                  <span className="text-xs text-[#5A6762]">
                    {(activePace.loggedMins / 60).toFixed(1)} / {activeGoal.targetHours} hrs logged ({activePace.pct}%)
                  </span>
                </div>
                <div className="text-sm font-semibold mt-1">
                  {activePace.remainingMins === 0
                    ? `Target of ${activeGoal.targetHours} hrs achieved.`
                    : activePace.status === "At Risk"
                    ? `Averaging ${activePace.avgPerDay}m/day over 7 days — need ${activePace.requiredPerDay}m/day (+${
                        activePace.requiredPerDay - activePace.avgPerDay
                      }m/day) to hit ${activeGoal.deadline}.`
                    : `Averaging ${activePace.avgPerDay}m/day vs. ${activePace.requiredPerDay}m/day needed (${activePace.daysRemaining} days left until ${activeGoal.deadline}).`}
                </div>
              </div>
              <div className="w-full sm:w-44 shrink-0">
                <div className="w-full h-2.5 rounded-full bg-[#E8EDE9] overflow-hidden">
                  <div className="h-full bg-[#256453] rounded-full" style={{ width: `${activePace.pct}%` }} />
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="text-xs font-semibold text-[#256453]">Portfolio View — All Active Goals</div>
              <div className="text-sm font-bold mt-0.5">
                Today: {todayLoggedMins} / {todayTargetMins} committed minutes logged across {goals.length} goals
              </div>
            </div>
          )}
        </div>

        {/* VIEW 1: DAILY EXECUTION */}
        {tab === "execute" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border border-[#E1E6E3] rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold">Today&apos;s Daily Activities</h2>
                    <p className="text-xs text-[#5A6762]">
                      {todayLoggedMins} / {todayTargetMins} min completed today ({todayHitPct}%)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNaGoalId(activeGoalId === "ALL" ? goals[0]?.id || "" : activeGoalId);
                      setActModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#E8F2EE] text-[#256453] hover:bg-[#D9EAE3] text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Daily Activity
                  </button>
                </div>

                <div className="w-full h-2 rounded-full bg-[#E8EDE9] overflow-hidden">
                  <div className="h-full bg-[#256453] rounded-full transition-all" style={{ width: `${todayHitPct}%` }} />
                </div>

                <div className="space-y-3">
                  {scopedActs.length === 0 ? (
                    <p className="text-xs text-[#5A6762] py-6 text-center">
                      No daily activities yet for this goal. Add one above to start tracking time.
                    </p>
                  ) : (
                    scopedActs.map((a) => {
                      const doneToday = scopedLogs
                        .filter((l) => l.activityId === a.id && l.date === todayIso)
                        .reduce((s, l) => s + l.minutes, 0);
                      const pct = Math.min(100, Math.round((doneToday / Math.max(1, a.dailyTargetMins)) * 100));
                      const complete = doneToday >= a.dailyTargetMins;
                      const isTiming = timingActId === a.id;
                      const gName = goals.find((g) => g.id === a.goalId)?.title;

                      return (
                        <div
                          key={a.id}
                          className={`p-4 rounded-2xl border space-y-3 ${
                            complete ? "bg-[#F3FAF7] border-[#C5E0D5]" : "bg-[#FAFBF9] border-[#E5EAE7]"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{a.title}</span>
                                {complete && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#256453] text-white">
                                    Done
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#5A6762] mt-0.5">
                                {gName ? `${gName} · ` : ""}Target: {a.dailyTargetMins}m/day · {a.xpMultiplier}x XP
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startTimer(a.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                                  isTiming
                                    ? "bg-[#B46927] text-white"
                                    : "bg-[#161F1C] hover:bg-[#256453] text-white"
                                }`}
                              >
                                {isTiming ? "Timing…" : "Start Timer"}
                              </button>
                              <button
                                type="button"
                                onClick={() => logMinutes(a.id, 15)}
                                className="px-2.5 py-1.5 rounded-xl border border-[#D8DFDB] bg-white hover:bg-[#E8F2EE] text-xs font-medium"
                              >
                                +15m
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivities((prev) => prev.filter((x) => x.id !== a.id));
                                  notify("Activity removed");
                                }}
                                className="p-1.5 text-[#7F8C87] hover:text-red-700"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="text-[#5A6762]">Today&apos;s Progress</span>
                              <span className="font-mono font-semibold text-[#256453]">
                                {doneToday} / {a.dailyTargetMins} min
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-[#E3E9E6] overflow-hidden">
                              <div className="h-full bg-[#256453] rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Recent Sessions */}
              <div className="bg-white border border-[#E1E6E3] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold">Captured Time Sessions</h2>
                  <span className="text-xs text-[#5A6762]">{scopedLogs.length} logs</span>
                </div>
                <div className="divide-y divide-[#EDF1EE]">
                  {scopedLogs.slice(0, 8).map((l) => {
                    const act = activities.find((a) => a.id === l.activityId);
                    return (
                      <div key={l.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold">{act ? act.title : "Focus Session"}</div>
                          <div className="text-[#5A6762]">{l.date} · +{l.xp} XP</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold px-2 py-0.5 rounded-lg bg-[#E8F2EE] text-[#256453]">
                            {l.minutes}m
                          </span>
                          <button
                            type="button"
                            onClick={() => setLogs((prev) => prev.filter((x) => x.id !== l.id))}
                            className="text-[#87948F] hover:text-red-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: INTEGRITY + MILESTONE TASKS */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-[#E1E6E3] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Execution Integrity</h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FBF0E4] text-[#B46927] flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> {builderStats.streak}-day streak
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#5A6762]">Level {builderStats.level} Progress</span>
                    <span className="font-mono font-semibold text-[#256453]">
                      {builderStats.xpInLevel} / 250 XP
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#E8EDE9] overflow-hidden">
                    <div
                      className="h-full bg-[#256453] rounded-full"
                      style={{ width: `${Math.round((builderStats.xpInLevel / 250) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-[#F6F8F7] border border-[#E8EDE9]">
                    <div className="text-[11px] text-[#5A6762]">Daily Hit Rule</div>
                    <div className="text-xs font-semibold mt-0.5">&ge; 80% target = Streak</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F6F8F7] border border-[#E8EDE9]">
                    <div className="text-[11px] text-[#5A6762]">Weekly Shield</div>
                    <div className="text-xs font-semibold text-[#256453] mt-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> 1 Shield Active
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E1E6E3] rounded-2xl p-5">
                <h2 className="text-sm font-bold mb-1">Goal Milestone Tasks</h2>
                <p className="text-xs text-[#5A6762] mb-3">Concrete deliverables (+40 XP each)</p>
                <form onSubmit={handleAddTask} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Add milestone deliverable..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#D8DFDB] focus:outline-none focus:border-[#256453]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-[#161F1C] hover:bg-[#256453] text-white text-xs font-semibold"
                  >
                    Add
                  </button>
                </form>
                <div className="divide-y divide-[#EDF1EE]">
                  {scopedTasks.map((t) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleTask(t.id)}
                        className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                      >
                        <span
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 text-[10px] ${
                            t.done ? "bg-[#256453] border-[#256453] text-white" : "border-[#96A49E]"
                          }`}
                        >
                          {t.done ? "✓" : ""}
                        </span>
                        <span className={`text-xs font-medium truncate ${t.done ? "line-through text-[#87948F]" : ""}`}>
                          {t.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
                        className="text-[#87948F] hover:text-red-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: DASHBOARD */}
        {tab === "dashboard" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E1E6E3] rounded-2xl p-4">
                <div className="text-xs text-[#5A6762]">Total Time Captured</div>
                <div className="mt-2 text-2xl font-bold">
                  {(scopedLogs.reduce((s, l) => s + l.minutes, 0) / 60).toFixed(1)} hrs
                </div>
              </div>
              <div className="bg-white border border-[#E1E6E3] rounded-2xl p-4">
                <div className="text-xs text-[#5A6762]">7-Day Daily Avg</div>
                <div className="mt-2 text-2xl font-bold">
                  {Math.round(last7.reduce((s, d) => s + d.mins, 0) / 7)} min
                </div>
              </div>
              <div className="bg-white border border-[#E1E6E3] rounded-2xl p-4">
                <div className="text-xs text-[#5A6762]">Today Hit Rate</div>
                <div className="mt-2 text-2xl font-bold">{todayHitPct}%</div>
              </div>
              <div className="bg-white border border-[#E1E6E3] rounded-2xl p-4">
                <div className="text-xs text-[#5A6762]">Milestones Shipped</div>
                <div className="mt-2 text-2xl font-bold">
                  {scopedTasks.filter((t) => t.done).length} / {scopedTasks.length}
                </div>
              </div>
            </div>

            {/* 7-Day Commitment vs Actual Bar Chart */}
            <div className="bg-white border border-[#E1E6E3] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold">7-Day Actual vs. Daily Commitment ({todayTargetMins}m)</h2>
                  <p className="text-xs text-[#5A6762]">Green hit &ge; 80% of target; amber fell below target</p>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4">
                {last7.map((d) => {
                  const hit = d.mins >= Math.max(20, todayTargetMins * 0.8);
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[11px] font-mono text-[#5A6762]">{d.mins}m</span>
                      <div className="w-full max-w-[40px] h-28 bg-[#E8EDE9] rounded-lg overflow-hidden flex items-end">
                        <div
                          className={`w-full rounded-lg transition-all ${hit ? "bg-[#256453]" : "bg-[#C98A4B]"}`}
                          style={{ height: `${Math.max(4, Math.round((d.mins / maxBar) * 100))}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[#5A6762]">{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 14-Day Consistency Strip */}
            <div className="bg-white border border-[#E1E6E3] rounded-2xl p-5">
              <h2 className="text-sm font-bold mb-3">14-Day Consistency Ledger</h2>
              <div className="grid grid-cols-7 sm:grid-cols-14 gap-2">
                {Array.from({ length: 14 }, (_, idx) => {
                  const d = isoOffset(-(13 - idx));
                  const mins = scopedLogs.filter((l) => l.date === d).reduce((s, l) => s + l.minutes, 0);
                  const hit = mins >= Math.max(20, todayTargetMins * 0.8);
                  return (
                    <div
                      key={d}
                      className={`rounded-xl p-2 text-center ${
                        mins === 0
                          ? "bg-[#EDF1EE] text-[#6E7A75]"
                          : hit
                          ? "bg-[#256453] text-white"
                          : "bg-[#FBF0E4] text-[#B46927]"
                      }`}
                    >
                      <div className="text-[10px] opacity-80">{d.slice(8)}</div>
                      <div className="font-mono text-xs font-bold mt-0.5">{mins}m</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: GOALS SETUP */}
        {tab === "goals" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((g) => {
              const p = computeGoalPace(g, logs);
              const actCount = activities.filter((a) => a.goalId === g.id).length;
              return (
                <div key={g.id} className="bg-white border border-[#E1E6E3] rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                            p.status === "At Risk" ? "bg-[#FCECEC] text-[#B43E3E]" : "bg-[#E8F2EE] text-[#256453]"
                          }`}
                        >
                          {p.status}
                        </span>
                        <h3 className="mt-2 text-base font-bold">{g.title}</h3>
                        <p className="text-xs text-[#5A6762] mt-0.5">{g.why || "Active target"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteGoal(g.id)}
                        className="p-1.5 rounded-lg text-[#87948F] hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#5A6762]">
                          {(p.loggedMins / 60).toFixed(1)} / {g.targetHours} hrs · Due {g.deadline}
                        </span>
                        <span className="font-mono font-semibold text-[#256453]">{p.pct}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-[#E8EDE9] overflow-hidden">
                        <div className="h-full bg-[#256453] rounded-full" style={{ width: `${p.pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[#EDF1EE] flex items-center justify-between text-xs">
                    <span className="text-[#5A6762]">
                      {actCount} daily activities · Need {p.requiredPerDay}m/day
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveGoalId(g.id);
                        setTab("execute");
                      }}
                      className="font-semibold text-[#256453] hover:underline"
                    >
                      Open Execution →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E1E6E3] grid grid-cols-3 h-16">
        {(
          [
            ["execute", "Execute", CheckCircle2],
            ["dashboard", "Dashboard", BarChart3],
            ["goals", "Goals", Target],
          ] as [ViewTab, string, React.ComponentType<{ className?: string }>][]
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
              tab === k ? "text-[#256453]" : "text-[#5A6762]"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* MODAL: NEW GOAL */}
      {goalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E1E6E3] w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Define a Concrete Goal</h3>
              <button type="button" onClick={() => setGoalModalOpen(false)} className="p-1 rounded-lg hover:bg-[#EFF2F0]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateGoal} className="space-y-3">
              <input
                type="text"
                required
                value={ngTitle}
                onChange={(e) => setNgTitle(e.target.value)}
                placeholder="Goal outcome (e.g., Crack Tier-1 Backend Role)"
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#D8DFDB]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  required
                  min={5}
                  max={1000}
                  value={ngHours}
                  onChange={(e) => setNgHours(Number(e.target.value || 40))}
                  placeholder="Target hrs"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#D8DFDB]"
                />
                <input
                  type="date"
                  required
                  value={ngDeadline}
                  onChange={(e) => setNgDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#D8DFDB]"
                />
              </div>
              <input
                type="text"
                value={ngWhy}
                onChange={(e) => setNgWhy(e.target.value)}
                placeholder="Why this matters (optional anchor)"
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#D8DFDB]"
              />
              <button type="submit" className="w-full py-2.5 rounded-xl bg-[#161F1C] hover:bg-[#256453] text-white text-sm font-semibold">
                Create Goal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW DAILY ACTIVITY */}
      {actModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E1E6E3] w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Add Daily Activity to Goal</h3>
              <button type="button" onClick={() => setActModalOpen(false)} className="p-1 rounded-lg hover:bg-[#EFF2F0]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateActivity} className="space-y-3">
              <select
                value={naGoalId}
                onChange={(e) => setNaGoalId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#D8DFDB] bg-white"
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={naTitle}
                onChange={(e) => setNaTitle(e.target.value)}
                placeholder="Daily activity (e.g., Zero-AI DSA Pattern Drill)"
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#D8DFDB]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  required
                  min={5}
                  max={360}
                  value={naMins}
                  onChange={(e) => setNaMins(Number(e.target.value || 30))}
                  placeholder="Daily mins"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#D8DFDB]"
                />
                <select
                  value={naTier}
                  onChange={(e) => setNaTier(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#D8DFDB] bg-white"
                >
                  <option value={1}>Light (1x XP)</option>
                  <option value={1.5}>Steady (1.5x XP)</option>
                  <option value={2}>Deep Work (2x XP)</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 rounded-xl bg-[#161F1C] hover:bg-[#256453] text-white text-sm font-semibold">
                Add Daily Activity
              </button>
            </form>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-20 sm:bottom-6 right-5 px-4 py-2.5 rounded-xl bg-[#161F1C] text-white text-xs font-medium shadow-lg z-50">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
'@

# 4. Wire src/app/page.tsx to GoalExecutionStudio
Write-ProjectFile -Path "src/app/page.tsx" -Content @'
import { GoalExecutionStudio } from "@/components/GoalExecutionStudio";

export default function HomePage() {
  return <GoalExecutionStudio />;
}
'@

Write-Host "`n=== Upgrade Complete! ===" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. (Optional for cloud DB sync) Run supabase/upgrade_v2.sql in Supabase SQL Editor"
Write-Host "  2. Run: npm run build"
Write-Host "  3. Push to GitHub: git add . && git commit -m 'Upgrade to Goal Execution Studio v2' && git push"
