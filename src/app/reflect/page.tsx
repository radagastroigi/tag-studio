import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WeeklyReflectClient } from "@/components/WeeklyReflectClient";

export default async function ReflectPage() {
  const supabase = await createServerSupabaseClient();

  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);
  const weekStart = weekAgo.toISOString().slice(0, 10);

  const { data: goals } = await supabase
    .from("monk_goals")
    .select("id, title")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  const activeGoal = goals?.[0] ?? null;

  const { data: checkins } = activeGoal
    ? await supabase
        .from("monk_checkins")
        .select("status, duration_mins, checkin_date")
        .gte("checkin_date", weekStart)
    : { data: [] };

  const { data: existingReview } = activeGoal
    ? await supabase
        .from("monk_weekly_reviews")
        .select("user_reflection, ai_summary")
        .eq("week_start", weekStart)
        .maybeSingle()
    : { data: null };

  const rows = checkins || [];
  const doneCount = rows.filter((r) => r.status === "done").length;
  const partlyCount = rows.filter((r) => r.status === "partly").length;
  const skippedCount = rows.filter((r) => r.status === "skipped").length;
  const totalMinutes = rows.reduce((s, r) => s + (r.duration_mins || 0), 0);
  const statsSummary = `Done: ${doneCount}, Partly Done: ${partlyCount}, Skipped: ${skippedCount}, Timed Minutes: ${totalMinutes}.`;

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center p-6 pt-10">
      <div className="w-full max-w-lg flex items-center justify-between mb-6 text-xs text-[#5B6863]">
        <Link href="/" className="font-semibold text-[#17211E] hover:underline">
          ← Back to Now
        </Link>
        <span>Monkthetics Weekly Review</span>
      </div>

      {!activeGoal ? (
        <div className="w-full max-w-lg bg-white border border-[#E2E7E4] rounded-3xl p-8 text-center text-sm text-[#5B6863]">
          Set your goal on the home screen first.
        </div>
      ) : (
        <WeeklyReflectClient
          goalId={activeGoal.id}
          goalTitle={activeGoal.title}
          weekStart={weekStart}
          doneCount={doneCount}
          partlyCount={partlyCount}
          skippedCount={skippedCount}
          totalMinutes={totalMinutes}
          statsSummary={statsSummary}
          initialReflection={existingReview?.user_reflection || ""}
          initialEvaluation={existingReview?.ai_summary || null}
        />
      )}
    </main>
  );
}