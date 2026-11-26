"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Milestone } from "@/types/monk";

export function MilestoneChecklist({ initial }: { initial: Milestone[] }) {
  const [items, setItems] = useState<Milestone[]>(initial);

  async function toggle(id: string) {
    const target = items.find((m) => m.id === id);
    if (!target) return;
    const next = !target.is_completed;
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, is_completed: next } : m)));

    const supabase = createClient();
    await supabase
      .from("monk_milestones")
      .update({ is_completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq("id", id);
  }

  if (!items.length) {
    return <p className="text-xs text-[#5B6863]">No checkpoints added yet.</p>;
  }

  return (
    <div className="divide-y divide-[#EDF1EE]">
      {items.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => toggle(m.id)}
          className="w-full py-2.5 flex items-center justify-between gap-3 text-left text-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 text-[10px] ${
                m.is_completed ? "bg-[#256453] border-[#256453] text-white" : "border-[#9AA8A2]"
              }`}
            >
              {m.is_completed ? "✓" : ""}
            </span>
            <span className={m.is_completed ? "line-through text-[#87948F]" : "text-[#17211E] font-medium"}>
              {m.title}
            </span>
          </div>
          {m.due_date && <span className="font-mono text-[11px] text-[#5B6863] shrink-0">{m.due_date}</span>}
        </button>
      ))}
    </div>
  );
}