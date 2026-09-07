import { requireValue, pageNumber, validDate, coverURL } from "../utils/validation.js";


const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const own = (collection, id) => typeof id === "string" && Object.hasOwn(collection, id);
const statuses = ["want_to_read", "reading", "paused", "completed", "abandoned"];

export function validateState(state, version) {
  requireValue(object(state) && object(state.meta) && state.meta.version === version, "Metadados inválidos.");
  for (const key of ["books", "authors", "readings", "sessions", "ratings"]) {
    requireValue(object(state[key]), "Coleção inválida: " + key);
    for (const [id, item] of Object.entries(state[key])) {
      requireValue(object(item) && item.id === id && /^[a-zA-Z0-9_-]+$/.test(id) && !["__proto__", "constructor", "prototype"].includes(id), "Identificador inválido.");
      for (const field of ["createdAt", "updatedAt"]) {
        requireValue(item[field] == null || (typeof item[field] === "string" && Number.isFinite(Date.parse(item[field]))), "Data de registro inválida.");
      }
    }
  }
  for (const a of Object.values(state.authors)) requireValue(typeof a.name === "string" && a.name.trim(), "Autor inválido.");
  for (const b of Object.values(state.books)) {
    if (version >= 3) requireValue(b.archivedAt === null || (typeof b.archivedAt === "string" && Number.isFinite(Date.parse(b.archivedAt))), "Data de arquivamento inválida.");
    requireValue(typeof b.title === "string" && b.title.trim(), "Título inválido.");
    requireValue(pageNumber(b.pages) > 0 && typeof b.pages === "number", "Total de páginas inválido.");
    requireValue(Array.isArray(b.authorIds) && b.authorIds.every(id => own(state.authors, id)), "Autor inexistente.");
    for (const field of ["genre", "format", "language", "series"]) requireValue(b[field] == null || typeof b[field] === "string", "Texto do livro inválido.");
    b.cover = coverURL(b.cover);
  }
  const opened = new Set();
  for (const r of Object.values(state.readings)) {
    requireValue(own(state.books, r.bookId) && statuses.includes(r.status), "Leitura inválida.");
    if (version >= 3) requireValue(!state.books[r.bookId].archivedAt || !["reading", "paused"].includes(r.status), "Encerre a leitura antes de arquivar o livro.");
    pageNumber(r.initialPage, state.books[r.bookId].pages);
    pageNumber(r.currentPage, state.books[r.bookId].pages);
    requireValue(typeof r.initialPage === "number" && typeof r.currentPage === "number" && (version >= 2 || r.currentPage >= r.initialPage), "Progresso inválido.");
    if (r.status !== "want_to_read") validDate(r.startedAt);
    if (r.startedAt) validDate(r.startedAt);
    if (r.finishedAt) validDate(r.finishedAt, r.startedAt);
    if (r.status === "completed") validDate(r.finishedAt, r.startedAt);
    requireValue(r.abandonReason == null || typeof r.abandonReason === "string", "Motivo inválido.");
    if (!["completed", "abandoned"].includes(r.status)) {
      requireValue(!opened.has(r.bookId), "Há leituras abertas duplicadas.");
      opened.add(r.bookId);
    }
    if (r.ratingId) requireValue(own(state.ratings, r.ratingId) && state.ratings[r.ratingId].readingId === r.id, "Avaliação vinculada inválida.");
  }
  const sequences = new Set();
  for (const s of Object.values(state.sessions)) {
    requireValue(own(state.readings, s.readingId), "Sessão sem leitura.");
    const r = state.readings[s.readingId], max = state.books[r.bookId].pages;
    requireValue(s.notes == null || typeof s.notes === "string", "Notas inválidas.");
    if (version >= 2) {
      requireValue(["reading", "position", "balance"].includes(s.type), "Tipo de sessão inválido.");
      requireValue(Array.isArray(s.revisions), "Auditoria inválida.");
      requireValue(Number.isSafeInteger(s.sequence) && s.sequence >= 0 && !sequences.has(`${s.readingId}:${s.sequence}`), "Ordem de sessão inválida ou duplicada.");
      sequences.add(`${s.readingId}:${s.sequence}`);
      if (s.type === "balance") {
        requireValue(s.sequence === 0 && s.date === null && s.startPage === null && s.endPage === null && s.revisions.length === 0, "Saldo histórico não pode ter data ou posição.");
        requireValue(Number.isSafeInteger(s.pagesRead) && s.pagesRead > 0 && s.pagesRead <= max, "Saldo histórico inválido.");
        continue;
      }
      requireValue(s.sequence > 0, "Ordem de sessão inválida.");
    }
    validDate(s.date, r.startedAt);
    pageNumber(s.startPage, version >= 2 ? max : r.currentPage);
    pageNumber(s.endPage, version >= 2 ? max : r.currentPage);
    requireValue(typeof s.startPage === "number" && typeof s.endPage === "number", "Páginas inválidas.");
    requireValue(!r.finishedAt || s.date <= r.finishedAt, "Sessão posterior à conclusão.");
    if (version >= 2 && s.type === "position") {
      requireValue(s.endPage < s.startPage && s.pagesRead === 0 && s.revisions.length === 0, "Retorno de posição inválido.");
    } else {
      requireValue(s.endPage >= s.startPage && s.pagesRead === s.endPage - s.startPage, "Páginas da sessão inválidas.");
      if (version >= 2) {
        let previous = null;
        for (const revision of s.revisions) {
          requireValue(object(revision) && typeof revision.reason === "string" && revision.reason.trim(), "Motivo da correção obrigatório.");
          requireValue(typeof revision.createdAt === "string" && Number.isFinite(Date.parse(revision.createdAt)), "Data de correção inválida.");
          for (const snapshot of [revision.before, revision.after]) {
            requireValue(object(snapshot), "Auditoria incompleta.");
            validDate(snapshot.date, r.startedAt);
            pageNumber(snapshot.endPage, max);
            requireValue(typeof snapshot.endPage === "number" && snapshot.endPage >= s.startPage && snapshot.pagesRead === snapshot.endPage - s.startPage, "Auditoria de páginas inválida.");
            requireValue(!r.finishedAt || snapshot.date <= r.finishedAt, "Auditoria posterior à conclusão.");
          }
          if (previous) requireValue(sameSnapshot(previous, revision.before), "Cadeia de correções inválida.");
          previous = revision.after;
        }
        if (previous) requireValue(sameSnapshot(previous, s), "Sessão diverge da última correção.");
      }
    }
  }
  for (const rating of Object.values(state.ratings)) {
    requireValue(own(state.readings, rating.readingId) && state.readings[rating.readingId].ratingId === rating.id, "Avaliação sem leitura vinculada.");
    requireValue(typeof rating.overall === "number" && Number.isFinite(rating.overall) && rating.overall >= 1 && rating.overall <= 5, "Nota inválida.");
    requireValue(typeof rating.review === "string", "Resenha inválida.");
  }
  return state;
}

function sameSnapshot(a, b) {
  return a.date === b.date && a.endPage === b.endPage && a.pagesRead === b.pagesRead;
}
