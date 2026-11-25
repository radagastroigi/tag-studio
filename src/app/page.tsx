import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoalPlanner } from "@/components/GoalPlanner";
import { NowFocusView, type HabitRow, type CheckinRow } from "@/components/NowFocusView";

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: goals } = await supabase
    .from("monk_goals")
    .select("id, title")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  const activeGoal = goals?.[0] ?? null;

  const { data: habits } = activeGoal
    ? await supabase
        .from("monk_habits")
        .select("id, title, target_label, scheduled_time, time_slot, tracking_type, unit_code, daily_target_value")
        .eq("goal_id", activeGoal.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const { data: checkins } = activeGoal
    ? await supabase
        .from("monk_checkins")
        .select("habit_id, status, actual_value")
        .eq("checkin_date", todayIso)
    : { data: [] };

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex items-center justify-between mb-6 text-xs text-[#5B6863]">
        <span className="font-semibold text-[#17211E]">Monkthetics</span>
        <div className="flex items-center gap-4">
          {activeGoal && (
            <>
              <Link href="/progress" className="hover:text-[#17211E] font-medium">Progress</Link>
              <Link href="/reflect" className="hover:text-[#17211E] font-medium">Reflect</Link>
            </>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" className="underline hover:text-[#17211E]">Sign out</button>
          </form>
        </div>
      </div>

      {!activeGoal || !habits?.length ? (
        <GoalPlanner />
      ) : (
        <NowFocusView
          goalTitle={activeGoal.title}
          todayIso={todayIso}
          habits={habits as HabitRow[]}
          initialCheckins={(checkins || []) as CheckinRow[]}
        />
      )}
    </main>
  );
}