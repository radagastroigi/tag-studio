import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [gRes, mRes, aRes, sRes] = await Promise.all([
    supabase.from("monk_core_goals").select("horizon, title, target_hours, target_date, is_active"),
    supabase.from("monk_milestones").select("title, due_date, is_completed"),
    supabase.from("monk_activities").select("title, scheduled_time, daily_target_mins, is_active"),
    supabase.from("monk_sessions").select("session_date, duration_mins, status, started_at, ended_at").order("session_date", { ascending: false }),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gRes.data || []), "Goals");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mRes.data || []), "Milestones");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aRes.data || []), "Activities");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sRes.data || []), "Daily_Sessions");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="monkthetics-export-${dateStr}.xlsx"`,
    },
  });
}