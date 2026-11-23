import type { Category, Priority } from "./types";

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface ParsedQuickInput {
  title: string;
  durationMins: number;
  category: Category;
  priority: Priority;
}

export function parseQuickInput(raw: string): ParsedQuickInput {
  let title = raw.trim();
  let durationMins = 30;
  let category: Category = "Building";
  let priority: Priority = "medium";

  const durMatch = title.match(/\b(\d{1,3})\s*m\b/i);
  if (durMatch) {
    durationMins = Math.min(480, Math.max(5, Number(durMatch[1])));
    title = title.replace(durMatch[0], "");
  }

  const catMatch = title.match(/#(dsa|system|building|ai|health|other)/i);
  if (catMatch) {
    const map: Record<string, Category> = {
      dsa: "DSA",
      system: "System Design",
      building: "Building",
      ai: "AI & ML",
      health: "Health",
      other: "Other",
    };
    category = map[catMatch[1].toLowerCase()] || "Building";
    title = title.replace(catMatch[0], "");
  }

  const prioMatch = title.match(/!(high|medium|low)/i);
  if (prioMatch) {
    priority = prioMatch[1].toLowerCase() as Priority;
    title = title.replace(prioMatch[0], "");
  }

  return {
    title: title.replace(/\s+/g, " ").trim(),
    durationMins,
    category,
    priority,
  };
}