import { authorStats } from "../services/analysis.js";
import { store } from "../storage/storage.js";
import { escapeHTML as esc } from "../utils/html.js";
import { bookRoute } from "./routes.js";
export function renderAuthorPage(container, id) {
  const author = authorStats(store.getState()).find(a => a.id === id);
  if (!author) { container.innerHTML = '<h1>Autor não encontrado</h1><a href="#/estatisticas">Voltar às estatísticas</a>'; return; }
  container.innerHTML = `<div class="page-header"><div><h1>${esc(author.name)}</h1><p>${author.books.length} livros · ${author.count} conclusões · ${author.pages} páginas datadas · média ${author.average?.toFixed(1) || "—"}</p></div></div><section class="card"><h2>Histórico do autor</h2><p>Primeira conclusão: ${author.first || "—"}. Última: ${author.last || "—"}.</p>${author.books.map(b=>`<p><a href="${bookRoute(b.id)}">${esc(b.title)}</a> · ${esc(b.genres.join(", "))}${b.series ? ` · ${esc(b.series)}` : ""}${b.archivedAt ? " · Arquivado" : ""}</p>`).join("")}<h3>Linha do tempo</h3>${author.readings.map(r=>`<p>${r.finishedAt} · ${esc(store.getState().books[r.bookId].title)} · ${store.getState().ratings[r.ratingId]?.overall || "Sem nota"}</p>`).join("")}</section>`;
}
