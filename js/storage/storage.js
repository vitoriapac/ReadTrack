import { CURRENT_VERSION, migrate, emptyState } from "./migrations.js";

const STORAGE_KEY = "readtrack:data";

/**
 * Store simples com persistência em localStorage e pub/sub para a UI.
 * O estado inteiro fica em memória e é regravado no localStorage a
 * cada mutação — suficiente para o volume de dados de uma biblioteca
 * pessoal de livros.
 */
class Store {
  constructor() {
    this.state = this._load();
    this.listeners = new Set();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch (err) {
      console.error("ReadTrack: falha ao ler dados salvos, iniciando vazio.", err);
      return emptyState();
    }
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (err) {
      console.error("ReadTrack: falha ao salvar dados.", err);
    }
    this.listeners.forEach((fn) => fn(this.state));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState() {
    return this.state;
  }

  /** Aplica uma função de mutação (recebe o state e edita in-place) e persiste. */
  mutate(fn) {
    fn(this.state);
    this.state.meta.updatedAt = new Date().toISOString();
    this._persist();
  }

  replaceAll(newState) {
    this.state = migrate(newState);
    this._persist();
  }

  exportJSON() {
    return JSON.stringify(this.state, null, 2);
  }
}

export const store = new Store();
export { CURRENT_VERSION };
