import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-[#F6F7F5] text-[#17211E] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl flex items-center justify-between mb-5 text-xs text-[#5B6863]">
        <span className="font-semibold text-[#17211E]">Monkthetics</span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="underline hover:text-[#17211E]">Sign out</button>
        </form>
      </div>
      <OnboardingFlow userEmail={user?.email || ""} />
    </main>
  );
}