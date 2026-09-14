import { listBooks, getBook } from "../domain/books.js";
import { listReadings, STATUS } from "../domain/readings.js";
import { ratingForReading } from "../domain/ratings.js";
import { store } from "../storage/storage.js";
import { readingVolume } from "./history.js";

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
  const books = Object.values(state.books);
  const readings = Object.values(state.readings).filter(r => r.status === STATUS.COMPLETED && (!from || r.finishedAt >= from) && (!to || r.finishedAt <= to));
  const readingIds = new Set(readings.map(r => r.id));
  const sessions = Object.values(state.sessions).filter(s => readingIds.has(s.readingId) && s.type !== "balance" && (!from || s.date >= from) && (!to || s.date <= to));
  const authors = new Set(), newAuthors = new Set(), firstRead = new Map();
  Object.values(state.readings).filter(r => r.status === STATUS.COMPLETED).forEach(r => { const b = state.books[r.bookId]; (b?.authorIds || []).forEach(id => { if (!firstRead.has(id) || r.finishedAt < firstRead.get(id)) firstRead.set(id, r.finishedAt); }); });
  readings.forEach(r => (state.books[r.bookId]?.authorIds || []).forEach(id => { authors.add(id); if (firstRead.get(id) >= from && firstRead.get(id) <= to) newAuthors.add(id); }));
  const ratings = readings.map(r => state.ratings[r.ratingId]?.overall).filter(Number.isFinite);
  const monthMap = new Map();
  sessions.forEach(s => { const month = s.date?.slice(0, 7); if (!month) return; const item = monthMap.get(month) || { month, pages: 0, books: 0 }; item.pages += s.pagesRead; monthMap.set(month, item); });
  readings.forEach(r => { const month = r.finishedAt?.slice(0, 7); if (month) (monthMap.get(month) || monthMap.set(month, { month, pages: 0, books: 0 }).get(month)).books++; });
  const genres = new Map(), formats = new Map(), sizes = new Map();
  readings.forEach(r => { const b = state.books[r.bookId]; if (!b) return; (b.genres || [b.primaryGenre || b.genre || "Outro"]).forEach(g => genres.set(g, (genres.get(g) || 0) + 1)); formats.set(b.format || "Outro", (formats.get(b.format || "Outro") || 0) + 1); const size = b.pages < 200 ? "<200" : b.pages < 300 ? "200–299" : b.pages < 400 ? "300–399" : b.pages < 500 ? "400–499" : b.pages < 700 ? "500–699" : "700+"; sizes.set(size, (sizes.get(size) || 0) + 1); });
  return { booksCompleted: readings.length, pagesRead: sessions.reduce((n, s) => n + s.pagesRead, 0), distinctAuthors: authors.size, newAuthors: newAuthors.size, readingDays: new Set(sessions.map(s => s.date)).size, avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null, monthly: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)), genres: Object.fromEntries(genres), formats: Object.fromEntries(formats), sizes: Object.fromEntries(sizes) };
}

export function computeProjection(state = store.getState(), { from, to, target } = {}) {
  const stats = computePeriodStats(state, { from, to }); const start = new Date(`${from}T00:00:00Z`), end = new Date(`${to}T00:00:00Z`), today = new Date(); const elapsed = Math.max(1, Math.min((today - start) / 86400000, (end - start) / 86400000)); const total = Math.max(1, (end - start) / 86400000); const perDay = stats.booksCompleted / elapsed; const projection = Math.round(perDay * total); return { ...stats, projection, target, neededPerDay: target ? Math.max(0, (target - stats.booksCompleted) / Math.max(1, total - elapsed)) : 0 };
}

export function demoState() {
  const state = { meta: { version: 4 }, books: {}, authors: {}, readings: {}, sessions: {}, ratings: {} };
  const genres = ["Ficção científica", "Fantasia", "Clássico", "Suspense", "Não ficção"];
  for (let i = 0; i < 12; i++) state.authors[`demo_author_${i}`] = { id: `demo_author_${i}`, name: ["Ursula K. Le Guin", "Isaac Asimov", "Octavia Butler", "Agatha Christie", "José Saramago", "Terry Pratchett"][i % 6], createdAt: "2025-01-01T00:00:00.000Z", updatedAt: null };
  for (let i = 0; i < 40; i++) { const id = `demo_book_${i}`; const authorId = `demo_author_${i % 12}`; state.books[id] = { id, title: `Livro demonstrativo ${i + 1}`, authorIds: [authorId], pages: 140 + ((i * 47) % 620), primaryGenre: genres[i % genres.length], genres: [genres[i % genres.length]], isbn: null, publisher: "Editora Demo", publicationYear: 2018 + (i % 8), format: i % 3 ? "Físico" : "E-book", language: "Português", series: i % 7 === 0 ? "Série Demo" : null, seriesNumber: i % 7 === 0 ? (i % 4) + 1 : null, cover: null, archivedAt: i > 35 ? "2026-01-01T00:00:00.000Z" : null, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: null }; const rid = `demo_reading_${i}`; const date = `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 26) + 1).padStart(2, "0")}`; state.readings[rid] = { id: rid, bookId: id, status: i < 32 ? "completed" : i < 37 ? "abandoned" : "want_to_read", startedAt: date, finishedAt: i < 32 ? date : null, initialPage: 0, currentPage: i < 32 ? state.books[id].pages : 0, ratingId: i < 30 ? `demo_rating_${i}` : null, isReread: i % 9 === 0, abandonReason: i < 37 && i >= 32 ? "Ritmo lento" : null, abandonedAt: i < 37 && i >= 32 ? `${date}T18:00:00.000Z` : null, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T18:00:00.000Z` }; if (i < 32) { const sid = `demo_session_${i}`; state.sessions[sid] = { id: sid, readingId: rid, type: "reading", sequence: 1, revisions: [], date, startPage: 0, endPage: state.books[id].pages, pagesRead: state.books[id].pages, notes: "", createdAt: `${date}T18:00:00.000Z` }; } if (i < 30) state.ratings[`demo_rating_${i}`] = { id: `demo_rating_${i}`, readingId: rid, overall: 2 + (i % 4), review: "" }; }
  return state;
}
