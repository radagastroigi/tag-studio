import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DailyWidget } from "@/components/DailyWidget";
import type { CoreGoal, DailyActivity, WorkSession } from "@/types/monk";

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("monk_profiles")
    .select("display_name, onboarding_step")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.onboarding_step < 2) redirect("/onboarding");
  if (profile.onboarding_step < 3) redirect("/setup");

  const todayIso = new Date().toISOString().slice(0, 10);

  const [gRes, aRes, sRes] = await Promise.all([
    supabase.from("monk_core_goals").select("id, horizon, title, why_statement, target_hours, target_date").eq("is_active", true),
    supabase.from("monk_activities").select("id, goal_id, title, scheduled_time, daily_target_mins").eq("is_active", true).order("scheduled_time", { ascending: true, nullsFirst: false }),
    supabase.from("monk_sessions").select("id, activity_id, session_date, started_at, ended_at, duration_mins, status").eq("session_date", todayIso),
  ]);

  const goals = (gRes.data || []) as CoreGoal[];
  const shortGoal = goals.find((g) => g.horizon === "short_term");
  const activities = (aRes.data || []) as DailyActivity[];
  if (!shortGoal) redirect("/onboarding");
  if (!activities.length) redirect("/setup");

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex items-center justify-between mb-6 text-xs text-[#5B6863]">
        <span className="font-semibold text-[#17211E]">Monkthetics</span>
        <div className="flex items-center gap-4">
          <Link href="/insights" className="font-medium hover:text-[#17211E]">Insights</Link>
          <Link href="/setup" className="hover:text-[#17211E]">Edit Plan</Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="underline hover:text-[#17211E]">Sign out</button>
          </form>
        </div>
      </div>

      <DailyWidget
        displayName={profile.display_name || "Builder"}
        shortGoalTitle={shortGoal.title}
        todayIso={todayIso}
        activities={activities}
        initialSessions={(sRes.data || []) as WorkSession[]}
      />
    </main>
  );
}