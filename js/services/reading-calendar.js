import { store } from "../storage/storage.js";
import { todayISO } from "../utils/dates.js";
import { dayNumber, shiftDay } from "./periods.js";
export function readingCalendar(state = store.getState()) {
  const days = new Map();
  Object.values(state.sessions).filter(s => s.date && s.type !== "balance" && s.pagesRead > 0).forEach(s => { const d = days.get(s.date) || { date: s.date, pages: 0, sessions: 0, minutes: 0 }; d.pages += s.pagesRead; d.sessions++; d.minutes += s.duration || 0; days.set(s.date, d); });
  return [...days.values()].sort((a,b) => a.date.localeCompare(b.date));
}
export function readingStreak(state = store.getState(), today = todayISO()) {
  const ordered = readingCalendar(state).map(d => d.date).filter(d => d <= today);
  const dates = new Set(ordered);
  let best = 0, run = 0, previous = null, current = 0;
  for (const date of ordered) { run = previous && dayNumber(date)-dayNumber(previous) === 1 ? run+1 : 1; best = Math.max(best,run); previous=date; }
  let cursor = dates.has(today) ? today : shiftDay(today,-1);
  while (dates.has(cursor)) { current++; cursor=shiftDay(cursor,-1); }
  return { current, best };
}
