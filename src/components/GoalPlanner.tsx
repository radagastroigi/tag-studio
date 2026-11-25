"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toCanonicalSI, type TimeSlot, type TrackingType, type UnitCode } from "@/lib/units";

type DraftHabit = {
  id: string;
  title: string;
  tracking_type: TrackingType;
  target_input: number;
  input_unit: UnitCode;
  time_slot: TimeSlot;
  scheduled_time: string;
};

export function GoalPlanner() {
  const router = useRouter();
  const [goalTitle, setGoalTitle] = useState("");
  const [whyText, setWhyText] = useState("");
  const [targetHours, setTargetHours] = useState(80);
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  });

  const [habits, setHabits] = useState<DraftHabit[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggestWithAI() {
    if (!goalTitle.trim()) return setError("Write your goal first.");
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
          (data.habits || []).map((h: { title: string; target_label?: string; scheduled_time?: string }) => {
            const label = String(h.target_label || "30 min").toLowerCase();
            const numMatch = label.match(/(\d+)/);
            const num = numMatch ? Number(numMatch[1]) : 30;
            const isCount = !label.includes("min") && !label.includes("hr");
            return {
              id: crypto.randomUUID(),
              title: h.title,
              tracking_type: isCount ? "count" : "time",
              target_input: num,
              input_unit: isCount ? "count" : "min",
              time_slot: h.scheduled_time ? "custom" : "anytime",
              scheduled_time: h.scheduled_time || "08:00",
            };
          })
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
      {
        id: crypto.randomUUID(),
        title: "",
        tracking_type: "time",
        target_input: 30,
        input_unit: "min",
        time_slot: "anytime",
        scheduled_time: "08:00",
      },
    ]);
  }

  function updateHabit<K extends keyof DraftHabit>(id: string, key: K, val: DraftHabit[K]) {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const next = { ...h, [key]: val };
        if (key === "tracking_type") {
          if (val === "time") {
            next.input_unit = "min";
            next.target_input = 30;
          } else if (val === "count") {
            next.input_unit = "reps";
            next.target_input = 10;
          } else {
            next.input_unit = "count";
            next.target_input = 1;
          }
        }
        return next;
      })
    );
  }

  async function saveGoalAndHabits(e: React.FormEvent) {
    e.preventDefault();
    const valid = habits.filter((h) => h.title.trim().length > 0);
    if (!goalTitle.trim()) return setError("Enter your goal.");
    if (valid.length === 0) return setError("Add at least one daily activity.");

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
        target_total_value: Math.max(1, targetHours),
        target_date: targetDate || null,
        metric_unit: "hours",
        is_active: true,
      })
      .select("id")
      .single();

    if (goalErr || !createdGoal) {
      setSaving(false);
      return setError(goalErr?.message || "Failed to save goal.");
    }

    const rows = valid.map((h, idx) => {
      const { siUnit, siValue } = toCanonicalSI(Math.max(1, h.target_input), h.input_unit);
      const timeVal = h.time_slot === "custom" ? h.scheduled_time : null;
      return {
        user_id: user.id,
        goal_id: createdGoal.id,
        title: h.title.trim(),
        tracking_type: h.tracking_type,
        unit_code: siUnit,
        daily_target_value: siValue,
        target_label: `${h.target_input} ${h.input_unit}`,
        time_slot: h.time_slot,
        scheduled_time: timeVal,
        sort_order: idx,
        is_active: true,
      };
    });

    const { error: habitsErr } = await supabase.from("monk_habits").insert(rows);
    if (habitsErr) {
      setSaving(false);
      return setError(habitsErr.message);
    }

    router.refresh();
  }

  return (
    <form onSubmit={saveGoalAndHabits} className="w-full max-w-xl bg-white border border-[#E2E7E4] rounded-3xl p-7 space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[#17211E]">Shape your day around one goal</h1>
        <p className="text-xs text-[#5B6863]">
          Add time-based, count-based (5 pushups, 1 DSA problem), or timeless daily actions.
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
        <div className="grid grid-cols-2 gap-2.5">
          <input
            type="number"
            min={5}
            max={2000}
            value={targetHours}
            onChange={(e) => setTargetHours(Number(e.target.value || 60))}
            placeholder="Target hours"
            className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]"
          />
        </div>
        <input
          type="text"
          value={whyText}
          onChange={(e) => setWhyText(e.target.value)}
          placeholder="Why this matters (optional)"
          className="w-full px-4 py-2.5 text-xs rounded-xl border border-[#D8DFDB]"
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
            + Add Activity
          </button>
        </div>
      </div>

      {habits.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-[#EDF1EE]">
          {habits.map((h) => (
            <div key={h.id} className="p-3 rounded-2xl bg-[#FAFBF9] border border-[#E5EAE7] space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  required
                  value={h.title}
                  onChange={(e) => updateHabit(h.id, "title", e.target.value)}
                  placeholder="Daily activity (e.g., 5 pushups or DSA drill)"
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#D8DFDB] bg-white"
                />
                <button
                  type="button"
                  onClick={() => setHabits((p) => p.filter((x) => x.id !== h.id))}
                  className="text-xs text-[#87948F] hover:text-red-700 px-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={h.tracking_type}
                  onChange={(e) => updateHabit(h.id, "tracking_type", e.target.value as TrackingType)}
                  className="col-span-3 px-2 py-1.5 text-[11px] rounded-lg border border-[#D8DFDB] bg-white"
                >
                  <option value="time">Time</option>
                  <option value="count">Count</option>
                  <option value="binary">Check</option>
                </select>

                {h.tracking_type !== "binary" && (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={h.target_input}
                      onChange={(e) => updateHabit(h.id, "target_input", Number(e.target.value || 1))}
                      className="col-span-2 px-2 py-1.5 text-[11px] rounded-lg border border-[#D8DFDB] bg-white"
                    />
                    <select
                      value={h.input_unit}
                      onChange={(e) => updateHabit(h.id, "input_unit", e.target.value as UnitCode)}
                      className="col-span-2 px-1.5 py-1.5 text-[11px] rounded-lg border border-[#D8DFDB] bg-white"
                    >
                      {h.tracking_type === "time" ? (
                        <>
                          <option value="min">min</option>
                          <option value="hr">hr</option>
                        </>
                      ) : (
                        <>
                          <option value="reps">reps</option>
                          <option value="problems">problems</option>
                          <option value="pages">pages</option>
                          <option value="count">count</option>
                          <option value="km">km</option>
                        </>
                      )}
                    </select>
                  </>
                )}

                <select
                  value={h.time_slot}
                  onChange={(e) => updateHabit(h.id, "time_slot", e.target.value as TimeSlot)}
                  className={`${h.tracking_type === "binary" ? "col-span-6" : "col-span-3"} px-2 py-1.5 text-[11px] rounded-lg border border-[#D8DFDB] bg-white`}
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="anytime">Anytime</option>
                  <option value="custom">Exact Time</option>
                </select>

                {h.time_slot === "custom" && (
                  <input
                    type="time"
                    value={h.scheduled_time}
                    onChange={(e) => updateHabit(h.id, "scheduled_time", e.target.value)}
                    className="col-span-2 px-1.5 py-1.5 text-[11px] rounded-lg border border-[#D8DFDB] bg-white"
                  />
                )}
              </div>
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
          {saving ? "Saving…" : "Lock My Daily Rhythm"}
        </button>
      )}
    </form>
  );
}