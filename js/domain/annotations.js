import { store } from "../storage/storage.js";
import { createId } from "../utils/ids.js";
import { requireValue } from "../utils/validation.js";
export function listAnnotations(bookId = null) { return Object.values(store.getState().annotations).filter(a => !bookId || a.bookId === bookId).sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || "")); }
export function createAnnotation({ bookId, type = "note", text, page = null }) { requireValue(["note", "quote"].includes(type), "Tipo de anotação inválido."); requireValue(typeof text === "string" && text.trim(), "Escreva uma anotação."); const a = { id: createId("ann"), bookId, type, text: text.trim(), page: page == null || page === "" ? null : Number(page), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; store.mutate(state => { state.annotations[a.id] = a; }); return a; }
export function deleteAnnotation(id) { store.mutate(state => { delete state.annotations[id]; }); }
