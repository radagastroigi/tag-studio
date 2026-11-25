export type TrackingType = "time" | "count" | "binary";
export type TimeSlot = "morning" | "afternoon" | "evening" | "anytime" | "custom";
export type UnitCode = "s" | "min" | "hr" | "count" | "reps" | "problems" | "pages" | "m" | "km" | "g" | "kg";

export function toCanonicalSI(value: number, unit: UnitCode): { siUnit: UnitCode; siValue: number } {
  switch (unit) {
    case "min":
      return { siUnit: "s", siValue: Math.round(value * 60) };
    case "hr":
      return { siUnit: "s", siValue: Math.round(value * 3600) };
    case "km":
      return { siUnit: "m", siValue: Math.round(value * 1000) };
    case "kg":
      return { siUnit: "g", siValue: Math.round(value * 1000) };
    default:
      return { siUnit: unit, siValue: value };
  }
}

export function formatSIValue(siValue: number, siUnit: string, trackingType: TrackingType): string {
  if (trackingType === "binary") return siValue >= 1 ? "Done" : "Pending";
  if (siUnit === "s") {
    if (siValue >= 3600) return `${(siValue / 3600).toFixed(1)} hr`;
    return `${Math.round(siValue / 60)} min`;
  }
  if (siUnit === "m" && siValue >= 1000) return `${(siValue / 1000).toFixed(1)} km`;
  if (siUnit === "g" && siValue >= 1000) return `${(siValue / 1000).toFixed(1)} kg`;
  return `${siValue} ${siUnit}`;
}

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  anytime: "Anytime (Timeless)",
  custom: "Exact Time",
};