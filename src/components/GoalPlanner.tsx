"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DraftHabit = {
  id: string;
  title: string;
  target_label: string;
  scheduled_time: string;
};

export function GoalPlanner() {
  const router = useRouter();
  const [goalTitle, setGoalTitle] = useState("");
  const [whyText, setWhyText] = useState("");
  const [habits, setHabits] = useState<DraftHabit[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggestWithAI() {
    if (!goalTitle.trim()) {
      setError("Write your goal first.");
      return;
    }
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/suggest-habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goalTitle, why: whyText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not generate suggestions.");
      } else {
        setHabits(
          (data.habits || []).map((h: Omit<DraftHabit, "id">) => ({
            id: crypto.randomUUID(),
            ...h,
          }))
        );
      }
    } catch {
      setError("Network error contacting AI.");
    } finally {
      setAiLoading(false);
    }
  }

  function addBlankHabit() {
    setHabits((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: "", target_label: "30 min", scheduled_time: "08:00" },
    ]);
  }

  function updateHabit(id: string, field: keyof Omit<DraftHabit, "id">, value: string) {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  }

  function removeHabit(id: string) {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  async function saveGoalAndHabits(e: React.FormEvent) {
    e.preventDefault();
    const validHabits = habits.filter((h) => h.title.trim().length > 0);
    if (!goalTitle.trim()) return setError("Enter your goal.");
    if (validHabits.length === 0) return setError("Add at least one daily activity.");

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setError("Session expired. Please sign in again.");

    const { data: createdGoal, error: goalErr } = await supabase
      .from("monk_goals")
      .insert({
        user_id: user.id,
        title: goalTitle.trim(),
        why_statement: whyText.trim(),
        is_active: true,
      })
      .select("id")
      .single();

    if (goalErr || !createdGoal) {
      setSaving(false);
      return setError(goalErr?.message || "Failed to save goal.");
    }

    const { error: habitsErr } = await supabase.from("monk_habits").insert(
      validHabits.map((h, idx) => ({
        user_id: user.id,
        goal_id: createdGoal.id,
        title: h.title.trim(),
        target_label: h.target_label.trim() || "20 min",
        scheduled_time: h.scheduled_time || "08:00",
        sort_order: idx,
        is_active: true,
      }))
    );

    if (habitsErr) {
      setSaving(false);
      return setError(habitsErr.message);
    }

    router.refresh();
  }

  return (
    <form onSubmit={saveGoalAndHabits} className="w-full max-w-lg bg-white border border-[#E2E7E4] rounded-3xl p-7 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[#17211E]">Shape your day around one goal</h1>
        <p className="text-xs text-[#5B6863]">
          Tell us where you want to go. We&apos;ll break it into small daily actions you can actually show up for.
        </p>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>
      )}

      <div className="space-y-3">
        <input
          type="text"
          required
          value={goalTitle}
          onChange={(e) => setGoalTitle(e.target.value)}
          placeholder="Your goal (e.g., Crack a Senior Backend Engineer role)"
          className="w-full px-4 py-3 text-sm rounded-xl border border-[#D8DFDB] focus:outline-none focus:border-[#256453]"
        />
        <input
          type="text"
          value={whyText}
          onChange={(e) => setWhyText(e.target.value)}
          placeholder="Why this matters to you (optional)"
          className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#D8DFDB] focus:outline-none focus:border-[#256453]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={suggestWithAI}
            disabled={aiLoading}
            className="flex-1 py-2.5 rounded-xl bg-[#E8F2EE] hover:bg-[#D8EAE3] text-[#256453] text-xs font-semibold transition disabled:opacity-50"
          >
            {aiLoading ? "Thinking…" : "Suggest Daily Rhythm with AI"}
          </button>
          <button
            type="button"
            onClick={addBlankHabit}
            className="px-4 py-2.5 rounded-xl border border-[#D8DFDB] hover:bg-[#F4F6F5] text-xs font-medium"
          >
            + Add Manually
          </button>
        </div>
      </div>

      {habits.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-[#EDF1EE]">
          <div className="text-xs font-medium text-[#5B6863]">Your Daily Commitments</div>
          {habits.map((h) => (
            <div key={h.id} className="grid grid-cols-12 gap-2 items-center">
              <input
                type="time"
                value={h.scheduled_time}
                onChange={(e) => updateHabit(h.id, "scheduled_time", e.target.value)}
                className="col-span-3 px-2 py-2 text-xs rounded-lg border border-[#D8DFDB]"
              />
              <input
                type="text"
                required
                value={h.title}
                onChange={(e) => updateHabit(h.id, "title", e.target.value)}
                placeholder="Daily action"
                className="col-span-5 px-2.5 py-2 text-xs rounded-lg border border-[#D8DFDB]"
              />
              <input
                type="text"
                value={h.target_label}
                onChange={(e) => updateHabit(h.id, "target_label", e.target.value)}
                placeholder="5 pushups"
                className="col-span-3 px-2 py-2 text-xs rounded-lg border border-[#D8DFDB]"
              />
              <button
                type="button"
                onClick={() => removeHabit(h.id)}
                className="col-span-1 text-xs text-[#87948F] hover:text-red-700"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {habits.length > 0 && (
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-[#17211E] hover:bg-[#256453] text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {saving ? "Saving to database…" : "Lock My Daily Rhythm"}
        </button>
      )}
    </form>
  );
}