import { sessionHistoryHTML } from "./session-view.js";
import { store } from "../storage/storage.js";
import { listReadingsByBook, getReading, STATUS_LABELS } from "../domain/readings.js";
import { listSessionsByReading, correctSession, returnToPage } from "../domain/sessions.js";
import { readingVolume } from "../services/history.js";
import { escapeHTML as esc } from "../utils/html.js";
import { todayISO, formatDateFullBR } from "../utils/dates.js";
import { openModal } from "./dialog.js";
import { showToast } from "./toast.js";

export function openHistoryModal(book) {
  const readings = listReadingsByBook(book.id);
  openModal({
    title: "Histórico e correções",
    bodyHTML: `<p>${esc(book.title)}</p><p class="text-muted">Corrigir ajusta o volume da sessão original. Voltar para reler preserva as páginas já lidas.</p>
      ${readings.length ? readings.map(reading => {
        const volume = readingVolume(store.getState(), { readingId: reading.id });
        const sessions = listSessionsByReading(reading.id);
        return `<section class="history-reading"><h3>${esc(STATUS_LABELS[reading.status])} · ${formatDateFullBR(reading.startedAt)}</h3>
          <p>Posição: ${reading.currentPage}/${book.pages}. Volume: ${volume.pagesRead} páginas.</p>
          ${["reading", "paused"].includes(reading.status) ? `<button class="btn btn-secondary btn-sm" data-return="${reading.id}">Voltar para reler</button>` : ""}
          ${sessions.length ? sessions.map(sessionHistoryHTML).join("") : "<p>Nenhum registro ainda.</p>"}
        </section>`;
      }).join("") : "<p>Nenhuma leitura registrada.</p>"}`,
    footHTML: `<button class="btn btn-secondary" data-close>Fechar</button>`,
    onMount(el) {
      el.querySelectorAll("[data-correct]").forEach(button => button.addEventListener("click", () => openCorrection(book, button.dataset.correct)));
      el.querySelectorAll("[data-return]").forEach(button => button.addEventListener("click", () => openReturn(book, button.dataset.return)));
    },
  });
}

export function openCorrection(book, sessionId, onSaved = null) {
  const session = store.getState().sessions[sessionId];
  const reading = getReading(session.readingId);
  openModal({
    title: "Corrigir registro",
    bodyHTML: `<p>Registro original: ${session.startPage} → ${session.endPage}, ${session.pagesRead} páginas em ${formatDateFullBR(session.date)}.</p>
      <p>A correção recalcula o período da leitura e guarda os valores anteriores. Só ajusta a posição se este for o último registro de uma leitura em andamento ou pausada. Não altera posições de registros posteriores ou leituras encerradas.</p>
      <form id="correction-form" class="history-form">
        <div class="field"><label for="correct-page">Página final correta</label><input id="correct-page" name="endPage" type="number" min="${session.startPage}" max="${book.pages}" value="${session.endPage}" required /></div>
        <div class="field"><label for="correct-date">Data real da leitura</label><input id="correct-date" name="date" type="date" min="${reading.startedAt}" ${reading.finishedAt ? `max="${reading.finishedAt}"` : ""} value="${session.date}" required /></div>
        <div class="field"><label for="correct-reason">Motivo da correção</label><textarea id="correct-reason" name="reason" required></textarea></div>
        <p id="history-error" role="alert"></p>
      </form>`,
    footHTML: `<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" form="correction-form" type="submit">Salvar correção</button>`,
    onMount(el) {
      el.querySelector("#correction-form").addEventListener("submit", event => {
        event.preventDefault();
        try {
          correctSession(sessionId, Object.fromEntries(new FormData(event.target)));
          (onSaved || (() => openHistoryModal(book)))(); showToast("Correção salva com histórico de alterações.");
        } catch (error) { el.querySelector("#history-error").textContent = error.message; }
      });
    },
  });
}

export function openReturn(book, readingId, onSaved = null) {
  const reading = getReading(readingId);
  openModal({
    title: "Voltar para reler",
    bodyHTML: `<p>Posição atual: ${reading.currentPage}. As páginas já lidas serão mantidas. Use esta ação para reler um trecho, não para corrigir um erro de digitação.</p>
      <form id="return-form" class="history-form">
        <div class="field"><label for="return-page">Voltar para a página</label><input id="return-page" name="currentPage" type="number" min="0" max="${Math.max(0, reading.currentPage - 1)}" required /></div>
        <div class="field"><label for="return-date">Data do retorno</label><input id="return-date" name="date" type="date" min="${reading.startedAt}" value="${todayISO()}" required /></div>
        <p id="history-error" role="alert"></p>
      </form>`,
    footHTML: `<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" type="submit" form="return-form">Confirmar retorno</button>`,
    onMount(el) {
      el.querySelector("#return-form").addEventListener("submit", event => {
        event.preventDefault();
        try { returnToPage(readingId, Object.fromEntries(new FormData(event.target))); (onSaved || (() => openHistoryModal(book)))(); showToast("Posição atualizada; volume de leitura preservado."); }
        catch (error) { el.querySelector("#history-error").textContent = error.message; }
      });
    },
  });
}
