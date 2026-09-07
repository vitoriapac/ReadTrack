// Versionamento do schema de dados do ReadTrack.
// Sempre que o formato mudar, incrementar CURRENT_VERSION e adicionar
// um passo de migração correspondente em MIGRATIONS.

export const CURRENT_VERSION = 1;

export function emptyState() {
  return {
    meta: { version: CURRENT_VERSION, createdAt: new Date().toISOString(), updatedAt: null },
    books: {},
    authors: {},
    readings: {},
    sessions: {},
    ratings: {},
  };
}

// Cada função recebe o state na versão N e retorna o state na versão N+1.
const MIGRATIONS = {
  // Exemplo para o futuro:
  // 1: (state) => { ...transformação...; state.meta.version = 2; return state; },
};

export function migrate(rawState) {
  let state = rawState && typeof rawState === "object" ? rawState : emptyState();

  // Garante que todas as coleções existam, mesmo em dados antigos/parciais.
  state.meta = state.meta || { version: 0 };
  state.books = state.books || {};
  state.authors = state.authors || {};
  state.readings = state.readings || {};
  state.sessions = state.sessions || {};
  state.ratings = state.ratings || {};

  let version = state.meta.version || 0;
  while (version < CURRENT_VERSION && MIGRATIONS[version]) {
    state = MIGRATIONS[version](state);
    version = state.meta.version;
  }
  state.meta.version = CURRENT_VERSION;

  return state;
}
