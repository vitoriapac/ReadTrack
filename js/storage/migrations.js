import { requireValue } from "../utils/validation.js";
import { validateState } from "./schema.js";
export const CURRENT_VERSION = 6;
export function emptyState() {
  return { meta: { version: CURRENT_VERSION, createdAt: new Date().toISOString(), updatedAt: null }, books: {}, authors: {}, readings: {}, sessions: {}, ratings: {}, goals: {}, annotations: {} };
}
const MIGRATIONS = {
  2(state) {
    validateState(state, 2);
    for (const book of Object.values(state.books)) book.archivedAt = null;
    state.meta.version = 3;
    return state;
  },
  0(state) {
    for (const key of ["books", "authors", "readings", "sessions", "ratings"]) state[key] ??= {};
    state.meta.version = 1;
    return state;
  },
  1(state) {
    validateState(state, 1);
    const totals = new Map();
    const sequences = new Map();
    for (const s of Object.values(state.sessions)) {
      s.type = "reading";
      s.revisions = [];
      s.sequence = (sequences.get(s.readingId) || 0) + 1;
      sequences.set(s.readingId, s.sequence);
      totals.set(s.readingId, (totals.get(s.readingId) || 0) + s.pagesRead);
    }
    for (const r of Object.values(state.readings)) {
      const missing = r.currentPage - r.initialPage - (totals.get(r.id) || 0);
      requireValue(missing >= 0, "Histórico antigo inconsistente: sessões excedem o progresso. O arquivo original foi preservado.");
      if (missing > 0) {
        let id = "balance_" + r.id;
        while (Object.hasOwn(state.sessions, id)) id += "_";
        state.sessions[id] = { id, readingId: r.id, type: "balance", sequence: 0, date: null, startPage: null, endPage: null, pagesRead: missing, notes: "Progresso anterior sem detalhamento de datas.", revisions: [], createdAt: null };
      }
    }
    state.meta.version = 2;
    return state;
  },
  3(state) {
    validateState(state, 3);
    for (const book of Object.values(state.books)) {
      const legacyGenre = typeof book.genre === "string" && book.genre.trim() ? book.genre : "Outro";
      book.primaryGenre = book.primaryGenre || legacyGenre;
      book.genres = Array.isArray(book.genres) && book.genres.length ? [...new Set(book.genres)] : [book.primaryGenre];
      book.isbn ??= null;
      book.publisher ??= null;
      book.seriesNumber ??= null;
      delete book.genre;
    }
    for (const reading of Object.values(state.readings)) reading.abandonedAt ??= null;
    state.meta.version = 4;
    return state;
  },
  4(state) {
    validateState(state, 4);
    state.goals ??= {};
    state.meta.version = 5;
    return state;
  },
  5(state) {
    validateState(state, 5);
    state.annotations ??= {};
    for (const session of Object.values(state.sessions)) session.duration ??= null;
    state.meta.version = 6;
    return state;
  },
};
export function migrate(raw) {
  requireValue(raw !== null && typeof raw === "object" && !Array.isArray(raw), "Backup inválido: o conteúdo deve ser um objeto.");
  let state = structuredClone(raw);
  state.meta ??= { version: 0 };
  requireValue(state.meta && typeof state.meta === "object" && !Array.isArray(state.meta), "Metadados inválidos.");
  let version = state.meta.version ?? 0;
  requireValue(Number.isInteger(version) && version >= 0 && version <= CURRENT_VERSION, "Versão de backup incompatível.");
  while (version < CURRENT_VERSION) {
    requireValue(typeof MIGRATIONS[version] === "function", "Migração não disponível.");
    state = MIGRATIONS[version](state);
    version = state.meta.version;
  }
  return validateState(state, CURRENT_VERSION);
}
