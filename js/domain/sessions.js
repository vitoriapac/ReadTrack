import { store } from "../storage/storage.js";

export function listSessions() {
  return Object.values(store.getState().sessions);
}

export function listSessionsByReading(readingId) {
  return listSessions()
    .filter((s) => s.readingId === readingId)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

/** Sessões mais recentes de todas as leituras, para o extrato de atividade. */
export function listRecentSessions(limit = 8) {
  return listSessions()
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, limit);
}
