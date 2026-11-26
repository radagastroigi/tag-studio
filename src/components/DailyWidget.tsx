"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyActivity, WorkSession } from "@/types/monk";

interface DailyWidgetProps {
  displayName: string;
  shortGoalTitle: string;
  todayIso: string;
  activities: DailyActivity[];
  initialSessions: WorkSession[];
}

export function DailyWidget({
  displayName,
  shortGoalTitle,
  todayIso,
  activities,
  initialSessions,
}: DailyWidgetProps) {
  const [sessions, setSessions] = useState<Record<string, WorkSession>>(() => {
    const map: Record<string, WorkSession> = {};
    for (const s of initialSessions) map[s.activity_id] = s;
    return map;
  });

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMins, setEditMins] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runningAct = activities.find((a) => sessions[a.id]?.status === "running") ?? null;
  const pendingActs = activities.filter((a) => !sessions[a.id] || sessions[a.id].status === "running");
  const activeAct = runningAct ?? pendingActs[0] ?? null;
  const activeSession = activeAct ? sessions[activeAct.id] : null;
  const isRunning = activeSession?.status === "running" && Boolean(activeSession.started_at);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const elapsedSecs =
    isRunning && activeSession?.started_at
      ? Math.max(0, Math.floor((nowMs - new Date(activeSession.started_at).getTime()) / 1000))
      : 0;

  async function startWork(act: DailyActivity) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setError("Session expired.");

    const startedAt = new Date().toISOString();
    const { data, error: dbErr } = await supabase
      .from("monk_sessions")
      .upsert(
        {
          user_id: user.id,
          activity_id: act.id,
          session_date: todayIso,
          started_at: startedAt,
          ended_at: null,
          status: "running",
          updated_at: startedAt,
        },
        { onConflict: "activity_id,session_date" }
      )
      .select("*")
      .single();

    setSaving(false);
    if (dbErr || !data) return setError(dbErr?.message || "Could not start session.");
    setNowMs(Date.now());
    setSessions((prev) => ({ ...prev, [act.id]: data as WorkSession }));
  }

  async function endWork(act: DailyActivity, finalStatus: "done" | "partly" | "skipped") {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setError("Session expired.");

    const existing = sessions[act.id];
    const endedAt = new Date().toISOString();
    let mins = existing?.duration_mins || 0;

    if (finalStatus !== "skipped") {
      if (existing?.started_at) {
        const diffMins = Math.max(1, Math.round((Date.now() - new Date(existing.started_at).getTime()) / 60000));
        mins = mins + diffMins;
      } else {
        mins = finalStatus === "done" ? act.daily_target_mins : Math.max(5, Math.round(act.daily_target_mins * 0.5));
      }
    }

    const { data, error: dbErr } = await supabase
      .from("monk_sessions")
      .upsert(
        {
          user_id: user.id,
          activity_id: act.id,
          session_date: todayIso,
          started_at: existing?.started_at || endedAt,
          ended_at: endedAt,
          duration_mins: mins,
          status: finalStatus,
          updated_at: endedAt,
        },
        { onConflict: "activity_id,session_date" }
      )
      .select("*")
      .single();

    setSaving(false);
    if (dbErr || !data) return setError(dbErr?.message || "Could not save session.");
    setSessions((prev) => ({ ...prev, [act.id]: data as WorkSession }));
  }

  async function saveManualTime(actId: string) {
    const mins = Math.max(0, Math.min(720, Math.round(Number(editMins || 0))));
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setError("Session expired.");

    const act = activities.find((a) => a.id === actId);
    const status: WorkSession["status"] =
      mins === 0 ? "skipped" : act && mins >= act.daily_target_mins ? "done" : "partly";

    const { data, error: dbErr } = await supabase
      .from("monk_sessions")
      .upsert(
        {
          user_id: user.id,
          activity_id: actId,
          session_date: todayIso,
          duration_mins: mins,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "activity_id,session_date" }
      )
      .select("*")
      .single();

    setSaving(false);
    if (dbErr || !data) return setError(dbErr?.message || "Could not update time.");
    setSessions((prev) => ({ ...prev, [actId]: data as WorkSession }));
    setEditingId(null);
  }

  const mm = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
  const ss = String(elapsedSecs % 60).padStart(2, "0");
  const totalTodayMins = Object.values(sessions).reduce((s, x) => s + (x.duration_mins || 0), 0);

  return (
    <div className="w-full max-w-md space-y-5">
      {!activeAct ? (
        <div className="bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#E8F2EE] text-[#256453] flex items-center justify-center text-lg font-semibold">âœ“</div>
          <h1 className="text-xl font-semibold">Done for today, {displayName}.</h1>
          <p className="text-sm text-[#5B6863]">
            Total captured today: <strong>{totalTodayMins} min</strong> toward{" "}
            <span className="text-[#17211E] font-medium">{shortGoalTitle}</span>.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center space-y-6">
          <div className="space-y-1">
            <div className="text-xs font-mono text-[#5B6863]">
              {activeAct.scheduled_time ? activeAct.scheduled_time.slice(0, 5) : "Flexible"} Â· Target {activeAct.daily_target_mins}m
            </div>
            <div className="text-xs font-medium text-[#256453]">{shortGoalTitle}</div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-[#17211E] py-1">{activeAct.title}</h1>

          {isRunning && (
            <div className="space-y-1">
              <div className="font-mono text-4xl font-bold text-[#17211E] tracking-tight">{mm}:{ss}</div>
              <div className="text-[11px] text-[#256453]">Running safely in background</div>
            </div>
          )}

          {error && <div className="text-xs text-red-700 bg-red-50 rounded-xl p-2.5">{error}</div>}

          {!isRunning ? (
            <div className="space-y-2.5 pt-2">
              <button type="button" disabled={saving} onClick={() => startWork(activeAct)} className="w-full py-3.5 rounded-2xl bg-[#17211E] hover:bg-[#256453] text-white text-sm font-semibold transition">
                Start Activity
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={saving} onClick={() => endWork(activeAct, "done")} className="py-2.5 rounded-xl bg-[#E8F2EE] text-[#256453] text-xs font-semibold">
                  Mark Done ({activeAct.daily_target_mins}m)
                </button>
                <button type="button" disabled={saving} onClick={() => endWork(activeAct, "skipped")} className="py-2.5 rounded-xl border border-[#D8DFDB] text-[#5B6863] text-xs font-medium">
                  Skip Today
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 pt-2">
              <button type="button" disabled={saving} onClick={() => endWork(activeAct, "done")} className="w-full py-3.5 rounded-2xl bg-[#256453] hover:bg-[#1C4D40] text-white text-sm font-semibold transition">
                End &amp; Save as Done
              </button>
              <button type="button" disabled={saving} onClick={() => endWork(activeAct, "partly")} className="w-full py-2.5 rounded-xl bg-[#F2F5F3] text-[#17211E] text-xs font-semibold">
                End as Partly Done
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-[#E2E7E4] rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#17211E]">Today&apos;s Activities (Edit Time)</span>
          <span className="font-mono text-[#256453]">{totalTodayMins} min total</span>
        </div>

        <div className="divide-y divide-[#EDF1EE]">
          {activities.map((a) => {
            const s = sessions[a.id];
            const isEditing = editingId === a.id;
            return (
              <div key={a.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-[#17211E] truncate">{a.title}</div>
                  <div className="text-[11px] text-[#5B6863]">
                    {a.scheduled_time ? a.scheduled_time.slice(0, 5) : "Anytime"} Â· {s ? s.status : "pending"}
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input type="number" min={0} max={720} value={editMins} onChange={(e) => setEditMins(e.target.value)} className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-[#D8DFDB]" />
                    <button type="button" onClick={() => saveManualTime(a.id)} className="px-2.5 py-1 rounded-lg bg-[#17211E] text-white text-[11px] font-semibold">Save</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(a.id);
                      setEditMins(String(s?.duration_mins ?? a.daily_target_mins));
                    }}
                    className="font-mono px-2.5 py-1 rounded-lg bg-[#F4F6F5] hover:bg-[#E8F2EE] text-[#17211E] shrink-0"
                  >
                    {s?.duration_mins ?? 0}m âœŽ
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}