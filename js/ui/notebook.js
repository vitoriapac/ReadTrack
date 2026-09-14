import { listAnnotations } from "../domain/annotations.js";
import { store } from "../storage/storage.js";
import { escapeHTML as esc } from "../utils/html.js";
import { bookRoute } from "./routes.js";
export function renderNotebookPage(container) {
  container.innerHTML=`<h1>Anotações</h1><div class="field"><label for="notebook-search">Buscar texto, título ou autor</label><input id="notebook-search" type="search" /></div><div id="notebook-results"></div>`;
  const draw=()=>{const query=container.querySelector("input").value.toLocaleLowerCase("pt-BR");const state=store.getState();const notes=listAnnotations().filter(a=>{const b=state.books[a.bookId];return [a.text,b.title,...b.authorIds.map(id=>state.authors[id].name)].join(" ").toLocaleLowerCase("pt-BR").includes(query);});container.querySelector("#notebook-results").innerHTML=notes.map(a=>`<article class="card"><a href="${bookRoute(a.bookId)}">${esc(state.books[a.bookId].title)}</a><p>${a.type==="quote"?"Citação":"Nota"} · ${a.page==null?"Sem página":`página ${a.page}`}</p><p class="history-note">${esc(a.text)}</p></article>`).join("")||"<p>Nenhuma anotação encontrada.</p>";};
  container.querySelector("input").addEventListener("input",draw);draw();
}
