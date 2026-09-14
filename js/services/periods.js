import { validDate } from "../utils/validation.js";
import { todayISO } from "../utils/dates.js";
export const dayNumber = date => Date.parse(`${date}T00:00:00Z`) / 86400000;
export const shiftDay = (date, days) => new Date((dayNumber(date) + days) * 86400000).toISOString().slice(0, 10);
export function periodFor(key, today = todayISO()) {
  validDate(today);
  const year = Number(today.slice(0, 4));
  if (key === "month") return { from: today.slice(0, 7) + "-01", to: today };
  if (key === "previousYear") return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
  if (key === "all") return { from: null, to: null };
  return { from: `${year}-01-01`, to: today };
}
export function previousPeriod({ from, to }) {
  if (!from || !to) return null;
  return { from: shiftDay(from, -(dayNumber(to) - dayNumber(from) + 1)), to: shiftDay(from, -1) };
}
