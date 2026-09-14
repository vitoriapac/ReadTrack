import { store } from "../storage/storage.js";
import { escapeHTML as esc } from "../utils/html.js";
import { icons } from "./icons.js";
import { showToast } from "./toast.js";
import { createBook, updateBook, listGenres, listFormats, authorNamesForBook, getBook } from "../domain/books.js";
import { startReading, logProgress, completeReading, abandonReading, addToWantToRead, ABANDON_REASONS } from "../domain/readings.js";
import { saveRating, ratingForReading } from "../domain/ratings.js";
import { todayISO } from "../utils/dates.js";
import { lookupISBN } from "../services/isbn.js";

import { openModal as open, closeModal } from "./dialog.js";
export { closeModal } from "./dialog.js";

/* ===================== Formulário de livro (criar/editar) ===================== */

export function openBookFormModal(existingId = null) {
  const existing = existingId ? getBook(existingId) : null;
  const genres = [...new Set([...listGenres(), ...(existing?.genres || [])])];
  const formats = listFormats();

  open({
    title: existing ? "Editar livro" : "Adicionar livro",
    bodyHTML: `
      <form id="book-form">
        <div class="field">
          <label for="f-title">Título</label>
          <input id="f-title" name="title" required placeholder="Ex: Duna" value="${esc(existing?.title ?? "")}" />
        </div>
        <div class="field">
          <label for="f-author">Autor</label>
          <input id="f-author" name="authorName" required placeholder="Ex: Frank Herbert"
            value="${esc(existing ? authorNamesForBook(existing) : "")}" />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="f-pages">Páginas</label>
            <input id="f-pages" name="pages" type="number" min="1" required value="${existing?.pages ?? ""}" />
          </div>
          <div class="field">
            <label for="f-year">Ano</label>
            <input id="f-year" name="year" type="number" placeholder="2026" value="${esc(existing?.publicationYear ?? "")}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="f-genre">Gênero principal</label>
            <select id="f-genre" name="primaryGenre">
              ${genres.map((g) => `<option value="${esc(g)}" ${(existing?.primaryGenre || existing?.genre) === g ? "selected" : ""}>${esc(g)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="f-format">Formato</label>
            <select id="f-format" name="format">
              ${formats.map((f) => `<option value="${f}" ${existing?.format === f ? "selected" : ""}>${f}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label for="f-isbn">ISBN (opcional)</label><input id="f-isbn" name="isbn" value="${esc(existing?.isbn ?? "")}" placeholder="978..." /></div>
          <div class="field"><label for="f-publisher">Editora (opcional)</label><input id="f-publisher" name="publisher" value="${esc(existing?.publisher ?? "")}" /></div>
        </div>
        <button type="button" class="btn btn-secondary" id="lookup-isbn">Consultar ISBN na Open Library</button><p class="field-hint">A consulta envia somente o ISBN informado. Revise os metadados antes de aplicar.</p><div id="isbn-preview"></div>
        <div class="field"><label for="extra-genres">Outros gêneros (separados por vírgula)</label><input id="extra-genres" name="extraGenres" value="${esc((existing?.genres || []).filter(g=>g!==existing?.primaryGenre).join(", "))}" /></div>
        <div class="field-row">
          <div class="field"><label for="f-series">Série (opcional)</label><input id="f-series" name="series" value="${esc(existing?.series ?? "")}" /></div>
          <div class="field"><label for="f-series-number">Volume</label><input id="f-series-number" name="seriesNumber" type="number" min="1" value="${esc(existing?.seriesNumber ?? "")}" /></div>
        </div>
        <div class="field">
          <label for="f-cover">URL da capa (opcional)</label>
          <input id="f-cover" name="cover" type="url" placeholder="https://..." value="${esc(existing?.cover ?? "")}" />
        </div>
      </form>
    `,
    footHTML: `
      <button class="btn btn-secondary" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="book-form">${existing ? "Salvar" : "Adicionar"}</button>
    `,
    onMount: (el) => {
      const lookup = el.querySelector("#lookup-isbn");
      lookup.addEventListener("click",async()=>{
        const preview=el.querySelector("#isbn-preview");lookup.disabled=true;
        try {
          const data=await lookupISBN(el.querySelector("#f-isbn").value);
          if(!lookup.isConnected)return;
          preview.innerHTML=`<p>${esc(data.title)} · ${esc(data.authorName)} · ${esc(data.publisher)} · ${data.pages || "Páginas não informadas"}</p><button type="button" class="btn btn-secondary" id="apply-isbn">Aplicar metadados ao formulário</button>`;
          preview.querySelector("button").addEventListener("click",()=>{for(const [key,value] of Object.entries(data)){const input=el.querySelector(`[name="${key}"]`);if(input&&value!=="")input.value=value;}preview.textContent="Metadados aplicados. Revise e salve o livro.";});
        } catch(error) {preview.textContent=error.message;}
        finally {lookup.disabled=false;}
      });
      el.querySelector("#book-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        data.genres=[...new Set([data.primaryGenre,...data.extraGenres.split(",").map(g=>g.trim()).filter(Boolean)])];
        if (!data.title.trim() || !data.authorName.trim() || !data.pages) {
          showToast("Preencha título, autor e número de páginas.");
          return;
        }
        if (existing) {
          updateBook(existing.id, data);
          showToast("Livro atualizado.");
        } else {
          store.mutate(() => {
            const book = createBook(data);
            addToWantToRead(book.id);
          });
          showToast("Livro adicionado à sua biblioteca.");
        }
        closeModal();
      });
    },
  });
}

/* ===================== Iniciar leitura ===================== */

export function openStartReadingModal(book, reading) {
  open({
    title: "Começar leitura",
    bodyHTML: `
      <form id="start-form">
        <p class="text-muted" style="font-size: var(--fs-sm);">${esc(book.title)}</p>
        <div class="field-row">
          <div class="field">
            <label for="s-page">Página inicial</label>
            <input id="s-page" name="initialPage" type="number" min="0" max="${book.pages}" value="0" />
          </div>
          <div class="field">
            <label for="s-date">Data de início</label>
            <input id="s-date" name="startedAt" type="date" value="${todayISO()}" />
          </div>
        </div>
      </form>
    `,
    footHTML: `
      <button class="btn btn-secondary" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="start-form">Começar</button>
    `,
    onMount: (el) => {
      el.querySelector("#start-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        startReading(book.id, {
          initialPage: Number(fd.get("initialPage")) || 0,
          startedAt: fd.get("startedAt") || todayISO(),
          fromReadingId: reading?.id ?? null,
        });
        showToast(`Boa leitura com "${book.title}"!`);
        closeModal();
      });
    },
  });
}

