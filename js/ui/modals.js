import { icons } from "./icons.js";
import { showToast } from "./toast.js";
import { createBook, updateBook, listGenres, listFormats, authorNamesForBook, getBook } from "../domain/books.js";
import { startReading, logProgress, completeReading, abandonReading, addToWantToRead, ABANDON_REASONS } from "../domain/readings.js";
import { saveRating, ratingForReading } from "../domain/ratings.js";
import { todayISO } from "../utils/dates.js";

let root = null;

function ensureRoot() {
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

export function closeModal() {
  if (root) root.innerHTML = "";
}

function open({ title, bodyHTML, footHTML, onMount }) {
  const el = ensureRoot();
  el.innerHTML = `
    <div class="modal-overlay" data-overlay>
      <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="modal-head">
          <div class="modal-title">${title}</div>
          <button class="btn-icon" data-close type="button" aria-label="Fechar">${icons.close}</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ""}
      </div>
    </div>
  `;
  el.querySelector("[data-overlay]").addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-overlay")) closeModal();
  });
  el.querySelector("[data-close]").addEventListener("click", closeModal);
  if (onMount) onMount(el);
}

/* ===================== Formulário de livro (criar/editar) ===================== */

export function openBookFormModal(existingId = null) {
  const existing = existingId ? getBook(existingId) : null;
  const genres = listGenres();
  const formats = listFormats();

  open({
    title: existing ? "Editar livro" : "Adicionar livro",
    bodyHTML: `
      <form id="book-form">
        <div class="field">
          <label for="f-title">Título</label>
          <input id="f-title" name="title" required placeholder="Ex: Duna" value="${existing?.title ?? ""}" />
        </div>
        <div class="field">
          <label for="f-author">Autor</label>
          <input id="f-author" name="authorName" required placeholder="Ex: Frank Herbert"
            value="${existing ? authorNamesForBook(existing) : ""}" />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="f-pages">Páginas</label>
            <input id="f-pages" name="pages" type="number" min="1" required value="${existing?.pages ?? ""}" />
          </div>
          <div class="field">
            <label for="f-year">Ano</label>
            <input id="f-year" name="year" type="number" placeholder="2026" value="${existing?.publicationYear ?? ""}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="f-genre">Gênero</label>
            <select id="f-genre" name="genre">
              ${genres.map((g) => `<option value="${g}" ${existing?.genre === g ? "selected" : ""}>${g}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="f-format">Formato</label>
            <select id="f-format" name="format">
              ${formats.map((f) => `<option value="${f}" ${existing?.format === f ? "selected" : ""}>${f}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="f-cover">URL da capa (opcional)</label>
          <input id="f-cover" name="cover" placeholder="https://..." value="${existing?.cover ?? ""}" />
        </div>
      </form>
    `,
    footHTML: `
      <button class="btn btn-secondary" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="book-form">${existing ? "Salvar" : "Adicionar"}</button>
    `,
    onMount: (el) => {
      el.querySelector("#book-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        if (!data.title.trim() || !data.authorName.trim() || !data.pages) {
          showToast("Preencha título, autor e número de páginas.");
          return;
        }
        if (existing) {
          updateBook(existing.id, data);
          showToast("Livro atualizado.");
        } else {
          const book = createBook(data);
          addToWantToRead(book.id);
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
        <p class="text-muted" style="font-size: var(--fs-sm);">${book.title}</p>
        <div class="field-row">
          <div class="field">
            <label for="s-page">Página inicial</label>
            <input id="s-page" name="initialPage" type="number" min="0" value="0" />
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
        <p class="text-muted" style="font-size: var(--fs-sm);">${book.title} · ${book.pages} páginas ao todo</p>
        <div class="field-row">
          <div class="field">
            <label for="p-page">Página atual</label>
            <input id="p-page" name="currentPage" type="number" min="0" max="${book.pages}" required value="${reading.currentPage}" />
          </div>
          <div class="field">
            <label for="p-date">Data</label>
            <input id="p-date" name="date" type="date" value="${todayISO()}" />
          </div>
        </div>
        <div class="field">
          <label for="p-notes">Notas (opcional)</label>
          <textarea id="p-notes" name="notes" placeholder="Alguma impressão sobre esse trecho..."></textarea>
        </div>
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
        logProgress(reading.id, { currentPage, date: fd.get("date") || todayISO(), notes: fd.get("notes") });
        closeModal();
        if (currentPage >= book.pages) {
          openCompleteFlow(book, reading);
        } else {
          showToast("Progresso registrado.");
        }
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
        <p class="text-muted" style="font-size: var(--fs-sm);">${book.title}</p>
        ${alreadyCompleted ? "" : `
        <div class="field">
          <label for="c-date">Data de conclusão</label>
          <input id="c-date" name="finishedAt" type="date" value="${todayISO()}" />
        </div>`}
        <div class="field">
          <label>Nota geral</label>
          <div class="star-picker" data-star-picker>
            ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" class="${existingRating && n <= existingRating.overall ? "is-filled" : ""}">★</button>`).join("")}
          </div>
          <input type="hidden" name="overall" value="${existingRating?.overall ?? 0}" />
        </div>
        <div class="field">
          <label for="c-review">Resenha rápida (opcional)</label>
          <textarea id="c-review" name="review" placeholder="O que você achou?">${existingRating?.review ?? ""}</textarea>
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
          starButtons.forEach((b) => b.classList.toggle("is-filled", Number(b.dataset.star) <= value));
        });
      });
      el.querySelector("#complete-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const overall = Number(fd.get("overall"));
        if (!alreadyCompleted) {
          completeReading(reading.id, { finishedAt: fd.get("finishedAt") || todayISO() });
        }
        if (overall > 0) {
          saveRating(reading.id, { overall, review: fd.get("review") || "" });
        }
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
        <p class="text-muted" style="font-size: var(--fs-sm);">${book.title}</p>
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
