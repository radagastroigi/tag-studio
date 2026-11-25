"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatSIValue, TIME_SLOT_LABELS, type TimeSlot, type TrackingType } from "@/lib/units";

export type HabitRow = {
  id: string;
  title: string;
  target_label: string;
  scheduled_time: string | null;
  time_slot: TimeSlot;
  tracking_type: TrackingType;
  unit_code: string;
  daily_target_value: number;
};

export type CheckinRow = {
  habit_id: string;
  status: "done" | "partly" | "skipped";
  actual_value: number;
};

interface NowFocusViewProps {
  goalTitle: string;
  todayIso: string;
  habits: HabitRow[];
  initialCheckins: CheckinRow[];
}

export function NowFocusView({ goalTitle, todayIso, habits, initialCheckins }: NowFocusViewProps) {
  const [checkins, setCheckins] = useState<Record<string, CheckinRow>>(() => {
    const map: Record<string, CheckinRow> = {};
    for (const c of initialCheckins) map[c.habit_id] = c;
    return map;
  });

  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [manualInput, setManualInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = habits.filter((h) => !checkins[h.id]);
  const current = pending[0] ?? null;
  const completedCount = habits.length - pending.length;

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    setTimerRunning(false);
    setElapsedSecs(0);
    setManualInput("");
  }, [current?.id]);

  async function recordCheckin(status: "done" | "partly" | "skipped") {
    if (!current) return;
    setSaving(true);
    setError(null);
    setTimerRunning(false);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return setError("Session expired. Please sign in again.");
    }

    // Compute canonical SI actual_value
    let actualSI = 0;
    if (status !== "skipped") {
      if (current.tracking_type === "time") {
        if (manualInput.trim() && Number(manualInput) > 0) {
          actualSI = Math.round(Number(manualInput) * 60); // manual mins -> seconds
        } else if (elapsedSecs > 0) {
          actualSI = elapsedSecs;
        } else {
          actualSI = status === "done" ? current.daily_target_value : Math.round(current.daily_target_value * 0.5);
        }
      } else if (current.tracking_type === "count") {
        if (manualInput.trim() && Number(manualInput) >= 0) {
          actualSI = Number(manualInput);
        } else {
          actualSI = status === "done" ? current.daily_target_value : Math.max(1, Math.round(current.daily_target_value * 0.5));
        }
      } else {
        actualSI = status === "done" ? 1 : 0.5;
      }
    }

    const durationMins = current.unit_code === "s" ? Math.round(actualSI / 60) : 0;

    const { error: dbErr } = await supabase.from("monk_checkins").upsert(
      {
        user_id: user.id,
        habit_id: current.id,
        checkin_date: todayIso,
        status,
        duration_mins: durationMins,
        actual_value: actualSI,
        target_value_snapshot: current.daily_target_value,
      },
      { onConflict: "habit_id,checkin_date" }
    );

    if (dbErr) {
      setSaving(false);
      return setError(dbErr.message);
    }

    setCheckins((prev) => ({
      ...prev,
      [current.id]: { habit_id: current.id, status, actual_value: actualSI },
    }));
    setSaving(false);
  }

  if (!current) {
    const showedUp = Object.values(checkins).filter((c) => c.status !== "skipped").length;
    return (
      <div className="w-full max-w-md bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F2EE] text-[#256453] flex items-center justify-center text-lg font-semibold">✓</div>
        <h1 className="text-xl font-semibold">You showed up for {showedUp} of {habits.length} today.</h1>
        <p className="text-sm text-[#5B6863]">Rest easy. Consistency compounds quietly toward {goalTitle}.</p>
      </div>
    );
  }

  const slotLabel = current.scheduled_time
    ? current.scheduled_time.slice(0, 5)
    : TIME_SLOT_LABELS[current.time_slot || "anytime"];
  const mm = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
  const ss = String(elapsedSecs % 60).padStart(2, "0");

  return (
    <div className="w-full max-w-md bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center space-y-6">
      <div className="space-y-1">
        <div className="text-xs font-mono text-[#5B6863]">
          Step {completedCount + 1} of {habits.length} · {slotLabel}
        </div>
        <div className="text-xs text-[#256453] font-medium">{goalTitle}</div>
      </div>

      <div className="space-y-1.5 py-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[#17211E]">{current.title}</h1>
        <p className="text-sm text-[#5B6863]">
          Target: {formatSIValue(current.daily_target_value, current.unit_code, current.tracking_type)}
        </p>
      </div>

      {/* Adaptive Input: Timer + Manual Mins OR Count Input */}
      {current.tracking_type === "time" && (
        <div className="space-y-3">
          {(elapsedSecs > 0 || timerRunning) && (
            <div className="font-mono text-2xl font-semibold text-[#17211E]">{mm}:{ss}</div>
          )}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              className="px-4 py-2 rounded-full bg-[#F2F5F3] hover:bg-[#E8F2EE] text-xs font-medium text-[#256453]"
            >
              {timerRunning ? "Pause timer" : elapsedSecs > 0 ? "Resume timer" : "Start quiet timer"}
            </button>
            <input
              type="number"
              min={1}
              max={600}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="or mins"
              className="w-24 px-3 py-1.5 text-xs text-center rounded-full border border-[#D8DFDB]"
            />
          </div>
        </div>
      )}

      {current.tracking_type === "count" && (
        <div className="flex items-center justify-center gap-2">
          <input
            type="number"
            min={0}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={`Enter ${current.unit_code}`}
            className="w-36 px-3.5 py-2 text-xs text-center rounded-xl border border-[#D8DFDB]"
          />
        </div>
      )}

      {error && <div className="text-xs text-red-700 bg-red-50 rounded-xl p-2.5">{error}</div>}

      <div className="space-y-2.5 pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => recordCheckin("done")}
          className="w-full py-3.5 rounded-2xl bg-[#17211E] hover:bg-[#256453] text-white text-sm font-semibold transition"
        >
          {saving ? "Saving…" : "Showed Up — Done"}
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => recordCheckin("partly")}
            className="py-2.5 rounded-xl bg-[#E8F2EE] text-[#256453] text-xs font-semibold"
          >
            Partly Done
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => recordCheckin("skipped")}
            className="py-2.5 rounded-xl border border-[#D8DFDB] text-[#5B6863] text-xs font-medium"
          >
            Not Today
          </button>
        </div>
      </div>
    </div>
  );
}