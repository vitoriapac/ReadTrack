import { icons } from "./ui/icons.js";
import { store } from "./storage/storage.js";
import { renderDashboardPage } from "./ui/dashboard.js";
import { renderLibraryPage } from "./ui/library.js";

const ROUTES = {
  dashboard: { label: "Visão geral", icon: icons.dashboard, render: renderDashboardPage },
  biblioteca: { label: "Biblioteca", icon: icons.library, render: renderLibraryPage },
};

function currentRoute() {
  const hash = window.location.hash.replace("#/", "");
  return ROUTES[hash] ? hash : "dashboard";
}

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
        <div class="sidebar-footer">Seus dados ficam salvos apenas neste navegador.</div>
      </aside>
      <main class="main">
        <div class="main-inner" id="view"></div>
      </main>
    </div>
  `;
}

function renderPage() {
  const route = currentRoute();
  document.querySelectorAll("[data-route]").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.route === route);
  });
  const view = document.getElementById("view");
  ROUTES[route].render(view);
}

function init() {
  renderShell();
  renderPage();
  window.addEventListener("hashchange", renderPage);
  store.subscribe(() => renderPage());
}

document.addEventListener("DOMContentLoaded", init);
