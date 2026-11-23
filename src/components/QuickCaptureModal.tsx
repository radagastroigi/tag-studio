"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { parseQuickInput } from "@/lib/quickParse";
import type { Category, Goal, Priority } from "@/lib/types";

interface QuickCaptureModalProps {
  open: boolean;
  goals: Goal[];
  onClose: () => void;
  onAddTask: (payload: {
    title: string;
    priority: Priority;
    goal_id: string | null;
    is_daily_focus: boolean;
  }) => void;
  onAddActivity: (payload: {
    title: string;
    category: Category;
    duration_mins: number;
    goal_id: string | null;
  }) => void;
}

export function QuickCaptureModal({
  open,
  goals,
  onClose,
  onAddTask,
  onAddActivity,
}: QuickCaptureModalProps) {
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<"task" | "activity">("task");
  const [goalId, setGoalId] = useState<string>("");
  const [focusToday, setFocusToday] = useState(true);

  useEffect(() => {
    if (!open) setRaw("");
  }, [open]);

  if (!open) return null;

  const parsed = parseQuickInput(raw);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed.title) return;
    if (mode === "task") {
      onAddTask({
        title: parsed.title,
        priority: parsed.priority,
        goal_id: goalId || null,
        is_daily_focus: focusToday,
      });
    } else {
      onAddActivity({
        title: parsed.title,
        category: parsed.category,
        duration_mins: parsed.durationMins,
        goal_id: goalId || null,
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-[#E2E7E4] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2B6B59]" />
            <h3 className="text-sm font-semibold text-[#17211E]">Quick Capture</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F0F3F1]">
            <X className="w-4 h-4 text-[#5B6863]" />
          </button>
        </div>

        <div className="flex gap-1.5 p-1 rounded-xl bg-[#EAEFEA] mb-3">
          <button
            type="button"
            onClick={() => setMode("task")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              mode === "task" ? "bg-[#17211E] text-white" : "text-[#4A5752]"
            }`}
          >
            Add Task
          </button>
          <button
            type="button"
            onClick={() => setMode("activity")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              mode === "activity" ? "bg-[#17211E] text-white" : "text-[#4A5752]"
            }`}
          >
            Log Activity
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            autoFocus
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={
              mode === "task"
                ? "e.g., Sharded LRU Cache in C# !high"
                : "e.g., URL Shortener Design 45m #system"
            }
            className="w-full px-4 py-3 text-sm rounded-xl border border-[#D8DFDB] focus:outline-none focus:border-[#2B6B59]"
          />

          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="px-2.5 py-1 rounded-full bg-[#E9F3EF] text-[#2B6B59] font-medium">
              {parsed.category}
            </span>
            {mode === "activity" ? (
              <span className="px-2.5 py-1 rounded-full bg-[#FBF1E6] text-[#B97335] font-medium">
                {parsed.durationMins} min
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-[#FBF1E6] text-[#B97335] font-medium">
                Priority: {parsed.priority}
              </span>
            )}
            <span className="px-2 py-1 text-[#5B6863]">Tags: #dsa #system #building #ai !high 45m</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="px-3 py-2.5 text-xs rounded-xl border border-[#D8DFDB] bg-white"
            >
              <option value="">Link to goal (optional)</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>

            {mode === "task" && (
              <label className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl border border-[#D8DFDB] cursor-pointer">
                <input
                  type="checkbox"
                  checked={focusToday}
                  onChange={(e) => setFocusToday(e.target.checked)}
                  className="accent-[#2B6B59]"
                />
                <span>Pin to Today&apos;s 3-Focus</span>
              </label>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#17211E] hover:bg-[#2B6B59] text-white text-sm font-semibold transition"
          >
            {mode === "task" ? "Save Task" : `Log ${parsed.durationMins}m Session`}
          </button>
        </form>
      </div>
    </div>
  );
}