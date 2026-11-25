import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type MappedHabit = {
  title: string;
  tracking_type: "time" | "count" | "binary";
  unit_code: "s" | "count" | "reps" | "problems" | "pages" | "m" | "g";
  daily_target_value: number;
  time_slot: "morning" | "afternoon" | "evening" | "anytime";
};

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 503 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const goalId = String(formData.get("goalId") || "");
  if (!file || !goalId) return NextResponse.json({ error: "File and active goal are required." }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
  if (!rows.length) return NextResponse.json({ error: "Uploaded spreadsheet is empty." }, { status: 400 });

  const sample = JSON.stringify(rows.slice(0, 12));
  const prompt = `Extract daily activities/habits from this spreadsheet sample and normalize to SI units.
Sample rows: ${sample}

Return strictly a JSON array of objects with keys:
- "title": clean activity name (max 80 chars)
- "tracking_type": "time" | "count" | "binary"
- "unit_code": "s" (for time, convert minutes*60 or hours*3600) | "reps" | "problems" | "pages" | "count" | "m" | "g"
- "daily_target_value": positive number in that canonical unit
- "time_slot": "morning" | "afternoon" | "evening" | "anytime"`;

  try {
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
      }
    );

    if (!aiRes.ok) return NextResponse.json({ error: "AI parser unavailable." }, { status: 502 });
    const aiJson = await aiRes.json();
    const mapped = JSON.parse(aiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "[]") as MappedHabit[];

    const toInsert = mapped.slice(0, 20).map((m, idx) => ({
      user_id: user.id,
      goal_id: goalId,
      title: String(m.title || "Imported Activity").slice(0, 140),
      tracking_type: m.tracking_type || "count",
      unit_code: m.unit_code || "count",
      daily_target_value: Math.max(1, Number(m.daily_target_value || 1)),
      target_label: m.unit_code === "s" ? `${Math.round(Number(m.daily_target_value) / 60)} min` : `${m.daily_target_value} ${m.unit_code}`,
      time_slot: m.time_slot || "anytime",
      scheduled_time: null,
      sort_order: 50 + idx,
      is_active: true,
    }));

    if (!toInsert.length) return NextResponse.json({ error: "No valid activities detected." }, { status: 400 });

    const { error: dbErr } = await supabase.from("monk_habits").insert(toInsert);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ importedCount: toInsert.length });
  } catch {
    return NextResponse.json({ error: "Failed to parse uploaded file." }, { status: 500 });
  }
}