import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MilestoneChecklist } from "@/components/MilestoneChecklist";
import type { CoreGoal, Milestone } from "@/types/monk";

function predictGoal(goal: CoreGoal, loggedHrs: number, weeklyPaceHrs: number) {
  const remainingHrs = Math.max(0, Number(goal.target_hours) - loggedHrs);
  const pct = Math.min(100, Math.round((loggedHrs / Math.max(1, Number(goal.target_hours))) * 100));

  const today = new Date();
  const target = new Date(goal.target_date + "T00:00:00");
  const daysLeft = Math.max(1, Math.ceil((target.getTime() - today.getTime()) / 86400000));
  const requiredPerWeek = (remainingHrs / daysLeft) * 7;

  let eta = "Log 2+ days to calculate prediction";
  let status: "Achieved" | "On Track" | "Behind Pace" = "On Track";

  if (remainingHrs === 0) {
    eta = "Goal hours achieved";
    status = "Achieved";
  } else if (weeklyPaceHrs >= 0.5) {
    const daysNeeded = Math.ceil((remainingHrs / weeklyPaceHrs) * 7);
    const predDate = new Date();
    predDate.setDate(predDate.getDate() + daysNeeded);
    eta = `Predicted finish: ${predDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} (${daysNeeded}d at ${weeklyPaceHrs.toFixed(1)}h/wk)`;
    status = weeklyPaceHrs >= requiredPerWeek * 0.9 ? "On Track" : "Behind Pace";
  } else {
    status = "Behind Pace";
  }

  return { pct, remainingHrs, requiredPerWeek, eta, status };
}

export default async function InsightsPage() {
  const supabase = await createServerSupabaseClient();

  const [gRes, mRes, sRes] = await Promise.all([
    supabase.from("monk_core_goals").select("*").eq("is_active", true),
    supabase.from("monk_milestones").select("id, goal_id, title, due_date, is_completed").order("sort_order", { ascending: true }),
    supabase.from("monk_sessions").select("session_date, duration_mins, status, monk_activities(scheduled_time)").order("session_date", { ascending: false }).limit(180),
  ]);

  const goals = (gRes.data || []) as CoreGoal[];
  const milestones = (mRes.data || []) as Milestone[];
  const sessions = sRes.data || [];

  const totalHrs = sessions.reduce((s, r) => s + Number(r.duration_mins || 0), 0) / 60;

  // Last 7 days
  const sevenDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const mins = sessions.filter((r) => r.session_date === iso).reduce((s, r) => s + Number(r.duration_mins || 0), 0);
    return { iso, label: d.toLocaleDateString("en-US", { weekday: "short" }), mins };
  });
  const weeklyPaceHrs = sevenDays.reduce((s, d) => s + d.mins, 0) / 60;
  const maxDayMins = Math.max(60, ...sevenDays.map((d) => d.mins));

  // Working-style peak slot detection
  const slotMins: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0, Flexible: 0 };
  for (const r of sessions) {
    const meta = Array.isArray(r.monk_activities) ? r.monk_activities[0] : r.monk_activities;
    const t = meta?.scheduled_time ? Number(String(meta.scheduled_time).slice(0, 2)) : -1;
    const bucket = t < 0 ? "Flexible" : t < 12 ? "Morning" : t < 17 ? "Afternoon" : "Evening";
    slotMins[bucket] += Number(r.duration_mins || 0);
  }
  const peakSlot = Object.entries(slotMins).sort((a, b) => b[1] - a[1])[0]?.[0] || "Morning";

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center p-6 pt-8 pb-16">
      <div className="w-full max-w-2xl space-y-5">
        <div className="flex items-center justify-between text-xs text-[#5B6863]">
          <Link href="/" className="font-semibold text-[#17211E] hover:underline">← Back to Daily Widget</Link>
          <div className="flex items-center gap-4">
            <a href="/api/excel/export" className="font-semibold text-[#256453] hover:underline">Export .xlsx</a>
            <Link href="/reflect" className="hover:text-[#17211E]">AI Reflection</Link>
          </div>
        </div>

        {/* Goal Completion Predictions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pred = predictGoal(g, totalHrs, weeklyPaceHrs);
            return (
              <div key={g.id} className="bg-white border border-[#E2E7E4] rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-wide text-[#5B6863]">
                    {g.horizon === "short_term" ? "Short-Term Goal" : "Long-Term Goal"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold ${
                      pred.status === "Behind Pace" ? "bg-[#FCECEC] text-[#B43E3E]" : "bg-[#E8F2EE] text-[#256453]"
                    }`}
                  >
                    {pred.status}
                  </span>
                </div>
                <h2 className="text-base font-semibold">{g.title}</h2>
                <div className="w-full h-2 rounded-full bg-[#E8EDE9] overflow-hidden">
                  <div className="h-full bg-[#256453] rounded-full" style={{ width: `${pred.pct}%` }} />
                </div>
                <div className="text-xs text-[#36433E]">{pred.eta}</div>
                <div className="text-[11px] text-[#5B6863]">
                  Need {pred.requiredPerWeek.toFixed(1)}h/wk · Target date {g.target_date}
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly Productivity Bars + Working Style */}
        <div className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">This Week&apos;s Productivity ({weeklyPaceHrs.toFixed(1)} hrs)</h2>
              <p className="text-xs text-[#5B6863]">
                Your strongest working window: <strong className="text-[#17211E]">{peakSlot}</strong>
              </p>
            </div>
            <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-[#E8F2EE] text-[#256453]">
              {totalHrs.toFixed(1)} hrs total
            </span>
          </div>

          <div className="grid grid-cols-7 gap-3 items-end h-36 pt-3">
            {sevenDays.map((d) => (
              <div key={d.iso} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[10px] font-mono text-[#5B6863]">{d.mins}m</span>
                <div className="w-full max-w-[36px] h-24 bg-[#EDF1EE] rounded-lg overflow-hidden flex items-end">
                  <div
                    className="w-full bg-[#256453] rounded-lg"
                    style={{ height: `${Math.max(4, Math.round((d.mins / maxDayMins) * 100))}%` }}
                  />
                </div>
                <span className="text-[11px] text-[#5B6863]">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones & Checkpoints */}
        <div className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-3">
          <h2 className="text-sm font-semibold">Goal Milestones &amp; Checkpoints</h2>
          <MilestoneChecklist initial={milestones} />
        </div>
      </div>
    </main>
  );
}