"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type HabitRow = {
  id: string;
  title: string;
  target_label: string;
  scheduled_time: string;
};

export type CheckinRow = {
  habit_id: string;
  status: "done" | "partly" | "skipped";
  duration_mins: number;
};

interface NowFocusViewProps {
  goalTitle: string;
  todayIso: string;
  habits: HabitRow[];
  initialCheckins: CheckinRow[];
}

export function NowFocusView({
  goalTitle,
  todayIso,
  habits,
  initialCheckins,
}: NowFocusViewProps) {
  const [checkins, setCheckins] = useState<Record<string, CheckinRow>>(() => {
    const map: Record<string, CheckinRow> = {};
    for (const c of initialCheckins) map[c.habit_id] = c;
    return map;
  });

  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  // Pick the first habit not yet checked in today
  const pendingHabits = habits.filter((h) => !checkins[h.id]);
  const currentHabit = pendingHabits[0] ?? null;
  const completedCount = habits.length - pendingHabits.length;

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  // Reset timer whenever active habit changes
  useEffect(() => {
    setTimerRunning(false);
    setElapsedSecs(0);
  }, [currentHabit?.id]);

  async function recordCheckin(status: "done" | "partly" | "skipped") {
    if (!currentHabit) return;
    setSaving(true);
    setError(null);
    setTimerRunning(false);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return setError("Session expired. Please sign in again.");
    }

    const durationMins = elapsedSecs >= 30 ? Math.max(1, Math.round(elapsedSecs / 60)) : 0;

    const { error: dbErr } = await supabase.from("monk_checkins").upsert(
      {
        user_id: user.id,
        habit_id: currentHabit.id,
        checkin_date: todayIso,
        status,
        duration_mins: durationMins,
      },
      { onConflict: "habit_id,checkin_date" }
    );

    if (dbErr) {
      setSaving(false);
      return setError(dbErr.message);
    }

    setCheckins((prev) => ({
      ...prev,
      [currentHabit.id]: {
        habit_id: currentHabit.id,
        status,
        duration_mins: durationMins,
      },
    }));
    setSaving(false);
  }

  const mm = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
  const ss = String(elapsedSecs % 60).padStart(2, "0");

  // All habits for today handled -> Serene completion state
  if (!currentHabit) {
    const showedUpCount = Object.values(checkins).filter(
      (c) => c.status === "done" || c.status === "partly"
    ).length;

    return (
      <div className="w-full max-w-md bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center space-y-6">
        <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F2EE] text-[#256453] flex items-center justify-center text-lg font-semibold">
          ✓
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#256453]">Today is complete</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#17211E]">
            You showed up for {showedUpCount} of {habits.length} commitments.
          </h1>
          <p className="text-sm text-[#5B6863] leading-relaxed">
            No need to overthink progress. Rest well—tomorrow is another clean day toward{" "}
            <span className="text-[#17211E] font-medium">{goalTitle}</span>.
          </p>
        </div>

        <div className="pt-4 border-t border-[#EDF1EE] space-y-2 text-left">
          {habits.map((h) => {
            const c = checkins[h.id];
            const label =
              c?.status === "done" ? "Done" : c?.status === "partly" ? "Partly done" : "Skipped";
            return (
              <div key={h.id} className="flex items-center justify-between text-xs py-1">
                <span className="text-[#17211E]">{h.title}</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-medium ${
                    c?.status === "skipped"
                      ? "bg-[#F0F2F1] text-[#5B6863]"
                      : "bg-[#E8F2EE] text-[#256453]"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center space-y-7">
        {/* Quiet Step Context */}
        <div className="space-y-1">
          <div className="text-xs font-mono text-[#5B6863]">
            Step {completedCount + 1} of {habits.length} · {currentHabit.scheduled_time.slice(0, 5)}
          </div>
          <div className="text-xs text-[#256453] font-medium">{goalTitle}</div>
        </div>

        {/* Single Activity Focus */}
        <div className="space-y-2 py-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#17211E] leading-snug">
            {currentHabit.title}
          </h1>
          <p className="text-sm text-[#5B6863]">Commitment: {currentHabit.target_label}</p>
        </div>

        {/* Optional Calm Timer */}
        <div className="flex flex-col items-center gap-2">
          {elapsedSecs > 0 || timerRunning ? (
            <div className="font-mono text-2xl font-semibold text-[#17211E]">{mm}:{ss}</div>
          ) : null}
          <button
            type="button"
            onClick={() => setTimerRunning((r) => !r)}
            className="px-4 py-1.5 rounded-full bg-[#F2F5F3] hover:bg-[#E8F2EE] text-xs font-medium text-[#256453] transition"
          >
            {timerRunning ? "Pause timer" : elapsedSecs > 0 ? "Resume timer" : "Start quiet timer"}
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">
            {error}
          </div>
        )}

        {/* Three Honest Check-In Actions */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => recordCheckin("done")}
            className="w-full py-3.5 rounded-2xl bg-[#17211E] hover:bg-[#256453] text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Showed Up — Done"}
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => recordCheckin("partly")}
              className="py-2.5 rounded-xl bg-[#E8F2EE] hover:bg-[#D8EAE3] text-[#256453] text-xs font-semibold transition disabled:opacity-50"
            >
              Partly Done
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => recordCheckin("skipped")}
              className="py-2.5 rounded-xl border border-[#D8DFDB] hover:bg-[#F4F6F5] text-[#5B6863] text-xs font-medium transition disabled:opacity-50"
            >
              Not Today
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Peek at Today's Rhythm (Hidden by default to prevent distraction) */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowSchedule((s) => !s)}
          className="text-xs text-[#5B6863] hover:text-[#17211E] underline"
        >
          {showSchedule ? "Hide today's rhythm" : `Peek at today's rhythm (${habits.length} steps)`}
        </button>

        {showSchedule && (
          <div className="mt-3 bg-white border border-[#E2E7E4] rounded-2xl p-4 text-left divide-y divide-[#EDF1EE]">
            {habits.map((h) => {
              const c = checkins[h.id];
              return (
                <div key={h.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-[#5B6863] mr-2.5">{h.scheduled_time.slice(0, 5)}</span>
                    <span className={c ? "line-through text-[#87948F]" : "text-[#17211E] font-medium"}>
                      {h.title}
                    </span>
                  </div>
                  <span className="text-[#5B6863]">{c ? c.status : h.target_label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}