import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type WeeklyEvaluation = {
  working_well: string[];
  needs_improvement: string[];
  world_perspective: string;
  next_week_adjustment: string;
};

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId, goalTitle, weekStart, userReflection, statsSummary } = (await request.json()) as {
    goalId: string;
    goalTitle: string;
    weekStart: string;
    userReflection: string;
    statsSummary: string;
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY missing in .env.local." }, { status: 503 });
  }

  const prompt = `You are a calm, grounded, empathetic mentor for Monkthetics ("what you do in a day makes you who you are").
Evaluate this user's last 7 days strictly toward their goal:
Goal: "${goalTitle}"
7-Day Real Check-In Data: ${statsSummary}
What the user thinks about their week: "${userReflection || "No written reflection yet."}"

Return strictly a JSON object with these exact keys:
- "working_well": array of 2 concise, concrete strings celebrating real consistency
- "needs_improvement": array of 2 honest, gentle strings pointing out friction or skipped slots
- "world_perspective": 2 crisp sentences connecting their goal & week to proven behavioral science or industry reality ("what the world/research shows")
- "next_week_adjustment": 1 concrete, tiny schedule or habit tweak for next week.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "AI service busy. Please retry in a moment." }, { status: 502 });
    }

    const json = await res.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const evaluation = JSON.parse(rawText) as WeeklyEvaluation;

    const { error: dbErr } = await supabase.from("monk_weekly_reviews").upsert(
      {
        user_id: user.id,
        goal_id: goalId,
        week_start: weekStart,
        user_reflection: userReflection || "",
        ai_summary: evaluation,
      },
      { onConflict: "user_id,week_start" }
    );

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ evaluation });
  } catch {
    return NextResponse.json({ error: "Failed to generate weekly evaluation." }, { status: 500 });
  }
}