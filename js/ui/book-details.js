import { getBook, authorNamesForBook, canArchiveBook } from "../domain/books.js";
import { getReading, listReadingsByBook, openReadingForBook, STATUS, STATUS_LABELS, progressPercent } from "../domain/readings.js";
import { listSessionsByReading } from "../domain/sessions.js";
import { ratingForReading } from "../domain/ratings.js";
import { readingVolume } from "../services/history.js";
import { store } from "../storage/storage.js";
import { escapeHTML as esc } from "../utils/html.js";
import { formatDateFullBR } from "../utils/dates.js";
import { formatStars } from "../utils/formatters.js";
import { openBookFormModal } from "./modals.js";
import { closeModal } from "./dialog.js";
import { openCorrection, openReturn } from "./history.js";
import { sessionHistoryHTML } from "./session-view.js";
import { performReadingAction } from "./reading-actions.js";
import { changeBookArchive, openDeleteBookModal } from "./book-actions.js";
import { showToast } from "./toast.js";

function readingButtons(book, reading) {
  const button = (action, text) => `<button class="btn btn-secondary btn-sm" data-action="${action}" data-reading="${reading.id}">${text}</button>`;
  if (reading.status === STATUS.COMPLETED) return button("rate", ratingForReading(reading.id) ? "Editar avaliação" : "Avaliar leitura");
  if (book.archivedAt) return "";
  if (reading.status === STATUS.WANT_TO_READ) return button("start", "Começar a ler");
  if ([STATUS.READING, STATUS.PAUSED].includes(reading.status)) return [
    button("progress", "Registrar progresso"),
    button(reading.status === STATUS.PAUSED ? "resume" : "pause", reading.status === STATUS.PAUSED ? "Retomar" : "Pausar"),
    button("complete", "Concluir"), button("abandon", "Abandonar"),
    `<button class="btn btn-secondary btn-sm" data-return="${reading.id}" ${reading.currentPage === 0 ? "disabled" : ""}>Voltar para reler</button>`,
  ].join("");
  return "";
}

function readingSection(book, reading, index) {
  const sessions = listSessionsByReading(reading.id);
  const rating = ratingForReading(reading.id);
  const volume = readingVolume(store.getState(), { readingId: reading.id });
  return `<section class="card book-reading" data-reading-section="${reading.id}" aria-labelledby="heading-${reading.id}">
    <div class="card-head"><h3 id="heading-${reading.id}">${reading.isReread ? "Releitura" : "Leitura"} ${index}</h3><span class="badge badge-${reading.status}">${STATUS_LABELS[reading.status]}</span></div>
    <p>Início: ${formatDateFullBR(reading.startedAt)} · Conclusão: ${formatDateFullBR(reading.finishedAt)}</p>
    <p>Posição: ${reading.currentPage}/${book.pages} · Volume registrado: ${volume.pagesRead} páginas${volume.undatedPages ? ` (inclui ${volume.undatedPages} sem data conhecida)` : ""}.</p>
    ${reading.abandonReason ? `<p>Motivo do abandono: ${esc(reading.abandonReason)}</p>` : ""}
    ${rating ? `<div class="book-rating"><p class="stars" aria-label="Nota ${rating.overall} de 5">${formatStars(rating.overall)} · ${rating.overall}/5</p>${rating.review ? `<p class="history-note">${esc(rating.review)}</p>` : "<p>Sem resenha.</p>"}</div>` : '<p class="text-muted">Sem avaliação.</p>'}
    <div class="detail-actions">${readingButtons(book, reading)}</div>
    <details class="session-list" open><summary>Sessões e notas (${sessions.length})</summary>
      ${sessions.length ? sessions.map(sessionHistoryHTML).join("") : '<p class="text-muted">Nenhuma sessão registrada nesta leitura.</p>'}
    </details>
  </section>`;
}

