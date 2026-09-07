import { icons } from "./icons.js";
import { listBooks, getBook, authorNamesForBook, deleteBook } from "../domain/books.js";
import {
  listReadingsByBook, openReadingForBook, STATUS, STATUS_LABELS, progressPercent,
  pauseReading, resumeReading,
} from "../domain/readings.js";
import { ratingForReading } from "../domain/ratings.js";
import { formatStars } from "../utils/formatters.js";
import {
  openBookFormModal, openStartReadingModal, openProgressModal,
  openCompleteFlow, openAbandonModal,
} from "./modals.js";
import { showToast } from "./toast.js";

const TABS = [
  { key: "all", label: "Todos" },
  { key: STATUS.WANT_TO_READ, label: "Quero ler" },
  { key: STATUS.READING, label: "Lendo" },
  { key: STATUS.PAUSED, label: "Pausados" },
  { key: STATUS.COMPLETED, label: "Concluídos" },
  { key: STATUS.ABANDONED, label: "Abandonados" },
];

let uiState = { tab: "all", query: "", sort: "recent" };
let openMenuBookId = null;

function displayReadingForBook(bookId) {
  const open = openReadingForBook(bookId);
  if (open) return open;
  const all = listReadingsByBook(bookId);
  return all[0] || null;
}

function sortBooks(books) {
  const arr = [...books];
  switch (uiState.sort) {
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    case "author":
      return arr.sort((a, b) => authorNamesForBook(a).localeCompare(authorNamesForBook(b), "pt-BR"));
    case "rating": {
      const score = (b) => {
        const r = displayReadingForBook(b.id);
        return r ? ratingForReading(r.id)?.overall ?? -1 : -1;
      };
      return arr.sort((a, b) => score(b) - score(a));
    }
    case "recent":
    default:
      return arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
}

function bookCardHTML(book) {
  const reading = displayReadingForBook(book.id);
  const status = reading?.status || STATUS.WANT_TO_READ;
  const rating = reading ? ratingForReading(reading.id) : null;
  const authorNames = authorNamesForBook(book) || "Autor desconhecido";
  const initials = book.title.slice(0, 1).toUpperCase();

  let bodyExtra = "";
  if (status === STATUS.READING || status === STATUS.PAUSED) {
    const pct = progressPercent(reading, book);
    bodyExtra = `
      <div class="book-progress-mini">${reading.currentPage} / ${book.pages} pág. · ${pct}%</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <button class="btn btn-secondary btn-sm book-quick-action" data-action="progress" data-reading="${reading.id}" data-book="${book.id}">
        + progresso
      </button>
    `;
  } else if (status === STATUS.WANT_TO_READ) {
    bodyExtra = `
      <button class="btn btn-primary btn-sm book-quick-action" data-action="start" data-reading="${reading?.id ?? ""}" data-book="${book.id}">
        Começar a ler
      </button>
    `;
  } else if (status === STATUS.COMPLETED) {
    bodyExtra = rating
      ? `<div class="stars">${formatStars(rating.overall)}</div>`
      : `<button class="btn btn-secondary btn-sm book-quick-action" data-action="rate" data-reading="${reading.id}" data-book="${book.id}">Avaliar</button>`;
  } else if (status === STATUS.ABANDONED) {
    bodyExtra = `<div class="text-faint" style="font-size: var(--fs-2xs);">${reading?.abandonReason || ""}</div>`;
  }

  return `
    <div class="book-card" data-book-card="${book.id}">
      <div class="book-cover">
        ${book.cover ? `<img src="${book.cover}" alt="Capa de ${book.title}" />` : initials}
      </div>
      <div class="book-card-body">
        <div class="badge badge-${status}">${STATUS_LABELS[status]}</div>
        <div class="book-card-title">${book.title}</div>
        <div class="book-card-author">${authorNames}</div>
        ${bodyExtra}
        <div class="book-card-meta">
          <span class="text-faint" style="font-size: var(--fs-2xs);">${book.pages} pág. · ${book.genre}</span>
          <div class="menu-wrap">
            <button class="btn-icon" data-menu-toggle="${book.id}" aria-label="Mais ações">${icons.kebab}</button>
            ${openMenuBookId === book.id ? menuHTML(book, reading, status) : ""}
          </div>
        </div>
      </div>
    </div>
  `;
}

function menuHTML(book, reading, status) {
  const items = [];
  if (status === STATUS.READING || status === STATUS.PAUSED) {
    items.push(`<button data-action="progress" data-reading="${reading.id}" data-book="${book.id}">Registrar progresso</button>`);
    if (status === STATUS.READING) {
      items.push(`<button data-action="pause" data-reading="${reading.id}">Pausar</button>`);
    } else {
      items.push(`<button data-action="resume" data-reading="${reading.id}">Retomar</button>`);
    }
    items.push(`<button data-action="complete" data-reading="${reading.id}" data-book="${book.id}">Concluir</button>`);
    items.push(`<button data-action="abandon" data-reading="${reading.id}" data-book="${book.id}">Abandonar</button>`);
  } else if (status === STATUS.WANT_TO_READ) {
    items.push(`<button data-action="start" data-reading="${reading?.id ?? ""}" data-book="${book.id}">Começar a ler</button>`);
  } else if (status === STATUS.COMPLETED || status === STATUS.ABANDONED) {
    items.push(`<button data-action="reread" data-book="${book.id}">Ler novamente</button>`);
  }
  items.push(`<button data-action="edit" data-book="${book.id}">Editar livro</button>`);
  items.push(`<button class="danger" data-action="delete" data-book="${book.id}">Excluir livro</button>`);
  return `<div class="menu-pop" data-menu="${book.id}">${items.join("")}</div>`;
}

export function renderLibraryPage(container) {
  const allBooks = listBooks();

  const filtered = allBooks.filter((b) => {
    const reading = displayReadingForBook(b.id);
    const status = reading?.status || STATUS.WANT_TO_READ;
    const matchesTab = uiState.tab === "all" || status === uiState.tab;
    const q = uiState.query.trim().toLowerCase();
    const matchesQuery = !q || b.title.toLowerCase().includes(q) || authorNamesForBook(b).toLowerCase().includes(q);
    return matchesTab && matchesQuery;
  });

  const sorted = sortBooks(filtered);

  const counts = TABS.reduce((acc, t) => {
    if (t.key === "all") { acc[t.key] = allBooks.length; return acc; }
    acc[t.key] = allBooks.filter((b) => (displayReadingForBook(b.id)?.status || STATUS.WANT_TO_READ) === t.key).length;
    return acc;
  }, {});

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Biblioteca</h1>
        <div class="page-subtitle">${allBooks.length} ${allBooks.length === 1 ? "livro cadastrado" : "livros cadastrados"}</div>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-add-book">${icons.plus} Adicionar livro</button>
      </div>
    </div>

    <div class="library-controls">
      <div class="tab-bar">
        ${TABS.map((t) => `
          <button class="tab-item ${uiState.tab === t.key ? "is-active" : ""}" data-tab="${t.key}">
            ${t.label}<span class="tab-count">${counts[t.key]}</span>
          </button>
        `).join("")}
      </div>
      <div class="toolbar">
        <div class="search-field">
          ${icons.search}
          <input type="text" id="library-search" placeholder="Pesquisar por título ou autor..." value="${uiState.query}" />
        </div>
        <select class="select-field" id="library-sort">
          <option value="recent" ${uiState.sort === "recent" ? "selected" : ""}>Adicionados recentemente</option>
          <option value="title" ${uiState.sort === "title" ? "selected" : ""}>Título</option>
          <option value="author" ${uiState.sort === "author" ? "selected" : ""}>Autor</option>
          <option value="rating" ${uiState.sort === "rating" ? "selected" : ""}>Avaliação</option>
        </select>
      </div>
    </div>

    ${sorted.length === 0 ? emptyStateHTML(allBooks.length === 0) : `<div class="book-grid">${sorted.map(bookCardHTML).join("")}</div>`}
  `;

  wireLibraryEvents(container);
}

function emptyStateHTML(isFullyEmpty) {
  if (isFullyEmpty) {
    return `
      <div class="empty-state card">
        <h3>Sua estante está vazia</h3>
        <p>Adicione o primeiro livro para começar a acompanhar suas leituras.</p>
        <button class="btn btn-primary" id="btn-add-book-empty">${icons.plus} Adicionar livro</button>
      </div>
    `;
  }
  return `
    <div class="empty-state card">
      <h3>Nenhum livro encontrado</h3>
      <p>Tente ajustar a busca ou o filtro selecionado.</p>
    </div>
  `;
}

function wireLibraryEvents(container) {
  container.querySelector("#btn-add-book")?.addEventListener("click", () => openBookFormModal());
  container.querySelector("#btn-add-book-empty")?.addEventListener("click", () => openBookFormModal());

  container.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      uiState.tab = btn.dataset.tab;
      openMenuBookId = null;
      renderLibraryPage(container);
    });
  });

  const searchInput = container.querySelector("#library-search");
  searchInput?.addEventListener("input", (e) => {
    uiState.query = e.target.value;
    const caret = e.target.selectionStart;
    renderLibraryPage(container);
    const again = container.querySelector("#library-search");
    if (again) {
      again.focus();
      again.setSelectionRange(caret, caret);
    }
  });

  container.querySelector("#library-sort")?.addEventListener("change", (e) => {
    uiState.sort = e.target.value;
    renderLibraryPage(container);
  });

  container.querySelectorAll("[data-menu-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.menuToggle;
      openMenuBookId = openMenuBookId === id ? null : id;
      renderLibraryPage(container);
    });
  });

  document.addEventListener("click", () => {
    if (openMenuBookId !== null) {
      openMenuBookId = null;
      renderLibraryPage(container);
    }
  }, { once: true });

  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleAction(btn.dataset.action, btn.dataset);
    });
  });
}

function handleAction(action, data) {
  const book = data.book ? getBook(data.book) : null;

  switch (action) {
    case "start": {
      const full = data.reading ? { id: data.reading } : null;
      openStartReadingModal(book, full);
      break;
    }
    case "reread": {
      openStartReadingModal(book, null);
      break;
    }
    case "progress": {
      const full = displayReadingForBook(book.id);
      openProgressModal(book, full);
      break;
    }
    case "pause":
      pauseReading(data.reading);
      showToast("Leitura pausada.");
      break;
    case "resume":
      resumeReading(data.reading);
      showToast("Leitura retomada.");
      break;
    case "complete": {
      const full = displayReadingForBook(book.id);
      openCompleteFlow(book, full);
      break;
    }
    case "rate": {
      const full = displayReadingForBook(book.id);
      openCompleteFlow(book, full);
      break;
    }
    case "abandon": {
      const full = displayReadingForBook(book.id);
      openAbandonModal(book, full);
      break;
    }
    case "edit":
      openBookFormModal(book.id);
      break;
    case "delete":
      if (confirm(`Excluir "${book.title}"? Isso também remove seu histórico de leitura.`)) {
        deleteBook(book.id);
        showToast("Livro excluído.");
      }
      break;
  }
}
