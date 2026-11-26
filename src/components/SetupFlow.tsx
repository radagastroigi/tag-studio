"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CoreGoal } from "@/types/monk";

type DraftMilestone = { id: string; title: string; due_date: string };
type DraftActivity = { id: string; title: string; daily_target_mins: number; scheduled_time: string };

export function SetupFlow({
  shortGoal,
  longGoal,
}: {
  shortGoal: CoreGoal;
  longGoal: CoreGoal | null;
}) {
  const router = useRouter();

  const [milestones, setMilestones] = useState<DraftMilestone[]>([
    { id: crypto.randomUUID(), title: "", due_date: "" },
  ]);
  const [activities, setActivities] = useState<DraftActivity[]>([
    { id: crypto.randomUUID(), title: "", daily_target_mins: 45, scheduled_time: "08:00" },
  ]);

  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggestIfStuck() {
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/suggest-habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: shortGoal.title,
          why: longGoal ? `Stepping stone toward: ${longGoal.title}` : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "AI helper unavailable right now—add your own activities above.");
      } else if (Array.isArray(data.habits) && data.habits.length > 0) {
        setActivities(
          data.habits.map((h: { title: string; target_label?: string; scheduled_time?: string }) => {
            const num = Number(String(h.target_label || "30").match(/\d+/)?.[0] || 30);
            return {
              id: crypto.randomUUID(),
              title: h.title,
              daily_target_mins: Math.min(240, Math.max(5, num)),
              scheduled_time: h.scheduled_time || "",
            };
          })
        );
      }
    } catch {
      setError("Could not reach AI helper—you can still write your own activities.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const validActs = activities.filter((a) => a.title.trim().length > 0);
    const validMiles = milestones.filter((m) => m.title.trim().length > 0);
    if (validActs.length === 0) {
      return setError("Add at least one daily activity you will actually show up for.");
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return setError("Session expired. Please sign in again.");
    }

    // 1. Save Milestones (optional)
    if (validMiles.length > 0) {
      const { error: mErr } = await supabase.from("monk_milestones").insert(
        validMiles.map((m, idx) => ({
          user_id: user.id,
          goal_id: shortGoal.id,
          title: m.title.trim(),
          due_date: m.due_date || null,
          sort_order: idx,
        }))
      );
      if (mErr) {
        setSaving(false);
        return setError(mErr.message);
      }
    }

    // 2. Save User's Daily Activities
    const { error: aErr } = await supabase.from("monk_activities").insert(
      validActs.map((a, idx) => ({
        user_id: user.id,
        goal_id: shortGoal.id,
        title: a.title.trim(),
        daily_target_mins: Math.max(5, Number(a.daily_target_mins || 30)),
        scheduled_time: a.scheduled_time || null,
        sort_order: idx,
        is_active: true,
      }))
    );

    if (aErr) {
      setSaving(false);
      return setError(aErr.message);
    }

    // 3. Mark onboarding complete (step 3 -> Daily Widget)
    await supabase
      .from("monk_profiles")
      .update({ onboarding_step: 3, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="w-full max-w-xl bg-white border border-[#E2E7E4] rounded-3xl p-7 space-y-6">
      <div className="space-y-1">
        <div className="text-xs font-medium text-[#256453]">Step 2 of 2 · Your Daily Craft</div>
        <h1 className="text-xl font-semibold tracking-tight">{shortGoal.title}</h1>
        {longGoal && (
          <p className="text-xs text-[#5B6863]">North Star: {longGoal.title}</p>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>
      )}

      {/* 1. Milestones / Checkpoints */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#17211E]">Milestones &amp; Checkpoints</span>
          <button
            type="button"
            onClick={() => setMilestones((p) => [...p, { id: crypto.randomUUID(), title: "", due_date: "" }])}
            className="text-xs font-medium text-[#256453] hover:underline"
          >
            + Add checkpoint
          </button>
        </div>

        {milestones.map((m) => (
          <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
            <input
              type="text"
              value={m.title}
              onChange={(e) =>
                setMilestones((p) => p.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))
              }
              placeholder="e.g., Pass Mock Interview #2 at 75+"
              className="col-span-7 px-3 py-2 text-xs rounded-xl border border-[#D8DFDB]"
            />
            <input
              type="date"
              value={m.due_date}
              onChange={(e) =>
                setMilestones((p) => p.map((x) => (x.id === m.id ? { ...x, due_date: e.target.value } : x)))
              }
              className="col-span-4 px-2.5 py-2 text-xs rounded-xl border border-[#D8DFDB]"
            />
            <button
              type="button"
              onClick={() => setMilestones((p) => p.filter((x) => x.id !== m.id))}
              className="col-span-1 text-xs text-[#87948F] hover:text-red-700"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 2. User-First Daily Activities */}
      <div className="space-y-2.5 pt-4 border-t border-[#EDF1EE]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#17211E]">Your Daily Activities</div>
            <p className="text-[11px] text-[#5B6863]">Write what you will show up for every day (leave time blank if flexible).</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setActivities((p) => [
                ...p,
                { id: crypto.randomUUID(), title: "", daily_target_mins: 30, scheduled_time: "" },
              ])
            }
            className="text-xs font-medium text-[#256453] hover:underline shrink-0"
          >
            + Add activity
          </button>
        </div>

        {activities.map((a) => (
          <div key={a.id} className="grid grid-cols-12 gap-2 items-center">
            <input
              type="text"
              required
              value={a.title}
              onChange={(e) =>
                setActivities((p) => p.map((x) => (x.id === a.id ? { ...x, title: e.target.value } : x)))
              }
              placeholder="e.g., 1 Zero-AI DSA Problem"
              className="col-span-6 px-3 py-2 text-xs rounded-xl border border-[#D8DFDB]"
            />
            <input
              type="number"
              min={5}
              max={360}
              value={a.daily_target_mins}
              onChange={(e) =>
                setActivities((p) =>
                  p.map((x) => (x.id === a.id ? { ...x, daily_target_mins: Number(e.target.value || 30) } : x))
                )
              }
              placeholder="mins"
              className="col-span-2 px-2 py-2 text-xs text-center rounded-xl border border-[#D8DFDB]"
            />
            <input
              type="time"
              value={a.scheduled_time}
              onChange={(e) =>
                setActivities((p) => p.map((x) => (x.id === a.id ? { ...x, scheduled_time: e.target.value } : x)))
              }
              className="col-span-3 px-2 py-2 text-xs rounded-xl border border-[#D8DFDB]"
            />
            <button
              type="button"
              onClick={() => setActivities((p) => p.filter((x) => x.id !== a.id))}
              className="col-span-1 text-xs text-[#87948F] hover:text-red-700"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Quiet Optional AI Rescue — ONLY when user asks */}
        <div className="pt-1">
          <button
            type="button"
            onClick={suggestIfStuck}
            disabled={aiLoading}
            className="text-[11px] text-[#5B6863] hover:text-[#256453] underline disabled:opacity-50"
          >
            {aiLoading ? "Drafting starter ideas…" : "Not sure where to start? Suggest starter activities"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 rounded-2xl bg-[#17211E] hover:bg-[#256453] text-white text-sm font-semibold transition disabled:opacity-50"
      >
        {saving ? "Locking your rhythm…" : "Enter Daily Focus Widget →"}
      </button>
    </form>
  );
}