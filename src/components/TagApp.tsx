"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  Activity,
  Target,
  Plus,
  Timer,
  Flame,
  CheckCircle2,
  Clock,
  Moon,
  LogOut,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { isoDaysAgo, formatShortDate } from "@/lib/quickParse";
import type { ActivityLog, Category, Goal, Priority, Task } from "@/lib/types";
import { Heatmap } from "./Heatmap";
import { GoalEtaCard } from "./GoalEtaCard";
import { QuickCaptureModal } from "./QuickCaptureModal";
import { FocusTimerModal } from "./FocusTimerModal";

const LOCAL_KEY = "monkthetics_tag_cloud_fallback_v1";

const SEED_GOALS: Goal[] = [
  {
    id: "g1",
    title: "Master Core DSA & System Design",
    horizon: "100-Day Forge",
    target_minutes: 3000,
    logged_minutes: 520,
    target_date: null,
    status: "active",
  },
  {
    id: "g2",
    title: "Ship & Scale Production SaaS",
    horizon: "Q4 2026",
    target_minutes: 2400,
    logged_minutes: 420,
    target_date: null,
    status: "active",
  },
];

const SEED_TASKS: Task[] = [
  {
    id: "t1",
    goal_id: "g1",
    title: "Implement Sharded LRU Cache in C#",
    priority: "high",
    is_daily_focus: true,
    scheduled_date: isoDaysAgo(0),
    is_done: false,
    completed_at: null,
  },
  {
    id: "t2",
    goal_id: "g1",
    title: "Whiteboard URL Shortener Base62 + Redis Flow",
    priority: "high",
    is_daily_focus: true,
    scheduled_date: isoDaysAgo(0),
    is_done: true,
    completed_at: new Date().toISOString(),
  },
  {
    id: "t3",
    goal_id: "g2",
    title: "Deploy TAG Studio v1.0 to Vercel + Supabase",
    priority: "medium",
    is_daily_focus: true,
    scheduled_date: isoDaysAgo(0),
    is_done: false,
    completed_at: null,
  },
];

const SEED_ACTIVITIES: ActivityLog[] = [
  { id: "a1", goal_id: "g1", task_id: null, title: "LRU Cache + Striped Locking Drill", category: "DSA", duration_mins: 45, logged_date: isoDaysAgo(0) },
  { id: "a2", goal_id: "g1", task_id: null, title: "URL Shortener System Design", category: "System Design", duration_mins: 40, logged_date: isoDaysAgo(0) },
  { id: "a3", goal_id: "g2", task_id: null, title: "Supabase RLS & Schema Design", category: "Building", duration_mins: 90, logged_date: isoDaysAgo(1) },
  { id: "a4", goal_id: "g1", task_id: null, title: "Sunday Mock Interview #1", category: "AI & ML", duration_mins: 90, logged_date: isoDaysAgo(1) },
  { id: "a5", goal_id: "g1", task_id: null, title: "Saturday Zero-AI Exam #1", category: "DSA", duration_mins: 110, logged_date: isoDaysAgo(2) },
  { id: "a6", goal_id: "g2", task_id: null, title: "QuickBill UPI Live Launch", category: "Building", duration_mins: 75, logged_date: isoDaysAgo(3) },
];

type TabKey = "today" | "dashboard" | "tasks" | "goals";

