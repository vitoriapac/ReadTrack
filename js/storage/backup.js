import { CURRENT_VERSION, migrate } from "./migrations.js";
import { readingVolume } from "../services/history.js";

export function prepareBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error("O arquivo não contém JSON válido."); }
  // Validate and migrate before presenting any confirmation or changing state.
  const state = migrate(raw);
  return {
    state,
    sourceVersion: raw.meta?.version ?? 0,
    targetVersion: CURRENT_VERSION,
    counts: Object.fromEntries(["books", "authors", "readings", "sessions", "ratings"].map(key => [key, Object.keys(state[key]).length])),
    ...readingVolume(state),
  };
}

export function restorePreparedBackup(store, prepared, expectedJSON) {
  if (store.exportJSON() !== expectedJSON) throw new Error("A biblioteca mudou desde a prévia. Selecione o backup novamente.");
  store.replaceAll(prepared.state);
}

export function downloadBackup(store) {
  const url = URL.createObjectURL(new Blob([store.exportJSON()], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "readtrack-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