/* ===================== Registrar progresso ===================== */

export function openProgressModal(book, reading) {
  open({
    title: "Registrar progresso",
    bodyHTML: `
      <form id="progress-form">
        <p class="text-muted" style="font-size: var(--fs-sm);">${esc(book.title)} · ${book.pages} páginas ao todo</p>
        <div class="field-row">
          <div class="field">
            <label for="p-page">Página atual</label>
            <input id="p-page" name="currentPage" type="number" min="0" max="${book.pages}" required value="${reading.currentPage}" />
          </div>
          <div class="field">
            <label for="p-date">Data real da leitura</label>
            <input id="p-date" name="date" type="date" value="${todayISO()}" />
          </div>
        </div>
        <div class="field">
          <label for="p-notes">Notas (opcional)</label>
          <textarea id="p-notes" name="notes" placeholder="Alguma impressão sobre esse trecho..."></textarea>
        </div>
        <div class="field"><label for="p-duration">Duração em minutos (opcional)</label><input id="p-duration" name="duration" type="number" min="0" step="1" /></div>
        <button type="button" class="btn btn-secondary" id="reading-timer">Iniciar cronômetro</button><p id="timer-status" role="status"></p>
        <p class="field-hint">A data pode ser retroativa, a partir do início da leitura. As páginas vão para essa data; a posição atual avança na ordem dos lançamentos. Para corrigir um lançamento existente, use Histórico e correções.</p>
      </form>
    `,
    footHTML: `
      <button class="btn btn-secondary" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="progress-form">Registrar</button>
    `,
    onMount: (el) => {
      el.querySelector("#progress-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const currentPage = Number(fd.get("currentPage"));
        if (currentPage < reading.currentPage) {
          showToast("A página atual não pode ser menor que a última registrada.");
          return;
        }
        logProgress(reading.id, { currentPage, date: fd.get("date") || todayISO(), notes: fd.get("notes"), duration: fd.get("duration") || null });
        sessionStorage.removeItem("readtrack:timer:" + reading.id);
        closeModal();
        if (currentPage >= book.pages) {
          openCompleteFlow(book, { ...reading, currentPage });
        } else {
          showToast("Progresso registrado.");
        }
      });
      const key = "readtrack:timer:" + reading.id;
      const timer = el.querySelector("#reading-timer");
      const refresh = () => { timer.textContent = sessionStorage.getItem(key) ? "Parar e preencher duração" : "Iniciar cronômetro"; };
      refresh();
      timer.addEventListener("click", () => {
        const started = sessionStorage.getItem(key);
        if (started) {
          const minutes = Math.max(1, Math.round((Date.now() - Number(started)) / 60000));
          el.querySelector("#p-duration").value = minutes;
          el.querySelector("#timer-status").textContent = `${minutes} minutos. Revise antes de salvar.`;
          sessionStorage.removeItem(key);
        } else {
          sessionStorage.setItem(key, String(Date.now()));
          el.querySelector("#timer-status").textContent = "Cronômetro iniciado. Você pode fechar e reabrir este registro nesta aba.";
        }
        refresh();
      });
    },
  });
}

