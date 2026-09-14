import { store } from "../storage/storage.js";
import { createId } from "../utils/ids.js";
import { requireValue, validDate } from "../utils/validation.js";
import { computePeriodStats } from "./statistics.js";

export const GOAL_TYPES = { books: "Livros", pages: "Páginas", authors: "Autores", newAuthors: "Autores novos", readingDays: "Dias com leitura" };
export function listGoals() { return Object.values(store.getState().goals); }
export function createGoal({ type, target, startDate, endDate, filters = {} }) {
  requireValue(GOAL_TYPES[type], "Tipo de meta inválido."); requireValue(Number.isSafeInteger(Number(target)) && Number(target) > 0, "Informe um alvo válido."); validDate(startDate); validDate(endDate, startDate);
  const goal = { id: createId("goal"), type, target: Number(target), startDate, endDate, filters, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  store.mutate(state => { state.goals[goal.id] = goal; }); return goal;
}
export function deleteGoal(id) { store.mutate(state => { delete state.goals[id]; }); }
export function goalProgress(goal, state = store.getState()) { const stats = computePeriodStats(state, { from: goal.startDate, to: goal.endDate }); return { ...goal, current: stats[goal.type] || 0, remaining: Math.max(0, goal.target - (stats[goal.type] || 0)), percentage: Math.min(100, Math.round(((stats[goal.type] || 0) / goal.target) * 100)) }; }
