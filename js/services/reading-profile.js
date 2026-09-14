import { computePeriodStats } from "./statistics.js";
export function buildReadingProfile(state) {
  const completed = Object.values(state.readings).filter(r => r.status === "completed");
  if (completed.length < 5) return { ready: false, message: "Continue registrando leituras para liberar seu DNA Literário." };
  const stats = computePeriodStats(state, { from: "0000-01-01", to: "9999-12-31" });
  const dominant = Object.entries(stats.genres).sort((a,b) => b[1]-a[1])[0];
  const books = completed.map(r => state.books[r.bookId]).filter(Boolean);
  const size = books.reduce((n,b) => n + b.pages, 0) / Math.max(1, books.length);
  const range = size < 200 ? "<200" : size < 300 ? "200–299" : size < 400 ? "300–399" : size < 500 ? "400–499" : size < 700 ? "500–699" : "700+";
  return { ready: true, dominantGenre: dominant?.[0] || "—", sizeRange: range, completionRate: Math.round(completed.length / Math.max(1, Object.values(state.readings).filter(r => r.status !== "want_to_read").length) * 100), discoveryRate: stats.distinctAuthors ? Math.round(stats.newAuthors / stats.distinctAuthors * 100) : 0, books: completed.length };
}
