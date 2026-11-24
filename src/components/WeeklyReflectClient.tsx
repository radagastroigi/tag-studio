"use client";

import { useState } from "react";

type WeeklyEvaluation = {
  working_well?: string[];
  needs_improvement?: string[];
  world_perspective?: string;
  next_week_adjustment?: string;
};

interface WeeklyReflectClientProps {
  goalId: string;
  goalTitle: string;
  weekStart: string;
  doneCount: number;
  partlyCount: number;
  skippedCount: number;
  totalMinutes: number;
  statsSummary: string;
  initialReflection: string;
  initialEvaluation: WeeklyEvaluation | null;
}

export function WeeklyReflectClient({
  goalId,
  goalTitle,
  weekStart,
  doneCount,
  partlyCount,
  skippedCount,
  totalMinutes,
  statsSummary,
  initialReflection,
  initialEvaluation,
}: WeeklyReflectClientProps) {
  const [reflection, setReflection] = useState(initialReflection);
  const [evaluation, setEvaluation] = useState<WeeklyEvaluation | null>(initialEvaluation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runEvaluation(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId,
          goalTitle,
          weekStart,
          userReflection: reflection,
          statsSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Could not save reflection.");
      else setEvaluation(data.evaluation);
    } catch {
      setError("Network error contacting evaluation service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg space-y-5">
      {/* Real 7-Day Showing-Up Summary */}
      <div className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-4">
        <div>
          <div className="text-xs font-medium text-[#256453]">Weekly Reflection · Week of {weekStart}</div>
          <h1 className="text-xl font-semibold mt-1">{goalTitle}</h1>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-3 rounded-2xl bg-[#E8F2EE]">
            <div className="text-lg font-bold text-[#256453]">{doneCount}</div>
            <div className="text-[11px] text-[#5B6863]">Done</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#F4F6F5]">
            <div className="text-lg font-bold text-[#17211E]">{partlyCount}</div>
            <div className="text-[11px] text-[#5B6863]">Partly</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#F4F6F5]">
            <div className="text-lg font-bold text-[#5B6863]">{skippedCount}</div>
            <div className="text-[11px] text-[#5B6863]">Skipped</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FBF0E4]">
            <div className="text-lg font-bold text-[#B46927]">{(totalMinutes / 60).toFixed(1)}h</div>
            <div className="text-[11px] text-[#5B6863]">Timed</div>
          </div>
        </div>
      </div>

      {/* User's Own Thought + Trigger AI Weekly Evaluation */}
      <form onSubmit={runEvaluation} className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-[#17211E]">What do you think about this week?</label>
          <p className="text-xs text-[#5B6863]">
            Write 2 honest sentences on what felt easy, what drained you, or what you want to adjust.
          </p>
        </div>
        <textarea
          rows={3}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="e.g., Morning 8 AM sessions felt automatic, but I kept skipping 9 PM study when tired."
          className="w-full px-4 py-3 text-sm rounded-2xl border border-[#D8DFDB] focus:outline-none focus:border-[#256453]"
        />
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">{error}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-2xl bg-[#17211E] hover:bg-[#256453] text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {loading ? "Evaluating your week…" : "Generate & Save Weekly Evaluation"}
        </button>
      </form>

      {/* Saved 4-Part Evaluation */}
      {evaluation && evaluation.next_week_adjustment && (
        <div className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-5 text-sm">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#256453] mb-2">What Worked Well</h2>
            <ul className="space-y-1.5 text-[#17211E]">
              {(evaluation.working_well || []).map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-[#EDF1EE]">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#B46927] mb-2">What Needs Gentle Adjustment</h2>
            <ul className="space-y-1.5 text-[#17211E]">
              {(evaluation.needs_improvement || []).map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-[#EDF1EE]">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#5B6863] mb-1.5">What the World &amp; Research Show</h2>
            <p className="text-[#36433E] leading-relaxed">{evaluation.world_perspective}</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#E8F2EE] text-[#17211E]">
            <div className="text-xs font-semibold text-[#256453] mb-1">One Tweak for Next Week</div>
            <p className="text-sm font-medium">{evaluation.next_week_adjustment}</p>
          </div>
        </div>
      )}
    </div>
  );
}