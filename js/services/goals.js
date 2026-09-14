import { store } from "../storage/storage.js";
import { createId } from "../utils/ids.js";
import { requireValue, validDate } from "../utils/validation.js";
import { computePeriodStats } from "./statistics.js";
import { todayISO } from "../utils/dates.js";

export const GOAL_TYPES = { books: "Livros", pages: "Páginas", authors: "Autores", newAuthors: "Autores novos", readingDays: "Dias com leitura" };
export function listGoals() { return Object.values(store.getState().goals); }
export function createGoal({ type, target, startDate, endDate, filters = {} }) {
  requireValue(GOAL_TYPES[type], "Tipo de meta inválido."); requireValue(Number.isSafeInteger(Number(target)) && Number(target) > 0, "Informe um alvo válido."); validDate(startDate); validDate(endDate, startDate);
  const goal = { id: createId("goal"), type, target: Number(target), startDate, endDate, filters, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  store.mutate(state => { state.goals[goal.id] = goal; }); return goal;
}
export function deleteGoal(id) { store.mutate(state => { delete state.goals[id]; }); }
export function matchesBook(book, filters = {}) {
  filters ||= {};
  return book && (!filters.genre || (book.genres || []).includes(filters.genre)) && (!filters.minPages || book.pages >= filters.minPages);
}
export function updateGoal(id, data) {
  requireValue(Object.hasOwn(store.getState().goals, id), "Meta não encontrada.");
  store.mutate(state => { state.goals[id] = { ...state.goals[id], ...data, id, target: Number(data.target), updatedAt: new Date().toISOString() }; });
}
export function goalProgress(goal, state = store.getState(), today = todayISO()) {
  const fields = { books: "booksCompleted", pages: "pagesRead", authors: "distinctAuthors", newAuthors: "newAuthors", readingDays: "readingDays" };
  const to = today < goal.endDate ? today : goal.endDate;
  let current = 0;
  if (to >= goal.startDate) {
    const filtered = { ...state, readings: Object.fromEntries(Object.entries(state.readings).filter(([, r]) => matchesBook(state.books[r.bookId], goal.filters))) };
    filtered.sessions = Object.fromEntries(Object.entries(state.sessions).filter(([, s]) => filtered.readings[s.readingId]));
    current = computePeriodStats(filtered, { from: goal.startDate, to })[fields[goal.type]];
    if (goal.type === "newAuthors") {
      const first = new Map();
      Object.values(state.readings).filter(r => r.status === "completed").forEach(r => state.books[r.bookId].authorIds.forEach(id => {
        if (!first.has(id) || r.finishedAt < first.get(id)) first.set(id, r.finishedAt);
      }));
      current = new Set(Object.values(filtered.readings).filter(r => r.status === "completed" && r.finishedAt >= goal.startDate && r.finishedAt <= to).flatMap(r => state.books[r.bookId].authorIds).filter(id => first.get(id) >= goal.startDate && first.get(id) <= to)).size;
    }
  }
  return { ...goal, current, remaining: Math.max(0, goal.target - current), percentage: Math.min(100, Math.round(current / goal.target * 100)) };
}
