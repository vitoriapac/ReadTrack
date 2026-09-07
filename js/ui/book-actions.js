import { archiveBook, restoreBook, canArchiveBook, deleteBook, bookDeletionSummary } from "../domain/books.js";
import { store } from "../storage/storage.js";
import { downloadBackup } from "../storage/backup.js";
import { escapeHTML as esc } from "../utils/html.js";
import { openModal, closeModal } from "./dialog.js";
import { showToast } from "./toast.js";

export function changeBookArchive(book) {
  if (book.archivedAt) { restoreBook(book.id); showToast("Livro restaurado na biblioteca."); }
  else { archiveBook(book.id); showToast("Livro arquivado. Histórico e estatísticas preservados."); }
}

export function openDeleteBookModal(book) {
  const impact = bookDeletionSummary(book.id);
  const canArchive = !book.archivedAt && canArchiveBook(book.id);
  openModal({
    title: "Excluir livro permanentemente",
    bodyHTML: `<p>${esc(book.title)}</p>
      <dl class="backup-summary"><div><dt>Leituras</dt><dd>${impact.readings}</dd></div><div><dt>Sessões e saldos</dt><dd>${impact.sessions}</dd></div><div><dt>Avaliações</dt><dd>${impact.ratings}</dd></div></dl>
      <p>A exclusão removerá ${impact.pagesRead} páginas e ${impact.completed} conclusões das estatísticas, além das notas e correções vinculadas. Não há lixeira; para recuperar, será necessário restaurar um backup.</p>
      ${canArchive ? "<p>Você pode arquivar para ocultar o livro e preservar todo o histórico.</p>" : !book.archivedAt ? "<p>Para arquivar e preservar o histórico, primeiro conclua ou abandone a leitura em andamento ou pausada.</p>" : "<p>Este livro já está arquivado e seu histórico continua preservado.</p>"}
      <button class="btn btn-secondary" id="delete-export">Exportar backup antes de excluir</button>
      <label><input id="delete-consent" type="checkbox" /> Entendo que esta exclusão é permanente.</label>
      <p id="delete-error" role="alert"></p>`,
    footHTML: `<button class="btn btn-secondary" data-close>Cancelar</button>${canArchive ? '<button class="btn btn-primary" id="archive-instead">Arquivar e manter histórico</button>' : ""}<button class="btn btn-danger-ghost" id="delete-confirm" disabled>Excluir permanentemente</button>`,
    onMount(el) {
      const confirm = el.querySelector("#delete-confirm");
      el.querySelector("#delete-consent").addEventListener("change", event => { confirm.disabled = !event.target.checked; });
      el.querySelector("#delete-export").addEventListener("click", () => downloadBackup(store));
      el.querySelector("#archive-instead")?.addEventListener("click", () => {
        try { archiveBook(book.id); closeModal(); showToast("Livro arquivado; histórico preservado."); }
        catch (error) { el.querySelector("#delete-error").textContent = error.message; }
      });
      confirm.addEventListener("click", () => {
        try {
          deleteBook(book.id, { expectedSnapshot: impact.snapshot });
          closeModal(); showToast("Livro e registros vinculados excluídos. Recuperação somente por backup.");
        } catch (error) { el.querySelector("#delete-error").textContent = error.message; }
      });
    },
  });
}
