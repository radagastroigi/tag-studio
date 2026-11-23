"use client";

import React from "react";
import { Trash2, TrendingUp } from "lucide-react";
import type { ActivityLog, Goal, Task } from "@/lib/types";
import { isoDaysAgo } from "@/lib/quickParse";

interface GoalEtaCardProps {
  goal: Goal;
  tasks: Task[];
  activities: ActivityLog[];
  onDelete: (id: string) => void;
}

export function GoalEtaCard({ goal, tasks, activities, onDelete }: GoalEtaCardProps) {
  const linkedTasks = tasks.filter((t) => t.goal_id === goal.id);
  const doneTasks = linkedTasks.filter((t) => t.is_done).length;

  const pct = Math.min(100, Math.round((goal.logged_minutes / goal.target_minutes) * 100));
  const loggedHrs = (goal.logged_minutes / 60).toFixed(1);
  const targetHrs = (goal.target_minutes / 60).toFixed(0);

  // 7-day pace calculation
  const last7Set = new Set(Array.from({ length: 7 }, (_, i) => isoDaysAgo(i)));
  const last7Mins = activities
    .filter((a) => a.goal_id === goal.id && last7Set.has(a.logged_date))
    .reduce((sum, a) => sum + a.duration_mins, 0);

  const dailyPaceMins = last7Mins / 7;
  const remainingMins = Math.max(0, goal.target_minutes - goal.logged_minutes);

  let etaText = "Log sessions this week to forecast ETA";
  if (remainingMins === 0) {
    etaText = "Target hours reached";
  } else if (dailyPaceMins >= 5) {
    const daysLeft = Math.ceil(remainingMins / dailyPaceMins);
    const etaDate = new Date();
    etaDate.setDate(etaDate.getDate() + daysLeft);
    etaText = `At ${(last7Mins / 60).toFixed(1)}h/wk pace → finishes ${etaDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  }

  return (
    <div className="bg-white border border-[#E2E7E4] rounded-2xl p-5 flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#EAEFEA] text-[#4A5752]">
              {goal.horizon}
            </span>
            <h3 className="mt-2 text-base font-semibold text-[#17211E]">{goal.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => onDelete(goal.id)}
            className="p-2 rounded-xl text-[#7A8782] hover:text-red-700 hover:bg-red-50 transition"
            aria-label="Delete goal"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-[#5B6863]">
              {loggedHrs} / {targetHrs} hrs · {doneTasks}/{linkedTasks.length} tasks
            </span>
            <span className="font-mono font-semibold text-[#2B6B59]">{pct}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#E9EFEA] overflow-hidden">
            <div
              className="h-full bg-[#2B6B59] rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#EDF1EE] flex items-center gap-2 text-xs text-[#2B6B59] font-medium">
        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
        <span>{etaText}</span>
      </div>
    </div>
  );
}