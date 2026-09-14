import { store } from "../storage/storage.js";
export function readingCalendar(state = store.getState()) {
  const days = new Map();
  Object.values(state.sessions).filter(s => s.date && s.type !== "balance" && s.pagesRead > 0).forEach(s => { const d = days.get(s.date) || { date: s.date, pages: 0, sessions: 0, minutes: 0 }; d.pages += s.pagesRead; d.sessions++; d.minutes += s.duration || 0; days.set(s.date, d); });
  return [...days.values()].sort((a,b) => a.date.localeCompare(b.date));
}
export function readingStreak(state = store.getState()) {
  const dates = new Set(readingCalendar(state).map(d => d.date));
  let best = 0, current = 0, cursor = new Date();
  while (dates.has(cursor.toISOString().slice(0,10))) { current++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  for (const date of dates) { let n = 1, d = new Date(`${date}T00:00:00Z`); while (dates.has(new Date(d.getTime() - n * 86400000).toISOString().slice(0,10))) n++; best = Math.max(best, n); }
  return { current, best };
}
