import { escapeHTML as esc } from "../utils/html.js";
import { bookRoute } from "./routes.js";
import { icons } from "./icons.js";
import { getBook, authorNamesForBook } from "../domain/books.js";
import { listByStatus, STATUS, progressPercent } from "../domain/readings.js";
import { listRecentSessions } from "../domain/sessions.js";
import { listReadings } from "../domain/readings.js";
import { ratingForReading } from "../domain/ratings.js";
import { computeOverviewStats } from "../services/statistics.js";
import { formatNumber, formatStars } from "../utils/formatters.js";
import { relativeDayLabel, formatDateBR } from "../utils/dates.js";
import { openProgressModal, openBookFormModal } from "./modals.js";
import { store } from "../storage/storage.js";
import { buildInsights } from "../services/insights.js";
import { goalProgress, GOAL_TYPES } from "../services/goals.js";
import { todayISO } from "../utils/dates.js";

function buildActivityFeed(limit = 8) {
  const events = [];

  listRecentSessions(40).forEach((s) => {
    const reading = listReadings().find((r) => r.id === s.readingId);
    if (!reading) return;
    const book = getBook(reading.bookId);
    if (!book) return;
    events.push({
      date: s.date,
      sortKey: s.createdAt,
      html: `<b>${esc(book.title)}</b>`,
      delta: s.type === "position" ? "Voltou para reler" : `${s.pagesRead} pág.${s.revisions.length ? " (corrigido)" : ""}`,
    });
  });

  listReadings().forEach((r) => {
    const book = getBook(r.bookId);
    if (!book) return;
    if (r.startedAt) {
      events.push({ date: r.startedAt, sortKey: `${r.startedAt}T00:00:00.001`, html: `<b>${esc(book.title)}</b>`, delta: "Iniciado" });
    }
    if (r.status === STATUS.COMPLETED && r.finishedAt) {
      const rating = ratingForReading(r.id);
      events.push({
        date: r.finishedAt,
        sortKey: `${r.finishedAt}T23:59:59.997`,
        html: `<b>${esc(book.title)}</b>`,
        delta: rating ? `Concluído ${formatStars(rating.overall)}` : "Concluído",
      });
    }
    if (r.status === STATUS.ABANDONED) {
      events.push({ date: r.abandonedAt?.slice(0, 10), sortKey: r.abandonedAt, html: `<b>${esc(book.title)}</b>`, delta: "Abandonado" });
    }
  });

  return events
    .filter((e) => e.date)
    .sort((a, b) => (b.sortKey || "").localeCompare(a.sortKey || ""))
    .slice(0, limit);
}

export function renderDashboardPage(container) {
  const stats = computeOverviewStats();
  const reading = listByStatus(STATUS.READING);
  const activity = buildActivityFeed(8);
  const today=todayISO();
  const goal=Object.values(store.getState().goals).find(g=>g.startDate<=today&&g.endDate>=today);
  const progress=goal?goalProgress(goal):null;
  const oldNote=Object.values(store.getState().annotations).filter(a=>a.createdAt.slice(0,10)<today).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))[0];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Visão geral</h1>
        <div class="page-subtitle">Seu progresso de leitura em um só lugar</div>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-add-book">${icons.plus} Adicionar livro</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">${formatNumber(stats.booksCompleted)}</div>
        <div class="kpi-label">Leituras concluídas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${formatNumber(stats.pagesRead)}</div>
        <div class="kpi-label">Páginas lidas</div>
        ${stats.undatedPages ? `<div class="field-hint">Inclui ${stats.undatedPages} páginas antigas sem data conhecida.</div>` : ""}
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${formatNumber(stats.distinctAuthors)}</div>
        <div class="kpi-label">Autores lidos</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${stats.avgRating ? stats.avgRating.toFixed(1) : "—"}</div>
        <div class="kpi-label">Avaliação média</div>
      </div>
    </div>

    <section class="card"><h2>Seu histórico em perspectiva</h2>${buildInsights(store.getState()).slice(0,2).map(text=>`<p>${esc(text)}</p>`).join("")}${progress?`<p>Meta em andamento: ${progress.current}/${progress.target} ${GOAL_TYPES[progress.type].toLowerCase()}.</p>`:""}<a href="#/estatisticas">Ver análises e todas as metas</a>${oldNote?`<h3>Do seu histórico</h3><p class="history-note">${esc(oldNote.text.slice(0,300))}</p><a href="${bookRoute(oldNote.bookId)}">${esc(getBook(oldNote.bookId).title)}</a>`:""}</section>
    <div class="two-col">
      <div class="card">
        <div class="card-head">
          <div class="card-title">Lendo agora</div>
        </div>
        ${reading.length === 0 ? readingEmptyHTML() : `<div class="reading-now-list">${reading.map(readingRowHTML).join("")}</div>`}
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">Atividade recente</div>
        </div>
        ${activity.length === 0 ? activityEmptyHTML() : `<div>${activity.map(activityRowHTML).join("")}</div>`}
      </div>
    </div>
  `;

  wireDashboardEvents(container);
}

function readingRowHTML(r) {
  const book = getBook(r.bookId);
  if (!book) return "";
  const pct = progressPercent(r, book);
  return `
    <div class="reading-row">
      <div class="reading-cover">${book.cover ? `<img src="${esc(book.cover)}" alt="" />` : book.title.slice(0, 1).toUpperCase()}</div>
      <div class="reading-info">
        <a class="reading-title" href="${bookRoute(book.id)}">${esc(book.title)}</a>
        <div class="reading-author">${esc(authorNamesForBook(book))}</div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="reading-progress-line">
          <span>${r.currentPage} / ${book.pages} páginas</span>
          <span>${pct}%</span>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" data-progress-book="${book.id}" data-progress-reading="${r.id}">+ progresso</button>
    </div>
  `;
}

function activityRowHTML(e) {
  return `
    <div class="activity-item">
      <div class="activity-date">${relativeDayLabel(e.date) === "hoje" || relativeDayLabel(e.date) === "ontem" ? relativeDayLabel(e.date) : formatDateBR(e.date)}</div>
      <div class="activity-text">${e.html}</div>
      <div class="activity-delta">${e.delta}</div>
    </div>
  `;
}

function readingEmptyHTML() {
  return `<div class="empty-state"><p>Nenhum livro em andamento agora.</p></div>`;
}

function activityEmptyHTML() {
  return `<div class="empty-state"><p>Seu histórico de leitura vai aparecer aqui.</p></div>`;
}

function wireDashboardEvents(container) {
  container.querySelector("#btn-add-book")?.addEventListener("click", () => openBookFormModal());
  container.querySelectorAll("[data-progress-book]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const book = getBook(btn.dataset.progressBook);
      const reading = findReadingById(btn.dataset.progressReading);
      openProgressModal(book, reading);
    });
  });
}

function findReadingById(id) {
  return listReadings().find((r) => r.id === id) || {};
}
