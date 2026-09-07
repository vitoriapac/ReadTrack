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

export function getBook(id) {
  return store.getState().books[id] || null;
}

export function authorNamesForBook(book) {
  return book.authorIds.map((id) => getAuthor(id)?.name).filter(Boolean).join(", ");
}

/**
 * Cria um livro.
 * @param {object} data - title, authorName, pages, genre, year, format, language, cover
 */
export function createBook(data) {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.mutate((state) => {
    state.books[book.id] = book;
  });
  return book;
}

export function updateBook(id, data) {
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
}

/** Remove o livro e tudo o que depende dele (leituras, sessões, avaliações). */
export function deleteBook(id) {
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
}
