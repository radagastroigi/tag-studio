import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [gRes, hRes, cRes] = await Promise.all([
    supabase.from("monk_goals").select("title, why_statement, target_total_value, metric_unit, target_date, created_at"),
    supabase.from("monk_habits").select("title, tracking_type, daily_target_value, unit_code, time_slot, scheduled_time"),
    supabase.from("monk_checkins").select("checkin_date, status, actual_value, target_value_snapshot, efficiency_pct, duration_mins").order("checkin_date", { ascending: false }),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gRes.data || []), "Goals");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hRes.data || []), "Daily_Activities");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cRes.data || []), "Execution_History");

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