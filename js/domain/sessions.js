import { store } from "../storage/storage.js";
import { createId } from "../utils/ids.js";
import { pageNumber, requireValue } from "../utils/validation.js";
import { todayISO } from "../utils/dates.js";
import { nextSequence, sessionDate } from "../services/history.js";

export function listSessions() {
  return Object.values(store.getState().sessions);
}

export function listSessionsByReading(readingId) {
  return listSessions()
    .filter((s) => s.readingId === readingId)
    .sort((a, b) => b.sequence - a.sequence);
}

/** Sessões mais recentes de todas as leituras, para o extrato de atividade. */
export function listRecentSessions(limit = 8) {
  return listSessions()
    .filter(s => s.type !== "balance")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, limit);
}

/** Correct the effective value; preserve every previous value in its audit trail. */
export function correctSession(sessionId, { endPage, date, reason }) {
  const state = store.getState(), session = state.sessions[sessionId];
  requireValue(session?.type === "reading", "Escolha um registro de leitura para corrigir.");
  requireValue(typeof reason === "string" && reason.trim(), "Explique o motivo da correção.");
  const reading = state.readings[session.readingId];
  endPage = pageNumber(endPage, state.books[reading.bookId].pages);
  requireValue(endPage >= session.startPage, "A página final não pode ser menor que a inicial do registro.");
  date ??= session.date;
  sessionDate(date, reading);
  requireValue(endPage !== session.endPage || date !== session.date, "Altere a página ou a data para corrigir.");
  const before = { endPage: session.endPage, date: session.date, pagesRead: session.pagesRead };
  const after = { endPage, date, pagesRead: endPage - session.startPage };
  const latest = listSessionsByReading(reading.id).find(s => s.type !== "balance");
  store.mutate(draft => {
    const target = draft.sessions[sessionId];
    target.revisions.push({ before, after, reason: reason.trim(), createdAt: new Date().toISOString() });
    Object.assign(target, after);
    // Older records never rewrite later position changes or completed readings.
    const current = draft.readings[reading.id];
    if (latest?.id === sessionId && ["reading", "paused"].includes(current.status) && current.currentPage === before.endPage) current.currentPage = endPage;
    current.updatedAt = new Date().toISOString();
  });
}

/** Returning to an earlier page is not a negative reading session. */
export function returnToPage(readingId, { currentPage, date = todayISO(), notes = "" }) {
  const state = store.getState(), reading = state.readings[readingId];
  requireValue(reading && ["reading", "paused"].includes(reading.status), "A leitura precisa estar em andamento.");
  currentPage = pageNumber(currentPage, state.books[reading.bookId].pages);
  requireValue(currentPage < reading.currentPage, "Escolha uma página anterior à posição atual.");
  sessionDate(date, reading);
  requireValue(typeof notes === "string", "Notas inválidas.");
  const session = { id: createId("ses"), readingId, type: "position", sequence: nextSequence(state, readingId), revisions: [], date, startPage: reading.currentPage, endPage: currentPage, pagesRead: 0, notes, createdAt: new Date().toISOString() };
  store.mutate(draft => {
    draft.sessions[session.id] = session;
    draft.readings[readingId].currentPage = currentPage;
    draft.readings[readingId].updatedAt = new Date().toISOString();
  });
  return session;
}