export function TagApp() {
  const supabase = useMemo(() => createClient(), []);
  const cloudEnabled = isSupabaseConfigured();

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(!cloudEnabled);
  const [tab, setTab] = useState<TabKey>("today");
  const [goals, setGoals] = useState<Goal[]>(SEED_GOALS);
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [activities, setActivities] = useState<ActivityLog[]>(SEED_ACTIVITIES);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // New goal form
  const [goalTitle, setGoalTitle] = useState("");
  const [goalHorizon, setGoalHorizon] = useState("100 Days");
  const [goalHours, setGoalHours] = useState(40);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  // Load initial state (Supabase if configured + signed in, else localStorage)
  useEffect(() => {
    if (!cloudEnabled) {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.goals) setGoals(parsed.goals);
          if (parsed.tasks) setTasks(parsed.tasks);
          if (parsed.activities) setActivities(parsed.activities);
        }
      } catch {}
      return;
    }

    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setUserId(user ? user.id : null);
      setAuthChecked(true);
      if (user) {
        const [gRes, tRes, aRes] = await Promise.all([
          supabase.from("goals").select("*").order("created_at", { ascending: false }),
          supabase.from("tasks").select("*").order("created_at", { ascending: false }),
          supabase.from("activity_logs").select("*").order("logged_date", { ascending: false }).limit(200),
        ]);
        if (gRes.data) setGoals(gRes.data);
        if (tRes.data) setTasks(tRes.data);
        if (aRes.data) setActivities(aRes.data);
      }
    });
  }, [cloudEnabled, supabase]);

  // Persist local fallback when not signed into cloud
  useEffect(() => {
    if (!userId) {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify({ goals, tasks, activities }));
      } catch {}
    }
  }, [goals, tasks, activities, userId]);

  // Global "+" shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCaptureOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUserId(null);
  }

  async function handleAddTask(payload: {
    title: string;
    priority: Priority;
    goal_id: string | null;
    is_daily_focus: boolean;
  }) {
    const tempId = crypto.randomUUID();
    const newTask: Task = {
      id: tempId,
      goal_id: payload.goal_id,
      title: payload.title,
      priority: payload.priority,
      is_daily_focus: payload.is_daily_focus,
      scheduled_date: isoDaysAgo(0),
      is_done: false,
      completed_at: null,
    };
    setTasks((prev) => [newTask, ...prev]);
    notify("Task added");

    if (userId) {
      const { data } = await supabase
        .from("tasks")
        .insert({ ...payload, user_id: userId, client_mutation_id: tempId })
        .select()
        .single();
      if (data) {
        setTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)));
      }
    }
  }

  async function handleToggleTask(id: string) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const nextDone = !target.is_done;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, is_done: nextDone, completed_at: nextDone ? new Date().toISOString() : null } : t
      )
    );
    notify(nextDone ? "Completed!" : "Reopened");
    if (userId) {
      await supabase
        .from("tasks")
        .update({ is_done: nextDone, completed_at: nextDone ? new Date().toISOString() : null })
        .eq("id", id);
    }
  }

  async function handleAddActivity(payload: {
    title: string;
    category: Category;
    duration_mins: number;
    goal_id: string | null;
  }) {
    const tempId = crypto.randomUUID();
    const today = isoDaysAgo(0);
    const newAct: ActivityLog = {
      id: tempId,
      goal_id: payload.goal_id,
      task_id: null,
      title: payload.title,
      category: payload.category,
      duration_mins: payload.duration_mins,
      logged_date: today,
    };
    setActivities((prev) => [newAct, ...prev]);
    if (payload.goal_id) {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === payload.goal_id ? { ...g, logged_minutes: g.logged_minutes + payload.duration_mins } : g
        )
      );
    }
    notify(`Logged ${payload.duration_mins} min`);

    if (userId) {
      const { data } = await supabase
        .from("activity_logs")
        .insert({ ...payload, user_id: userId, logged_date: today, client_mutation_id: tempId })
        .select()
        .single();
      if (data) {
        setActivities((prev) => prev.map((a) => (a.id === tempId ? data : a)));
      }
    }
  }

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    const tempId = crypto.randomUUID();
    const newGoal: Goal = {
      id: tempId,
      title: goalTitle.trim(),
      horizon: goalHorizon.trim() || "100 Days",
      target_minutes: Math.max(60, goalHours * 60),
      logged_minutes: 0,
      target_date: null,
      status: "active",
    };
    setGoals((prev) => [newGoal, ...prev]);
    setGoalTitle("");
    notify("Goal created");

    if (userId) {
      const { data } = await supabase
        .from("goals")
        .insert({
          user_id: userId,
          title: newGoal.title,
          horizon: newGoal.horizon,
          target_minutes: newGoal.target_minutes,
        })
        .select()
        .single();
      if (data) setGoals((prev) => prev.map((g) => (g.id === tempId ? data : g)));
    }
  }

  async function handleDeleteGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (userId) await supabase.from("goals").delete().eq("id", id);
    notify("Goal removed");
  }

  function handleEveningRollover() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tIso = tomorrow.toISOString().slice(0, 10);
    setTasks((prev) =>
      prev.map((t) => (!t.is_done && t.is_daily_focus ? { ...t, scheduled_date: tIso } : t))
    );
    notify("Unfinished focus tasks rolled cleanly to tomorrow");
  }

  // Computed metrics
  const focusTasks = tasks.filter((t) => t.is_daily_focus).slice(0, 5);
  const doneCount = tasks.filter((t) => t.is_done).length;
  const totalMins = activities.reduce((s, a) => s + a.duration_mins, 0);
  const streak = useMemo(() => {
    const set = new Set(activities.map((a) => a.logged_date));
    let count = 0;
    for (let i = 0; i < 365; i++) {
      if (set.has(isoDaysAgo(i))) count++;
      else break;
    }
    return count;
  }, [activities]);

  const weeklyBars = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = isoDaysAgo(6 - i);
      const mins = activities.filter((a) => a.logged_date === date).reduce((s, a) => s + a.duration_mins, 0);
      const label = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
      return { date, label, mins };
    });
  }, [activities]);

  const maxWeekMin = Math.max(60, ...weeklyBars.map((b) => b.mins));

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-[#5B6863]">Loading TAG Studio…</div>;
  }

  return (
    <div className="min-h-screen bg-[#F6F7F5] text-[#17211E] pb-24 sm:pb-12">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#F6F7F5]/90 backdrop-blur border-b border-[#E2E7E4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#17211E] text-white flex items-center justify-center font-bold text-xs tracking-tight">
              TAG
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">TAG Studio</div>
              <div className="text-[11px] text-[#5B6863]">
                {userId ? "Cloud Synced" : "Local Preview Mode"} · Monkthetics
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-1 bg-[#EAEFEA] p-1 rounded-xl">
            {(
              [
                ["today", "Today"],
                ["dashboard", "Dashboard"],
                ["tasks", "Tasks"],
                ["goals", "Goals"],
              ] as [TabKey, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  tab === k ? "bg-[#17211E] text-white" : "text-[#4A5752] hover:text-[#17211E]"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTimerOpen(true)}
              className="px-3 py-2 rounded-xl bg-[#E9F3EF] text-[#2B6B59] hover:bg-[#DCECE5] text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Timer className="w-3.5 h-3.5" /> Focus
            </button>
            {cloudEnabled && !userId && (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-3 py-2 rounded-xl bg-[#17211E] text-white text-xs font-semibold"
              >
                Sign In
              </button>
            )}
            {userId && (
              <button
                type="button"
                onClick={signOut}
                className="p-2 rounded-xl border border-[#D8DFDB] bg-white hover:bg-[#F0F3F1]"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* TODAY TAB */}
        {tab === "today" && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E2E7E4] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold">Daily 3-Focus</h1>
                <p className="text-xs text-[#5B6863]">
                  Protect your top 3 non-negotiables today. Everything else stays calm in Backlog.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEveningRollover}
                  className="px-3.5 py-2 rounded-xl border border-[#D8DFDB] bg-white hover:bg-[#F0F3F1] text-xs font-medium flex items-center gap-1.5"
                >
                  <Moon className="w-3.5 h-3.5 text-[#B97335]" /> Evening Wrap-Up
                </button>
                <button
                  type="button"
                  onClick={() => setCaptureOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#17211E] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Quick Add
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {focusTasks.length === 0 ? (
                <div className="bg-white border border-[#E2E7E4] rounded-2xl p-8 text-center text-xs text-[#5B6863]">
                  No focus tasks pinned yet. Tap + to add your top 3 for today.
                </div>
              ) : (
                focusTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleToggleTask(t.id)}
                    className="w-full text-left bg-white border border-[#E2E7E4] hover:border-[#2B6B59] rounded-2xl p-4 flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 text-xs ${
                          t.is_done ? "bg-[#2B6B59] border-[#2B6B59] text-white" : "border-[#9AA8A2]"
                        }`}
                      >
                        {t.is_done ? "✓" : ""}
                      </span>
                      <span className={`text-sm font-medium truncate ${t.is_done ? "line-through text-[#87948F]" : ""}`}>
                        {t.title}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full shrink-0 ${
                        t.priority === "high" ? "bg-[#FBF1E6] text-[#B97335]" : "bg-[#EAEFEA] text-[#4A5752]"
                      }`}
                    >
                      {t.priority}
                    </span>
                  </button>
                ))
              )}
            </div>

            <Heatmap activities={activities} />
          </div>
        )}

        {/* DASHBOARD TAB */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E2E7E4] rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-[#5B6863]">
                  <span>Completed</span>
                  <CheckCircle2 className="w-4 h-4 text-[#2B6B59]" />
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {doneCount}/{tasks.length}
                </div>
              </div>
              <div className="bg-white border border-[#E2E7E4] rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-[#5B6863]">
                  <span>Total Focus</span>
                  <Clock className="w-4 h-4 text-[#B97335]" />
                </div>
                <div className="mt-2 text-2xl font-bold">{(totalMins / 60).toFixed(1)} hrs</div>
              </div>
              <div className="bg-white border border-[#E2E7E4] rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-[#5B6863]">
                  <span>Active Goals</span>
                  <Target className="w-4 h-4 text-[#2B6B59]" />
                </div>
                <div className="mt-2 text-2xl font-bold">{goals.length}</div>
              </div>
              <div className="bg-white border border-[#E2E7E4] rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-[#5B6863]">
                  <span>Streak</span>
                  <Flame className="w-4 h-4 text-[#B97335]" />
                </div>
                <div className="mt-2 text-2xl font-bold">{streak} days</div>
              </div>
            </div>

            <div className="bg-white border border-[#E2E7E4] rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-4">7-Day Deep Work Effort (Minutes)</h3>
              <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4">
                {weeklyBars.map((b) => (
                  <div key={b.date} className="flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[11px] font-mono text-[#5B6863]">{b.mins}</span>
                    <div className="w-full max-w-[38px] bg-[#E9EFEA] rounded-lg overflow-hidden flex items-end h-28">
                      <div
                        className="w-full bg-[#2B6B59] rounded-lg transition-all duration-300"
                        style={{ height: `${Math.max(4, Math.round((b.mins / maxWeekMin) * 100))}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-[#5B6863]">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <Heatmap activities={activities} />

            <div className="bg-white border border-[#E2E7E4] rounded-2xl p-5">
              <h3 className="text-sm font-semibold mb-3">Recent Sessions</h3>
              <div className="divide-y divide-[#EDF1EE]">
                {activities.slice(0, 6).map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-[#5B6863]">
                        {formatShortDate(a.logged_date)} · {a.category}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#E9F3EF] text-[#2B6B59]">
                      {a.duration_mins}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TASKS TAB */}
        {tab === "tasks" && (
          <div className="bg-white border border-[#E2E7E4] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">All Tasks ({tasks.length})</h2>
              <button
                type="button"
                onClick={() => setCaptureOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-[#17211E] text-white text-xs font-semibold"
              >
                + New Task
              </button>
            </div>
            <div className="divide-y divide-[#EDF1EE]">
              {tasks.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleTask(t.id)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                  >
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 text-xs ${
                        t.is_done ? "bg-[#2B6B59] border-[#2B6B59] text-white" : "border-[#9AA8A2]"
                      }`}
                    >
                      {t.is_done ? "✓" : ""}
                    </span>
                    <span className={`text-sm font-medium truncate ${t.is_done ? "line-through text-[#87948F]" : ""}`}>
                      {t.title}
                    </span>
                  </button>
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#EAEFEA] text-[#4A5752]">
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GOALS TAB */}
        {tab === "goals" && (
          <div className="space-y-5">
            <form
              onSubmit={handleCreateGoal}
              className="bg-white border border-[#E2E7E4] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-12 gap-3"
            >
              <input
                type="text"
                required
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="New long-term goal..."
                className="sm:col-span-5 px-3.5 py-2.5 text-sm rounded-xl border border-[#D8DFDB]"
              />
              <input
                type="text"
                value={goalHorizon}
                onChange={(e) => setGoalHorizon(e.target.value)}
                placeholder="Horizon (e.g., 100 Days)"
                className="sm:col-span-3 px-3.5 py-2.5 text-sm rounded-xl border border-[#D8DFDB]"
              />
              <input
                type="number"
                min={1}
                max={500}
                value={goalHours}
                onChange={(e) => setGoalHours(Number(e.target.value || 20))}
                className="sm:col-span-2 px-3.5 py-2.5 text-sm rounded-xl border border-[#D8DFDB]"
              />
              <button
                type="submit"
                className="sm:col-span-2 py-2.5 rounded-xl bg-[#17211E] hover:bg-[#2B6B59] text-white text-sm font-semibold"
              >
                Add Goal
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((g) => (
                <GoalEtaCard
                  key={g.id}
                  goal={g}
                  tasks={tasks}
                  activities={activities}
                  onDelete={handleDeleteGoal}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Floating "+" Quick-Capture Button */}
      <button
        type="button"
        onClick={() => setCaptureOpen(true)}
        className="fixed bottom-20 right-5 sm:bottom-8 sm:right-8 z-40 w-14 h-14 rounded-2xl bg-[#17211E] hover:bg-[#2B6B59] text-white shadow-lg flex items-center justify-center transition"
        aria-label="Quick capture"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mobile Thumb-Zone Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E2E7E4] grid grid-cols-4 h-16">
        {(
          [
            ["today", "Today", Activity],
            ["dashboard", "Stats", LayoutDashboard],
            ["tasks", "Tasks", CheckSquare],
            ["goals", "Goals", Target],
          ] as [TabKey, string, React.ComponentType<{ className?: string }>][]
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
              tab === k ? "text-[#2B6B59]" : "text-[#5B6863]"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <QuickCaptureModal
        open={captureOpen}
        goals={goals}
        onClose={() => setCaptureOpen(false)}
        onAddTask={handleAddTask}
        onAddActivity={handleAddActivity}
      />

      <FocusTimerModal
        open={timerOpen}
        goals={goals}
        onClose={() => setTimerOpen(false)}
        onCompleteSession={handleAddActivity}
      />

      {toast && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-[#17211E] text-white text-xs font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}