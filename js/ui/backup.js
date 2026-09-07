import { store } from "../storage/storage.js";
import { downloadBackup, restorePreparedBackup } from "../storage/backup.js";
import { escapeHTML as esc } from "../utils/html.js";
import { openModal, closeModal } from "./dialog.js";
import { showToast } from "./toast.js";

export function openBackupPreview(prepared, filename) {
  const expectedJSON = store.exportJSON();
  const labels = { books: "Livros", authors: "Autores", readings: "Leituras", sessions: "Registros (incluindo saldos)", ratings: "Avaliações" };
  openModal({
    title: "Revisar restauração",
    bodyHTML: `<p>${esc(filename)}</p>
      <p>Arquivo validado. Versão ${prepared.sourceVersion} → ${prepared.targetVersion}.</p>
      <dl class="backup-summary">${Object.entries(labels).map(([key, label]) => `<div><dt>${label}</dt><dd>${prepared.counts[key]}</dd></div>`).join("")}</dl>
      <p>${prepared.pagesRead} páginas no total; ${prepared.undatedPages} sem data conhecida.</p>
      <p>A restauração substituirá toda a biblioteca atual. Exporte uma cópia antes de continuar.</p>
      <button class="btn btn-secondary" id="preview-export">Exportar biblioteca atual</button>
      <label><input type="checkbox" id="restore-consent" /> Entendo que os dados atuais serão substituídos.</label>
      <p role="alert" id="restore-error"></p>`,
    footHTML: `<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" id="confirm-restore" disabled>Substituir biblioteca</button>`,
    onMount(el) {
      const submit = el.querySelector("#confirm-restore");
      el.querySelector("#restore-consent").addEventListener("change", event => { submit.disabled = !event.target.checked; });
      el.querySelector("#preview-export").addEventListener("click", () => downloadBackup(store));
      el.querySelector("#confirm-restore").addEventListener("click", () => {
        try {
          restorePreparedBackup(store, prepared, expectedJSON);
          closeModal(); showToast("Backup restaurado.");
        } catch (error) { el.querySelector("#restore-error").textContent = error.message; }
      });
    },
  });
}
