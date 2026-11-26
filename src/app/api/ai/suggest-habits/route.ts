import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goal, why } = (await request.json()) as { goal?: string; why?: string };
  if (!goal || goal.trim().length < 3) {
    return NextResponse.json({ error: "Goal is required." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured. Add your own activities above." },
      { status: 503 }
    );
  }

  const prompt = `Break this goal into 4 realistic DAILY activities a focused person can execute every day:
Goal: "${goal.trim()}"
Context: "${(why || "").trim()}"
Return strictly a JSON array of objects with keys:
- "title": short concrete action (max 50 chars)
- "daily_target_mins": integer minutes between 10 and 90
- "scheduled_time": "HH:MM" (24h)`;

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
    if (!res.ok) return NextResponse.json({ error: "AI helper busy. Add activities manually." }, { status: 502 });
    const json = await res.json();
    const parsed = JSON.parse(json?.candidates?.[0]?.content?.parts?.[0]?.text || "[]");
    return NextResponse.json({ habits: parsed });
  } catch {
    return NextResponse.json({ error: "Could not parse AI ideas." }, { status: 500 });
  }
}