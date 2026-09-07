import { store } from "../storage/storage.js";
import { createId } from "../utils/ids.js";

export function listAuthors() {
  return Object.values(store.getState().authors);
}

export function getAuthor(id) {
  return store.getState().authors[id] || null;
}

/** Busca um autor pelo nome (case-insensitive) ou cria um novo. */
export function findOrCreateByName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;

  const existing = listAuthors().find(
    (a) => a.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) return existing;

  const author = {
    id: createId("aut"),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  store.mutate((state) => {
    state.authors[author.id] = author;
  });
  return author;
}

export function authorBookCount(authorId) {
  const state = store.getState();
  return Object.values(state.books).filter((b) => b.authorIds.includes(authorId)).length;
}

/** Remove autores que não estão mais referenciados por nenhum livro. */
export function pruneUnusedAuthors() {
  store.mutate((state) => {
    const usedIds = new Set(
      Object.values(state.books).flatMap((b) => b.authorIds)
    );
    Object.keys(state.authors).forEach((id) => {
      if (!usedIds.has(id)) delete state.authors[id];
    });
  });
}
