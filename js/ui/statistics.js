import { computePeriodStats, demoState } from "../services/statistics.js";
import { buildInsights } from "../services/insights.js";
import { profileStats, authorStats, abandonmentStats, retrospective, recommendations, calendarComparisons, genreEvolution } from "../services/analysis.js";
import { predictFinish } from "../services/projections.js";
import { previousPeriod } from "../services/periods.js";
import { store } from "../storage/storage.js";
import { escapeHTML as esc } from "../utils/html.js";
import { periodFilterHTML, selectedPeriod, wirePeriod } from "./period-filter.js";
import { goalsHTML, wireGoals } from "./goals.js";
import { bookRoute } from "./routes.js";

let metric = "pages", mode = "short", ranking = "count";
const number = value => value == null ? "—" : Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const pairs = values => Object.entries(values).map(([key,value]) => `<div><dt>${esc(key)}</dt><dd>${number(value)}</dd></div>`).join("") || "<p>Sem dados no período.</p>";
const link = book => book ? `<a href="${bookRoute(book.id)}">${esc(book.title)}</a>` : "—";

export function renderStatisticsPage(container) {
  const demo = sessionStorage.getItem("readtrack:demo") === "1";
  const state = demo ? demoState() : store.getState(), period = selectedPeriod();
  const stats = computePeriodStats(state, period), profile = profileStats(state, period);
  const prior = previousPeriod(period), before = prior ? computePeriodStats(state, prior) : null;
  const authors = authorStats(state, period).filter(a=>a.count || a.pages);
  authors.sort((a,b) => ranking === "average" ? (b.average||0)-(a.average||0) : b[ranking]-a[ranking]);
  const shownAuthors = ranking === "average" ? authors.filter(a=>a.ratings>=2) : authors;
  const abandonment = abandonmentStats(state, period), retro = retrospective(state, period);
  const insights = buildInsights(state, period), suggestions = recommendations(state, mode);
  const comparisons = calendarComparisons(state);
  const max = Math.max(1,...stats.monthly.map(m=>m[metric]));
  const kpis = { "Leituras concluídas": stats.booksCompleted, "Páginas datadas": stats.pagesRead, "Autores diferentes":stats.distinctAuthors, "Autores novos":stats.newAuthors, "Dias com leitura":stats.readingDays, "Avaliação média":stats.avgRating };
  container.innerHTML = `<div class="page-header"><div><h1>Estatísticas${demo ? " · Demo" : ""}</h1><p class="page-subtitle">${demo ? "Dados fictícios apenas nesta tela." : "Seus registros, períodos e descobertas."}</p></div><div class="detail-actions no-print"><button class="btn btn-secondary" id="toggle-demo">${demo ? "Voltar aos meus dados" : "Explorar modo demo"}</button><button class="btn btn-secondary" id="print-report">Imprimir / salvar PDF</button></div></div>
    ${periodFilterHTML()}
    <p>Período: ${esc(period.from || "início do histórico")} a ${esc(period.to || "fim do histórico")}. Páginas incluem leituras em andamento e abandonadas; saldos sem data não entram na evolução.</p>
    <div class="kpi-grid">${Object.entries(kpis).map(([label,value])=>`<div class="kpi-card"><div class="kpi-value">${number(value)}</div><div class="kpi-label">${label}</div></div>`).join("")}</div>
    <section class="card"><h2>Evolução mensal</h2><div class="field no-print"><label for="monthly-metric">Medida</label><select id="monthly-metric"><option value="pages" ${metric==="pages"?"selected":""}>Páginas</option><option value="books" ${metric==="books"?"selected":""}>Conclusões</option></select></div>${stats.monthly.map(m=>`<div class="stats-bar-row"><span>${m.month}</span><progress max="${max}" value="${m[metric]}" aria-label="${m.month}"></progress><strong>${number(m[metric])}</strong></div>`).join("") || "<p>Sem registros no período.</p>"}</section>
    <section class="card"><h2>Comparação temporal</h2>${before ? `<p>Intervalo anterior de mesma duração: ${prior.from} a ${prior.to}.</p><dl class="backup-summary">${pairs({"Variação de conclusões":stats.booksCompleted-before.booksCompleted,"Variação de páginas":stats.pagesRead-before.pagesRead,"Variação de autores novos":stats.newAuthors-before.newAuthors})}</dl>` : "<p>Selecione um intervalo com início e fim para comparar.</p>"}</section>
    <div class="analysis-grid">${[["Gêneros",stats.genres],["Formatos",stats.formats],["Tamanho dos livros",stats.sizes]].map(([label,values])=>`<section class="card"><h2>${label}</h2><dl class="backup-summary">${pairs(values)}</dl></section>`).join("")}</div>
    <section class="card"><h2>Autores e descoberta</h2><p>${stats.distinctAuthors ? Math.round(stats.newAuthors/stats.distinctAuthors*100) : 0}% novos · ${stats.distinctAuthors-stats.newAuthors} recorrentes. Primeira conclusão calculada no histórico completo.</p><div class="field no-print"><label for="author-ranking">Ordenar autores</label><select id="author-ranking">${Object.entries({count:"Conclusões",pages:"Páginas",average:"Avaliação (mínimo 2)"}).map(([key,label])=>`<option value="${key}" ${ranking===key?"selected":""}>${label}</option>`).join("")}</select></div><div class="table-scroll"><table><thead><tr><th>Autor</th><th>Conclusões</th><th>Páginas</th><th>Média</th></tr></thead><tbody>${shownAuthors.map(a=>`<tr><td>${demo ? esc(a.name) : `<a href="#/autor/${encodeURIComponent(a.id)}">${esc(a.name)}</a>`}</td><td>${a.count}</td><td>${a.pages}</td><td>${number(a.average)} (${a.ratings})</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card"><h2>Comparações de calendário</h2>${comparisons.map(c=>`<h3>${c.label}</h3><p>${c.current.from} a ${c.current.to} × ${c.previous.from} a ${c.previous.to}</p><p>Conclusões: ${c.a.booksCompleted} × ${c.b.booksCompleted}. Páginas: ${c.a.pagesRead} × ${c.b.pagesRead}. Autores novos: ${c.a.newAuthors} × ${c.b.newAuthors}.</p>`).join("")}</section>
    ${demo ? "" : goalsHTML(state)}
    <section class="card"><h2>Previsão dos livros em andamento</h2>${Object.values(state.readings).filter(r=>r.status==="reading").map(r=>{const p=predictFinish(state,r);return `<p>${link(state.books[r.bookId])}: ${p ? `${p.perDay.toFixed(1)} páginas/dia; aproximadamente ${p.days} dias (${p.date}).` : "Registre ao menos 3 dias de leitura nos últimos 30 dias."}</p>`;}).join("") || "<p>Nenhuma leitura em andamento.</p>"}<p class="field-hint">Estimativa usa os dias corridos desde a primeira sessão recente, incluindo pausas.</p></section>
    <section class="card"><h2>Abandono</h2><p>${abandonment.count} de ${abandonment.ended} leituras encerradas · ${number(abandonment.rate)}%. ${abandonment.unknownDates} abandonos sem data conhecida.</p><dl class="backup-summary">${pairs(abandonment.reasons)}</dl>${[["Gênero",abandonment.genres],["Tamanho",abandonment.sizes],["Formato",abandonment.formats]].map(([label,groups])=>`<h3>${label}</h3>${groups.map(g=>`<p>${esc(g.label)}: ${g.abandoned}/${g.ended} · ${g.rate == null ? "amostra inferior a 5" : g.rate+"%"}</p>`).join("")}`).join("")}</section>
    <section class="card"><h2>DNA Literário</h2><p>${esc(profile.message)}</p>${profile.ready ? `<dl class="backup-summary">${Object.entries({"Gênero predominante":profile.dominantGenre||"Amostra insuficiente","Faixa mais frequente":profile.sizeRange||"Amostra insuficiente","Maior afinidade":profile.affinity?.label||"Avaliações insuficientes"}).map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>` : `<p>Registrados: ${profile.count} conclusões e ${profile.span} dias de histórico no período.</p>`}</section>
    <section class="card"><h2>Insights</h2>${insights.map(text=>`<p>${esc(text)}</p>`).join("")}</section>
    <section class="card"><h2>Evolução dos gêneros por ano</h2><p>Distribuição descritiva pelo gênero principal, em todo o histórico. Amostras pequenas não definem preferências.</p>${genreEvolution(state).map(y=>`<h3>${y.year} · ${y.total} conclusões</h3>${y.genres.map(g=>`<p>${esc(g.genre)}: ${g.percentage}% (${g.count})</p>`).join("")}`).join("")||"<p>Sem conclusões registradas.</p>"}</section>
    <section class="card"><h2>Retrospectiva do período</h2><p>${retro.booksCompleted} conclusões · ${retro.pagesRead} páginas · ${retro.readingDays} dias · ${retro.rereads} releituras.</p><p>Maior: ${demo ? esc(retro.longest?.title||"—") : link(retro.longest)}. Menor: ${demo ? esc(retro.shortest?.title||"—") : link(retro.shortest)}.</p><p>Melhor avaliação: ${demo ? esc(retro.favorite?.title||"—") : link(retro.favorite)}.</p></section>
    <section class="card"><h2>Próxima leitura</h2><div class="field no-print"><label for="suggestion-mode">O que você procura?</label><select id="suggestion-mode">${Object.entries({short:"Algo curto",newAuthor:"Novo autor",series:"Continuar série",affinity:"Alta afinidade",outside:"Fora da zona de conforto",goal:"Avançar uma meta"}).map(([key,label])=>`<option value="${key}" ${mode===key?"selected":""}>${label}</option>`).join("")}</select></div>${suggestions.map(s=>`<p>${demo ? esc(s.book.title) : link(s.book)} · ${esc(s.reason)}</p>`).join("") || "<p>Nenhuma opção elegível na fila com os dados disponíveis.</p>"}</section>`;
  const render = () => renderStatisticsPage(container);
  wirePeriod(container, render);
  wireGoals(container);
  container.querySelector("#toggle-demo").addEventListener("click",()=>{sessionStorage.setItem("readtrack:demo",demo?"0":"1");render();});
  for (const [id,set] of [["monthly-metric",value=>metric=value],["author-ranking",value=>ranking=value],["suggestion-mode",value=>mode=value]]) container.querySelector("#"+id).addEventListener("change",event=>{set(event.target.value);render();});
  container.querySelector("#print-report").addEventListener("click",()=>window.print());
}
