import { store } from "../storage/storage.js";
import { seriesStats } from "../services/analysis.js";
import { escapeHTML as esc } from "../utils/html.js";
import { STATUS_LABELS } from "../domain/readings.js";
import { bookRoute } from "./routes.js";
export function renderSeriesPage(container) {
  const groups = seriesStats(store.getState());
  container.innerHTML = `<div class="page-header"><div><h1>Séries</h1><p>Progresso dos volumes cadastrados na sua biblioteca.</p></div></div>${groups.map(g => `<section class="card"><h2>${esc(g.name)}</h2><p>${g.completed}/${g.books.length} volumes cadastrados concluídos · ${Math.round(g.completed/g.books.length*100)}%</p><p>Próximo cadastrado: ${g.next ? esc(g.next.title) : "Nenhum volume pendente disponível."}</p>${g.books.map(b => `<div class="series-row"><a href="${bookRoute(b.id)}">${b.seriesNumber || "—"}. ${esc(b.title)}</a><span>${STATUS_LABELS[b.status]}${b.archivedAt ? " · Arquivado" : ""}</span></div>`).join("")}</section>`).join("") || '<p class="card">Cadastre a série e o volume nos detalhes de um livro.</p>'}`;
}
