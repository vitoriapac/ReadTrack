let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-stack";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, { duration = 2600 } = {}) {
  const stack = ensureContainer();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), duration);
}