// HTML is also exercised in tests to verify relationships and text escaping.
export function bookDetailsHTML(bookId) {
  const book = getBook(bookId);
  if (!book) return `<div class="empty-state card"><h1 tabindex="-1">Livro não encontrado</h1><p>O endereço pode estar incorreto ou o livro foi excluído.</p><a class="btn btn-primary" href="#/biblioteca">Voltar à biblioteca</a></div>`;
  const readings = listReadingsByBook(book.id);
  const current = openReadingForBook(book.id) || readings[0] || null;
  const pct = current ? progressPercent(current, book) : 0;
  const meta = [["Autor", authorNamesForBook(book) || "Não informado"], ["Gênero", book.genre || "Não informado"], ["Páginas", book.pages], ["Publicação", book.publicationYear || "Não informada"], ["Formato", book.format || "Não informado"], ["Idioma", book.language || "Não informado"], ["Série", book.series || "Não informada"]];
  return `<a class="detail-back" href="#/biblioteca">← Voltar à biblioteca</a>
    <div class="page-header"><div><h1 tabindex="-1">${esc(book.title)}</h1><p class="page-subtitle">${esc(authorNamesForBook(book))}</p></div></div>
    ${book.archivedAt ? `<div class="archive-banner" role="status">Arquivado em ${formatDateFullBR(book.archivedAt.slice(0, 10))}. O histórico continua nas estatísticas. Restaure o livro para iniciar outra leitura.</div>` : ""}
    <section class="card book-overview" aria-label="Dados do livro">
      <div class="detail-cover">${book.cover ? `<img src="${esc(book.cover)}" alt="Capa de ${esc(book.title)}" />` : `<span aria-hidden="true">${esc(book.title.slice(0, 1).toUpperCase())}</span>`}</div>
      <div class="detail-description"><dl class="book-metadata">${meta.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
        <p>Situação atual: <strong>${current ? STATUS_LABELS[current.status] : "Sem leitura"}</strong></p>
        ${current ? `<progress value="${pct}" max="100" aria-label="Progresso da leitura atual">${pct}%</progress><p>${current.currentPage}/${book.pages} páginas · ${pct}%</p>` : ""}
        <div class="detail-actions"><button class="btn btn-secondary" data-action="edit">Editar livro</button>
          <button class="btn btn-primary" data-action="archive" ${!book.archivedAt && !canArchiveBook(book.id) ? 'disabled aria-describedby="archive-help"' : ""}>${book.archivedAt ? "Restaurar livro" : "Arquivar livro"}</button>
          ${!book.archivedAt && !openReadingForBook(book.id) ? '<button class="btn btn-secondary" data-action="reread">Iniciar nova leitura</button>' : ""}
          <button class="btn btn-danger-ghost" data-action="delete">Excluir permanentemente</button>
        </div>
        ${!book.archivedAt && !canArchiveBook(book.id) ? '<p id="archive-help" class="field-hint">Conclua ou abandone a leitura em andamento ou pausada antes de arquivar.</p>' : ""}
      </div>
    </section>
    <h2>Histórico de leituras (${readings.length})</h2>
    ${readings.length ? readings.map((reading, i) => readingSection(book, reading, readings.length - i)).join("") : '<p class="card">Este livro ainda não tem histórico de leitura.</p>'}`;
}

export function renderBookDetailsPage(container, bookId) {
  container.innerHTML = bookDetailsHTML(bookId);
  const events = new AbortController();
  container.addEventListener("click", event => {
    const target = event.target.closest("[data-action], [data-correct], [data-return]");
    if (!target || !container.contains(target)) return;
    const book = getBook(bookId);
    if (!book) return;
    try {
      if (target.dataset.correct) { openCorrection(book, target.dataset.correct, closeModal); return; }
      if (target.dataset.return) { openReturn(book, target.dataset.return, closeModal); return; }
      const reading = target.dataset.reading ? getReading(target.dataset.reading) : null;
      switch (target.dataset.action) {
        case "edit": openBookFormModal(bookId); break;
        case "archive": changeBookArchive(book); break;
        case "delete": openDeleteBookModal(book); break;
        default: performReadingAction(target.dataset.action, book, reading);
      }
    } catch (error) { showToast(error.message, { duration: 6000 }); }
  }, { signal: events.signal });
  return () => events.abort();
}
