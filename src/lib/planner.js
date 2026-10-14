export function planTasks(tasks, availableHours = 8) {
  return tasks.map(t => ({ ...t, score: Math.round((t.importance || 50) + (t.urgency || 50) - (t.effort || 30) / 2), reason: t.reason || `${t.title} is prioritized by urgency and importance.` })).sort((a, b) => b.score - a.score).reduce((out, t) => { const hours = (t.duration || 60) / 60; if (out.hours + hours <= availableHours) { out.items.push(t); out.hours += hours; } return out; }, { items: [], hours: 0 }).items;
}
