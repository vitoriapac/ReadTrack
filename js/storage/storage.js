import { CURRENT_VERSION, migrate, emptyState } from "./migrations.js";
import { validateState } from "./schema.js";
const STORAGE_KEY = "readtrack:data";

export class Store {
  constructor(storage) {
    this.listeners = new Set();
    this.loadError = null;
    this.rawBackup = null;
    this.draft = null;
    try {
      storage ??= globalThis.localStorage;
      this.storage = storage;
      this.rawBackup = storage.getItem(STORAGE_KEY);
      this.state = this.rawBackup === null ? emptyState() : migrate(JSON.parse(this.rawBackup));
    } catch {
      this.loadError = "Não foi possível abrir os dados salvos. Exporte o arquivo original e restaure um backup válido para voltar a salvar.";
      this.state = emptyState();
    }
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  getState() { return this.draft || this.state; }
  _commit(next) {
    try {
      if (this.storage.getItem(STORAGE_KEY) !== this.rawBackup) {
        throw new Error("Os dados foram alterados em outra aba. Recarregue a página antes de continuar.");
      }
      const raw = JSON.stringify(next);
      this.storage.setItem(STORAGE_KEY, raw);
      this.rawBackup = raw;
    } catch (error) {
      throw new Error(error.message.includes("outra aba") ? error.message : "Não foi possível salvar. Verifique o espaço e as permissões do navegador; nenhuma alteração foi aplicada.");
    }
    this.state = next;
    this.loadError = null;
    this.listeners.forEach((fn) => fn(this.state));
  }
  // Uma operação composta usa um rascunho, uma gravação e uma notificação.
  mutate(fn) {
    if (this.loadError) throw new Error(this.loadError);
    if (this.draft) return fn(this.draft);
    this.draft = structuredClone(this.state);
    let next, result;
    try {
      result = fn(this.draft);
      this.draft.meta.updatedAt = new Date().toISOString();
      next = validateState(this.draft, CURRENT_VERSION);
    } finally { this.draft = null; }
    this._commit(next);
    return result;
  }
  replaceAll(newState) {
    const next = migrate(newState);
    next.meta.updatedAt = new Date().toISOString();
    this._commit(next);
  }
  exportJSON() { return this.loadError && this.rawBackup !== null ? this.rawBackup : JSON.stringify(this.state, null, 2); }
}
export const store = new Store();
export { CURRENT_VERSION };
