"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function OnboardingFlow({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [growthAspect, setGrowthAspect] = useState("Career & Craft");

  const [ltTitle, setLtTitle] = useState("");
  const [ltHours, setLtHours] = useState(300);
  const [ltDate, setLtDate] = useState(addDaysIso(365));

  const [stTitle, setStTitle] = useState("");
  const [stHours, setStHours] = useState(60);
  const [stDate, setStDate] = useState(addDaysIso(45));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ltTitle.trim() || !stTitle.trim()) {
      return setError("Please enter both your Long-Term Goal and Short-Term Goal.");
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return setError("Session expired. Please sign in again.");
    }

    const { error: profErr } = await supabase.from("monk_profiles").upsert(
      {
        user_id: user.id,
        display_name: displayName.trim() || userEmail.split("@")[0],
        age: age ? Number(age) : null,
        location: location.trim(),
        domain: domain.trim(),
        industry: industry.trim(),
        growth_aspect: growthAspect,
        onboarding_step: 2,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (profErr) {
      setSaving(false);
      return setError(profErr.message);
    }

    await supabase.from("monk_core_goals").update({ is_active: false }).eq("user_id", user.id);

    const { error: goalErr } = await supabase.from("monk_core_goals").insert([
      {
        user_id: user.id,
        horizon: "long_term",
        title: ltTitle.trim(),
        target_hours: Math.max(1, ltHours),
        target_date: ltDate,
        is_active: true,
      },
      {
        user_id: user.id,
        horizon: "short_term",
        title: stTitle.trim(),
        target_hours: Math.max(1, stHours),
        target_date: stDate,
        is_active: true,
      },
    ]);

    if (goalErr) {
      setSaving(false);
      return setError(goalErr.message);
    }

    router.push("/setup");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl bg-white border border-[#E2E7E4] rounded-3xl p-7 space-y-6">
      <div className="space-y-1">
        <div className="text-xs font-medium text-[#256453]">Step 1 of 2 · Foundation</div>
        <h1 className="text-xl font-semibold tracking-tight">Define who you&apos;re becoming</h1>
        <p className="text-xs text-[#5B6863]">
          Set 1 Long-Term Goal, 1 immediate Short-Term Goal, and your context so insights stay personal to your craft.
        </p>
      </div>

      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>}

      <div className="space-y-3">
        <div className="text-xs font-semibold text-[#17211E]">About You</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]" />
          <input type="number" min={12} max={100} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]" />
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Field / Role" className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]" />
          <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="px-3.5 py-2.5 text-xs rounded-xl border border-[#D8DFDB]" />
          <select value={growthAspect} onChange={(e) => setGrowthAspect(e.target.value)} className="px-3 py-2.5 text-xs rounded-xl border border-[#D8DFDB] bg-white">
            <option>Career &amp; Craft</option>
            <option>Building a Company</option>
            <option>Health &amp; Discipline</option>
            <option>Academic Mastery</option>
            <option>Financial Freedom</option>
          </select>
        </div>
      </div>

      <div className="space-y-2.5 pt-4 border-t border-[#EDF1EE]">
        <div className="text-xs font-semibold text-[#17211E]">1 Long-Term Goal (North Star)</div>
        <input type="text" required value={ltTitle} onChange={(e) => setLtTitle(e.target.value)} placeholder="e.g., Build a profitable SaaS company" className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D8DFDB]" />
        <div className="grid grid-cols-2 gap-2.5">
          <input type="number" min={10} value={ltHours} onChange={(e) => setLtHours(Number(e.target.value || 100))} className="px-3.5 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
          <input type="date" required value={ltDate} onChange={(e) => setLtDate(e.target.value)} className="px-3.5 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
        </div>
      </div>

      <div className="space-y-2.5 pt-4 border-t border-[#EDF1EE]">
        <div className="text-xs font-semibold text-[#256453]">1 Short-Term Goal (Immediate Milestone)</div>
        <input type="text" required value={stTitle} onChange={(e) => setStTitle(e.target.value)} placeholder="e.g., Crack a Tier-1 Backend/AI offer in 60 days" className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D8DFDB]" />
        <div className="grid grid-cols-2 gap-2.5">
          <input type="number" min={5} value={stHours} onChange={(e) => setStHours(Number(e.target.value || 40))} className="px-3.5 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
          <input type="date" required value={stDate} onChange={(e) => setStDate(e.target.value)} className="px-3.5 py-2 text-xs rounded-xl border border-[#D8DFDB]" />
        </div>
      </div>

      <button type="submit" disabled={saving} className="w-full py-3 rounded-2xl bg-[#17211E] hover:bg-[#256453] text-white text-sm font-semibold transition disabled:opacity-50">
        {saving ? "Saving…" : "Continue to Activities & Milestones →"}
      </button>
    </form>
  );
}
