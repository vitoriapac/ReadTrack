import { downloadBackup, prepareBackup } from "./storage/backup.js";
import { openBackupPreview } from "./ui/backup.js";
import { showToast } from "./ui/toast.js";
import { icons } from "./ui/icons.js";
import { store } from "./storage/storage.js";
import { renderDashboardPage } from "./ui/dashboard.js";
import { renderLibraryPage } from "./ui/library.js";
import { renderBookDetailsPage } from "./ui/book-details.js";
import { resolveRoute } from "./ui/routes.js";
import { closeModal } from "./ui/dialog.js";

const ROUTES = {
  dashboard: { label: "Visão geral", icon: icons.dashboard, render: renderDashboardPage },
  biblioteca: { label: "Biblioteca", icon: icons.library, render: renderLibraryPage },
};

let disposePage = null;

function renderShell() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">${icons.quill}</div>
          <div class="brand-name">ReadTrack</div>
        </div>
        <nav class="nav-group is-primary" id="nav-group">
          ${Object.entries(ROUTES).map(([key, r]) => `
            <a class="nav-item" data-route="${key}" href="#/${key}">${r.icon}<span>${r.label}</span></a>
          `).join("")}
        </nav>
        <div class="sidebar-footer">
          <p>Seus dados ficam salvos apenas neste navegador.</p>
          <button class="btn btn-secondary btn-sm" id="export-backup">Exportar backup</button>
          <button class="btn btn-secondary btn-sm" id="import-backup">Restaurar backup</button>
          <input type="file" id="backup-file" accept=".json,application/json" hidden />
        </div>
      </aside>
      <main class="main">
        <div class="main-inner" id="view"></div>
      </main>
    </div>
  `;
}

function renderPage() {
  disposePage?.();
  disposePage = null;
  const route = resolveRoute(window.location.hash);
  document.getElementById("storage-error")?.remove();
  document.querySelectorAll("[data-route]").forEach((a) => {
    const active = a.dataset.route === (route.name === "livro" ? "biblioteca" : route.name);
    a.classList.toggle("is-active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const view = document.getElementById("view");
  disposePage = route.name === "livro" ? renderBookDetailsPage(view, route.id) : ROUTES[route.name].render(view);
  document.title = `${view.querySelector("h1")?.textContent || "ReadTrack"} — ReadTrack`;
  if (store.loadError) {
    const warning = document.createElement("p");
    warning.id = "storage-error";
    warning.setAttribute("role", "alert");
    warning.textContent = store.loadError;
    view.prepend(warning);
  }
}

function init() {
  // Uma exceção de validação interrompe o handler antes de anunciar sucesso.
  window.addEventListener("error", event => {
    showToast(event.error?.message || "Não foi possível concluir a operação.", { duration: 7000 });
    event.preventDefault();
  });
  renderShell();
  document.getElementById("export-backup").addEventListener("click", () => downloadBackup(store));
  const input = document.getElementById("backup-file");
  document.getElementById("import-backup").addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("O backup deve ter até 10 MB.");
      const prepared = prepareBackup(await file.text());
      openBackupPreview(prepared, file.name);
    } catch (error) { showToast(error.message, { duration: 7000 }); }
    finally { input.value = ""; }
  });
  renderPage();
  window.addEventListener("hashchange", () => {
    closeModal();
    renderPage();
    const heading = document.querySelector("#view h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
  });
  store.subscribe(() => renderPage());
}

document.addEventListener("DOMContentLoaded", init);
