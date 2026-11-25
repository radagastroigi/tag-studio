import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExcelTransferPanel } from "@/components/ExcelTransferPanel";

export default async function ProgressPage() {
  const supabase = await createServerSupabaseClient();

  const { data: goals } = await supabase
    .from("monk_goals")
    .select("id, title, target_total_value, target_date")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  const goal = goals?.[0] ?? null;

  const { data: checkins } = goal
    ? await supabase
        .from("monk_checkins")
        .select("id, checkin_date, status, actual_value, efficiency_pct, duration_mins, monk_habits(title, unit_code)")
        .order("checkin_date", { ascending: false })
        .limit(90)
    : { data: [] };

  const rows = checkins || [];
  const showedUp = rows.filter((r) => r.status === "done" || r.status === "partly");
  const avgEfficiency = showedUp.length
    ? Math.round(showedUp.reduce((s, r) => s + Number(r.efficiency_pct || 0), 0) / showedUp.length)
    : 0;

  const totalHours = rows.reduce((s, r) => s + Number(r.duration_mins || 0), 0) / 60;
  const targetHours = Number(goal?.target_total_value || 80);
  const progressPct = Math.min(100, Math.round((totalHours / Math.max(1, targetHours)) * 100));

  // 7-day rolling pace -> Estimated Completion Date
  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const sevenIso = sevenAgo.toISOString().slice(0, 10);
  const last7Hrs = rows
    .filter((r) => r.checkin_date >= sevenIso)
    .reduce((s, r) => s + Number(r.duration_mins || 0), 0) / 60;
  const dailyPaceHrs = last7Hrs / 7;
  const remainingHrs = Math.max(0, targetHours - totalHours);

  let etaLabel = "Log 2+ days to forecast ETA";
  if (remainingHrs === 0) etaLabel = "Goal target achieved";
  else if (dailyPaceHrs >= 0.1) {
    const days = Math.ceil(remainingHrs / dailyPaceHrs);
    const eta = new Date();
    eta.setDate(eta.getDate() + days);
    etaLabel = `Projected finish: ${eta.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} (${days}d at ${last7Hrs.toFixed(1)}h/wk)`;
  }

  // Last 14 days bar strip
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const iso = d.toISOString().slice(0, 10);
    const dayRows = rows.filter((r) => r.checkin_date === iso && r.status !== "skipped");
    return { iso, day: iso.slice(8), count: dayRows.length };
  });

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center p-6 pt-8 pb-16">
      <div className="w-full max-w-2xl space-y-5">
        <div className="flex items-center justify-between text-xs text-[#5B6863]">
          <Link href="/" className="font-semibold text-[#17211E] hover:underline">← Back to Now</Link>
          <Link href="/reflect" className="font-medium hover:text-[#17211E]">Evaluations (Weekly / Monthly / Ad-Hoc)</Link>
        </div>

        {!goal ? (
          <div className="bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center text-sm text-[#5B6863]">
            Create a goal on the home screen to unlock analytics.
          </div>
        ) : (
          <>
            {/* Progress Card & ETA */}
            <div className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-[#256453]">Goal Progress Card</div>
                  <h1 className="text-xl font-semibold mt-0.5">{goal.title}</h1>
                </div>
                <span className="font-mono text-lg font-bold text-[#256453]">{progressPct}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#E8EDE9] overflow-hidden">
                <div className="h-full bg-[#256453] rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="text-xs text-[#36433E] font-medium">{etaLabel}</div>
            </div>

            {/* Performance & Efficiency KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-[#E2E7E4] rounded-2xl p-4">
                <div className="text-[11px] text-[#5B6863]">Showed Up</div>
                <div className="text-xl font-bold mt-1">{showedUp.length}</div>
              </div>
              <div className="bg-white border border-[#E2E7E4] rounded-2xl p-4">
                <div className="text-[11px] text-[#5B6863]">Avg Efficiency</div>
                <div className="text-xl font-bold mt-1 text-[#256453]">{avgEfficiency}%</div>
              </div>
              <div className="bg-white border border-[#E2E7E4] rounded-2xl p-4">
                <div className="text-[11px] text-[#5B6863]">Hours Logged</div>
                <div className="text-xl font-bold mt-1">{totalHours.toFixed(1)}h</div>
              </div>
              <div className="bg-white border border-[#E2E7E4] rounded-2xl p-4">
                <div className="text-[11px] text-[#5B6863]">7-Day Pace</div>
                <div className="text-xl font-bold mt-1">{last7Hrs.toFixed(1)}h/wk</div>
              </div>
            </div>

            {/* 14-Day Consistency Strip */}
            <div className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-3">
              <h2 className="text-sm font-semibold">14-Day Consistency Strip</h2>
              <div className="grid grid-cols-7 sm:grid-cols-14 gap-2">
                {last14.map((d) => (
                  <div
                    key={d.iso}
                    className={`rounded-xl p-2 text-center ${
                      d.count === 0 ? "bg-[#EDF1EE] text-[#6E7A75]" : "bg-[#256453] text-white"
                    }`}
                  >
                    <div className="text-[10px] opacity-80">{d.day}</div>
                    <div className="font-mono text-xs font-bold mt-0.5">{d.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Excel Export + Semantic Import */}
            <ExcelTransferPanel goalId={goal.id} />

            {/* History Ledger */}
            <div className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-3">
              <h2 className="text-sm font-semibold">Execution History ({rows.length})</h2>
              <div className="divide-y divide-[#EDF1EE] text-xs">
                {rows.slice(0, 20).map((r) => {
                  const habitMeta = Array.isArray(r.monk_habits) ? r.monk_habits[0] : r.monk_habits;
                  return (
                    <div key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-[#17211E]">{habitMeta?.title || "Activity"}</div>
                        <div className="text-[#5B6863]">{r.checkin_date} · {r.status}</div>
                      </div>
                      <span className="font-mono px-2 py-0.5 rounded-lg bg-[#E8F2EE] text-[#256453]">
                        {r.efficiency_pct}% eff
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}