/* ===================== Concluir + avaliar ===================== */

export function openCompleteFlow(book, reading) {
  const alreadyCompleted = reading.status === "completed";
  const existingRating = ratingForReading(reading.id);

  open({
    title: alreadyCompleted ? "Avaliar livro" : "Concluir livro 🎉",
    bodyHTML: `
      <form id="complete-form">
        <p class="text-muted" style="font-size: var(--fs-sm);">${esc(book.title)}</p>
        ${alreadyCompleted ? "" : `
        <div class="field">
          <label for="c-date">Data de conclusão</label>
          <input id="c-date" name="finishedAt" type="date" value="${todayISO()}" />
        </div>`}
        <div class="field">
          <label>Nota geral</label>
          <div class="star-picker" data-star-picker>
            ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} de 5 estrelas" aria-pressed="${existingRating?.overall === n}" class="${existingRating && n <= existingRating.overall ? "is-filled" : ""}">★</button>`).join("")}
          </div>
          <input type="hidden" name="overall" value="${existingRating?.overall ?? 0}" />
        </div>
        <div class="field">
          <label for="c-review">Resenha rápida (opcional)</label>
          <textarea id="c-review" name="review" placeholder="O que você achou?">${esc(existingRating?.review ?? "")}</textarea>
        </div>
      </form>
    `,
    footHTML: `
      <button class="btn btn-secondary" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="complete-form">${alreadyCompleted ? "Salvar avaliação" : "Concluir"}</button>
    `,
    onMount: (el) => {
      const hidden = el.querySelector('input[name="overall"]');
      const starButtons = [...el.querySelectorAll("[data-star]")];
      starButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const value = Number(btn.dataset.star);
          hidden.value = value;
          starButtons.forEach((b) => {
            b.classList.toggle("is-filled", Number(b.dataset.star) <= value);
            b.setAttribute("aria-pressed", String(Number(b.dataset.star) === value));
          });
        });
      });
      el.querySelector("#complete-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const overall = Number(fd.get("overall"));
        if (alreadyCompleted && overall <= 0) { showToast("Escolha uma nota antes de salvar a avaliação."); return; }
        store.mutate(() => {
        if (!alreadyCompleted) {
          completeReading(reading.id, { finishedAt: fd.get("finishedAt") || todayISO() });
        }
        if (overall > 0) {
          saveRating(reading.id, { overall, review: fd.get("review") || "" });
        }
        });
        showToast(alreadyCompleted ? "Avaliação salva." : `"${book.title}" concluído. Parabéns pela leitura!`);
        closeModal();
      });
    },
  });
}

/* ===================== Abandonar leitura ===================== */

export function openAbandonModal(book, reading) {
  open({
    title: "Abandonar leitura",
    bodyHTML: `
      <form id="abandon-form">
        <p class="text-muted" style="font-size: var(--fs-sm);">${esc(book.title)}</p>
        <div class="field">
          <label for="a-reason">Por que você abandonou?</label>
          <select id="a-reason" name="reason">
            ${ABANDON_REASONS.map((r) => `<option value="${r}">${r}</option>`).join("")}
          </select>
        </div>
      </form>
    `,
    footHTML: `
      <button class="btn btn-secondary" type="button" data-close>Cancelar</button>
      <button class="btn btn-danger-ghost" type="submit" form="abandon-form">Abandonar</button>
    `,
    onMount: (el) => {
      el.querySelector("#abandon-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        abandonReading(reading.id, fd.get("reason"));
        showToast("Leitura marcada como abandonada.");
        closeModal();
      });
    },
  });
}
