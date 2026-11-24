import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SuggestedHabit = {
  title: string;
  target_label: string;
  scheduled_time: string;
};

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goal, why } = (await request.json()) as { goal?: string; why?: string };
  if (!goal || goal.trim().length < 3) {
    return NextResponse.json({ error: "Please enter a clear goal first." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured yet. You can still add activities manually." },
      { status: 503 }
    );
  }

  const prompt = `You are a calm, practical habit coach. The user wants to achieve this goal:
Goal: "${goal.trim()}"
Why: "${(why || "").trim()}"

Break this into 4 concrete, realistic DAILY activities a person can actually show up for every single day (examples: "5 pushups", "1 DSA problem", "45 min deep study").
Return strictly a JSON array of objects with keys:
- "title": short action name (max 50 chars)
- "target_label": tiny concrete daily unit (e.g., "1 problem", "30 min", "10 pages")
- "scheduled_time": 24h time string "HH:MM" spread realistically across morning and evening.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
          },
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "AI service busy. Add activities manually or retry." }, { status: 502 });
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const parsed = JSON.parse(text) as SuggestedHabit[];

    const habits = parsed.slice(0, 6).map((h) => ({
      title: String(h.title || "").slice(0, 120),
      target_label: String(h.target_label || "20 min").slice(0, 40),
      scheduled_time: /^\d{2}:\d{2}$/.test(String(h.scheduled_time)) ? String(h.scheduled_time) : "08:00",
    }));

    return NextResponse.json({ habits });
  } catch {
    return NextResponse.json({ error: "Could not parse AI suggestions. Try again or add manually." }, { status: 500 });
  }
}