import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SetupFlow } from "@/components/SetupFlow";
import type { CoreGoal } from "@/types/monk";

export default async function SetupPage() {
  const supabase = await createServerSupabaseClient();
  const { data: goals } = await supabase
    .from("monk_core_goals")
    .select("id, horizon, title, why_statement, target_hours, target_date")
    .eq("is_active", true);

  const list = (goals || []) as CoreGoal[];
  const shortGoal = list.find((g) => g.horizon === "short_term");
  const longGoal = list.find((g) => g.horizon === "long_term") ?? null;

  if (!shortGoal) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl flex items-center justify-between mb-5 text-xs text-[#5B6863]">
        <span className="font-semibold text-[#17211E]">Monkthetics</span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="underline hover:text-[#17211E]">Sign out</button>
        </form>
      </div>
      <SetupFlow shortGoal={shortGoal} longGoal={longGoal} />
    </main>
  );
}