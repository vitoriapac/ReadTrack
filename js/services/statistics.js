import { listBooks, getBook } from "../domain/books.js";
import { listReadings, STATUS } from "../domain/readings.js";
import { ratingForReading } from "../domain/ratings.js";
import { store } from "../storage/storage.js";
import { readingVolume } from "./history.js";
import { validDate } from "../utils/validation.js";
import { todayISO } from "../utils/dates.js";

/** KPIs simples de todo o histórico (a base para metas/projeções virá depois). */
export function computeOverviewStats() {
  const completed = listReadings().filter((r) => r.status === STATUS.COMPLETED);

  const { pagesRead, undatedPages } = readingVolume(store.getState());

  const authorIds = new Set();
  completed.forEach((r) => {
    const book = getBook(r.bookId);
    (book?.authorIds || []).forEach((id) => authorIds.add(id));
  });

  const ratings = completed
    .map((r) => ratingForReading(r.id)?.overall)
    .filter((v) => typeof v === "number");
  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : null;

  return {
    booksCompleted: completed.length,
    pagesRead,
    undatedPages,
    distinctAuthors: authorIds.size,
    avgRating,
    totalBooksInLibrary: listBooks().length,
  };
}

export function computePeriodStats(state = store.getState(), { from = null, to = null } = {}) {
  if (from) validDate(from);
  if (to) validDate(to, from);
  const readings = Object.values(state.readings).filter(r => r.status === STATUS.COMPLETED && (!from || r.finishedAt >= from) && (!to || r.finishedAt <= to));
  const sessions = Object.values(state.sessions).filter(s => s.type === "reading" && s.pagesRead > 0 && (!from || s.date >= from) && (!to || s.date <= to));
  const authors = new Set(), newAuthors = new Set(), firstRead = new Map();
  Object.values(state.readings).filter(r => r.status === STATUS.COMPLETED).forEach(r => { const b = state.books[r.bookId]; (b?.authorIds || []).forEach(id => { if (!firstRead.has(id) || r.finishedAt < firstRead.get(id)) firstRead.set(id, r.finishedAt); }); });
  readings.forEach(r => (state.books[r.bookId]?.authorIds || []).forEach(id => { authors.add(id); if ((!from || firstRead.get(id) >= from) && (!to || firstRead.get(id) <= to)) newAuthors.add(id); }));
  const ratings = readings.map(r => state.ratings[r.ratingId]?.overall).filter(Number.isFinite);
  const monthMap = new Map();
  sessions.forEach(s => { const month = s.date?.slice(0, 7); if (!month) return; const item = monthMap.get(month) || { month, pages: 0, books: 0 }; item.pages += s.pagesRead; monthMap.set(month, item); });
  readings.forEach(r => { const month = r.finishedAt?.slice(0, 7); if (month) (monthMap.get(month) || monthMap.set(month, { month, pages: 0, books: 0 }).get(month)).books++; });
  const genres = new Map(), formats = new Map(), sizes = new Map();
  readings.forEach(r => { const b = state.books[r.bookId]; if (!b) return; (b.genres || [b.primaryGenre || b.genre || "Outro"]).forEach(g => genres.set(g, (genres.get(g) || 0) + 1)); formats.set(b.format || "Outro", (formats.get(b.format || "Outro") || 0) + 1); const size = b.pages < 200 ? "<200" : b.pages < 300 ? "200–299" : b.pages < 400 ? "300–399" : b.pages < 500 ? "400–499" : b.pages < 700 ? "500–699" : "700+"; sizes.set(size, (sizes.get(size) || 0) + 1); });
  return { booksCompleted: readings.length, pagesRead: sessions.reduce((n, s) => n + s.pagesRead, 0), distinctAuthors: authors.size, newAuthors: newAuthors.size, readingDays: new Set(sessions.map(s => s.date)).size, avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null, monthly: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)), genres: Object.fromEntries(genres), formats: Object.fromEntries(formats), sizes: Object.fromEntries(sizes) };
}

// Compatibility wrapper; projections use only events up to the reference day.
export function computeProjection(state = store.getState(), { from, to, target = 0, today = todayISO() } = {}) {
  validDate(from); validDate(to, from);
  const cutoff = today < to ? today : to;
  const stats = cutoff < from ? { booksCompleted: 0 } : computePeriodStats(state, { from, to: cutoff });
  const total = Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
  const elapsed = Math.max(0,Math.min(total,Math.round((Date.parse(today)-Date.parse(from))/86400000)+1));
  return { ...stats, target, projection: elapsed >= 7 ? Math.round(stats.booksCompleted/elapsed*total) : null, neededPerDay: total > elapsed ? Math.max(0,target-stats.booksCompleted)/(total-elapsed) : null };
}
export { demoState } from "./demo.js";
