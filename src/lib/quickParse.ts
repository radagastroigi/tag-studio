export function parseQuickInput(raw: string) {
  let title = raw.trim();
  let durationMins = 30;
  let category = 'Building';
  let priority: 'high' | 'medium' | 'low' = 'medium';

  const durMatch = title.match(/\b(\d{1,3})\s*m\b/i);
  if (durMatch) {
    durationMins = Math.min(480, Math.max(5, Number(durMatch[1])));
    title = title.replace(durMatch[0], '');
  }

  const catMatch = title.match(/#(dsa|system|building|ai|health)/i);
  if (catMatch) {
    const map: Record<string, string> = {
      dsa: 'DSA', system: 'System Design', building: 'Building', ai: 'AI & ML', health: 'Health'
    };
    category = map[catMatch[1].toLowerCase()] || 'Building';
    title = title.replace(catMatch[0], '');
  }

  const prioMatch = title.match(/!(high|medium|low)/i);
  if (prioMatch) {
    priority = prioMatch[1].toLowerCase() as 'high' | 'medium' | 'low';
    title = title.replace(prioMatch[0], '');
  }

  return { title: title.replace(/\s+/g, ' ').trim(), durationMins, category, priority };
}