import { pageNumber, coverURL, requireValue } from "../utils/validation.js";
import { store } from "../storage/storage.js";
import { createId } from "../utils/ids.js";
import { findOrCreateByName, pruneUnusedAuthors, getAuthor } from "./authors.js";

const GENRES = [
  "Ficção científica",
  "Fantasia",
  "Suspense",
  "Romance",
  "Clássico",
  "Não ficção",
  "Biografia",
  "Autoajuda",
  "História",
  "Poesia",
  "Quadrinhos",
  "Outro",
];

const FORMATS = ["Físico", "E-book", "Audiobook"];

export function listGenres() { return GENRES; }
export function listFormats() { return FORMATS; }

export function listBooks() {
  return Object.values(store.getState().books);
}

export function listLibraryBooks({ archived = false } = {}) {
  return listBooks().filter(book => Boolean(book.archivedAt) === archived);
}

export function canArchiveBook(id) {
  return Boolean(getBook(id)) && !Object.values(store.getState().readings).some(r => r.bookId === id && ["reading", "paused"].includes(r.status));
}

export function archiveBook(id) {
  requireValue(getBook(id), "Livro não encontrado.");
  requireValue(canArchiveBook(id), "Conclua ou abandone a leitura em andamento ou pausada antes de arquivar.");
  if (getBook(id).archivedAt) return;
  store.mutate(state => {
    const now = new Date().toISOString();
    state.books[id].archivedAt = now;
    state.books[id].updatedAt = now;
  });
}

export function restoreBook(id) {
  requireValue(getBook(id), "Livro não encontrado.");
  if (!getBook(id).archivedAt) return;
  store.mutate(state => {
    state.books[id].archivedAt = null;
    state.books[id].updatedAt = new Date().toISOString();
  });
}

export function bookDeletionSummary(id) {
  const book = getBook(id);
  requireValue(book, "Livro não encontrado.");
  const state = store.getState();
  const readings = Object.values(state.readings).filter(r => r.bookId === id);
  const ids = new Set(readings.map(r => r.id));
  const sessions = Object.values(state.sessions).filter(s => ids.has(s.readingId));
  const ratings = Object.values(state.ratings).filter(r => ids.has(r.readingId));
  return {
    readings: readings.length, sessions: sessions.length, ratings: ratings.length,
    pagesRead: sessions.reduce((sum, s) => sum + s.pagesRead, 0),
    completed: readings.filter(r => r.status === "completed").length,
    snapshot: JSON.stringify({ book, readings, sessions, ratings }),
  };
}

export function getBook(id) {
  if (typeof id !== "string") return null;
  const books = store.getState().books;
  return Object.hasOwn(books, id) ? books[id] : null;
}

export function authorNamesForBook(book) {
  return book.authorIds.map((id) => getAuthor(id)?.name).filter(Boolean).join(", ");
}

/**
 * Cria um livro.
 * @param {object} data - title, authorName, pages, genre, year, format, language, cover
 */
export function createBook(data) {
  requireValue(typeof data.title === "string" && data.title.trim(), "Informe o título.");
  requireValue(typeof data.authorName === "string" && data.authorName.trim(), "Informe o autor.");
  requireValue(pageNumber(data.pages) > 0, "Informe o total de páginas.");
  data = { ...data, cover: coverURL(data.cover) };
  return store.mutate(() => {
    const author = findOrCreateByName(data.authorName);
    const book = {
      id: createId("bk"),
      title: data.title.trim(),
      authorIds: author ? [author.id] : [],
      pages: Number(data.pages) || 0,
      genre: data.genre || "Outro",
      publicationYear: data.year ? Number(data.year) : null,
      format: data.format || "Físico",
      language: data.language || "Português",
      series: data.series || null,
      cover: data.cover || null,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.mutate((state) => {
      state.books[book.id] = book;
    });
    return book;
  });
}

export function updateBook(id, data) {
  requireValue(getBook(id), "Livro não encontrado.");
  if (data.title !== undefined) requireValue(typeof data.title === "string" && data.title.trim(), "Informe o título.");
  if (data.authorName !== undefined) requireValue(typeof data.authorName === "string" && data.authorName.trim(), "Informe o autor.");
  if (data.pages !== undefined) {
    requireValue(pageNumber(data.pages) > 0, "Informe o total de páginas.");
    requireValue(Object.values(store.getState().readings).filter(r => r.bookId === id).every(r => r.currentPage <= Number(data.pages)), "O total não pode ser menor que o progresso já registrado.");
  }
  if (data.cover !== undefined) data = { ...data, cover: coverURL(data.cover) };
  return store.mutate(() => {
    store.mutate((state) => {
      const book = state.books[id];
      if (!book) return;
      if (data.authorName !== undefined) {
        const author = findOrCreateByName(data.authorName);
        book.authorIds = author ? [author.id] : [];
      }
      if (data.title !== undefined) book.title = data.title.trim();
      if (data.pages !== undefined) book.pages = Number(data.pages) || 0;
      if (data.genre !== undefined) book.genre = data.genre;
      if (data.year !== undefined) book.publicationYear = data.year ? Number(data.year) : null;
      if (data.format !== undefined) book.format = data.format;
      if (data.language !== undefined) book.language = data.language;
      if (data.cover !== undefined) book.cover = data.cover;
      book.updatedAt = new Date().toISOString();
    });
    pruneUnusedAuthors();
  });
}

/** Remove o livro e tudo o que depende dele (leituras, sessões, avaliações). */
export function deleteBook(id, { expectedSnapshot } = {}) {
  const summary = bookDeletionSummary(id);
  requireValue(expectedSnapshot === undefined || expectedSnapshot === summary.snapshot, "Os registros mudaram. Abra a confirmação de exclusão novamente.");
  return store.mutate(() => {
    store.mutate((state) => {
      const readingIds = Object.values(state.readings)
        .filter((r) => r.bookId === id)
        .map((r) => r.id);

      readingIds.forEach((readingId) => {
        Object.values(state.sessions)
          .filter((s) => s.readingId === readingId)
          .forEach((s) => delete state.sessions[s.id]);
        Object.values(state.ratings)
          .filter((r) => r.readingId === readingId)
          .forEach((r) => delete state.ratings[r.id]);
        delete state.readings[readingId];
      });

      delete state.books[id];
    });
    pruneUnusedAuthors();
  });
}
