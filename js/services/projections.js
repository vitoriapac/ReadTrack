import { goalProgress } from "./goals.js";
import { todayISO } from "../utils/dates.js";
import { dayNumber, shiftDay } from "./periods.js";
export function projectGoal(goal, state, today = todayISO()) {
  const progress = goalProgress(goal, state, today);
  const total = dayNumber(goal.endDate) - dayNumber(goal.startDate) + 1;
  const elapsed = Math.max(0, Math.min(total, dayNumber(today) - dayNumber(goal.startDate) + 1));
  const remainingDays = total - elapsed;
  const rate = elapsed ? progress.current / elapsed : 0;
  return { ...progress, elapsed, remainingDays, perMonth: rate * 30.44,
    neededPerMonth: remainingDays ? progress.remaining / remainingDays * 30.44 : null,
    projection: elapsed >= 7 ? Math.round(rate * total) : null };
}
export function predictFinish(state, reading, today = todayISO()) {
  if (reading.status !== "reading") return null;
  const from = shiftDay(today, -29);
  const sessions = Object.values(state.sessions).filter(s => s.readingId === reading.id && s.type === "reading" && s.pagesRead > 0 && s.date >= from && s.date <= today);
  const activeDays = new Set(sessions.map(s => s.date)).size;
  if (activeDays < 3) return null;
  const first = sessions.map(s => s.date).sort()[0];
  const pages = sessions.reduce((n, s) => n + s.pagesRead, 0);
  const perDay = pages / (dayNumber(today) - dayNumber(first) + 1);
  const days = Math.ceil(Math.max(0, state.books[reading.bookId].pages - reading.currentPage) / perDay);
  return { perDay, days, date: shiftDay(today, days), activeDays };
}
