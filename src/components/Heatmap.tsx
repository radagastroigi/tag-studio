"use client";

import React from "react";
import type { ActivityLog } from "@/lib/types";
import { isoDaysAgo, formatShortDate } from "@/lib/quickParse";

interface HeatmapProps {
  activities: ActivityLog[];
}

export function Heatmap({ activities }: HeatmapProps) {
  const totalsByDate = new Map<string, number>();
  for (const a of activities) {
    totalsByDate.set(a.logged_date, (totalsByDate.get(a.logged_date) || 0) + a.duration_mins);
  }

  // 12 weeks = 84 days
  const days = Array.from({ length: 84 }, (_, idx) => {
    const offset = 83 - idx;
    const date = isoDaysAgo(offset);
    const mins = totalsByDate.get(date) || 0;
    return { date, mins };
  });

  function cellColor(mins: number): string {
    if (mins === 0) return "bg-[#EAEFEA]";
    if (mins < 45) return "bg-[#B7D7CA]";
    if (mins < 90) return "bg-[#6EAD96]";
    if (mins < 150) return "bg-[#2B6B59]";
    return "bg-[#17211E]";
  }

  const activeDays = days.filter((d) => d.mins > 0).length;

  return (
    <div className="bg-white border border-[#E2E7E4] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#17211E]">12-Week Consistency Heatmap</h3>
          <p className="text-xs text-[#5B6863]">{activeDays} active days in the last 12 weeks</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[#5B6863]">
          <span>Less</span>
          <span className="w-3 h-3 rounded-sm bg-[#EAEFEA]" />
          <span className="w-3 h-3 rounded-sm bg-[#B7D7CA]" />
          <span className="w-3 h-3 rounded-sm bg-[#6EAD96]" />
          <span className="w-3 h-3 rounded-sm bg-[#2B6B59]" />
          <span className="w-3 h-3 rounded-sm bg-[#17211E]" />
          <span>More</span>
        </div>
      </div>

      <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => (
          <div
            key={d.date}
            title={`${formatShortDate(d.date)}: ${d.mins} min`}
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[4px] transition-transform hover:scale-110 ${cellColor(d.mins)}`}
          />
        ))}
      </div>
    </div>
  );
}