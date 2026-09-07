import { icons } from "./icons.js";
let root = null;
let previousFocus = null;
let removeKeys = null;

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
  removeKeys?.();
  removeKeys = null;
  document.getElementById("app").inert = false;
  if (previousFocus?.isConnected) previousFocus.focus();
  else if (previousFocus?.id) document.getElementById(previousFocus.id)?.focus();
  else document.querySelector('#view button, #nav-group a')?.focus();
}

export function openModal({ title, bodyHTML, footHTML, onMount }) {
  if (root?.firstElementChild) closeModal();
  previousFocus = document.activeElement;
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
  el.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeModal));
  document.getElementById("app").inert = true;
  const keydown = (event) => {
    if (event.key === "Escape") { event.preventDefault(); closeModal(); }
    if (event.key === "Tab") {
      const items = [...el.querySelectorAll('button, input:not([type="hidden"]), select, textarea, [tabindex="0"]')].filter(item => !item.disabled);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener("keydown", keydown);
  removeKeys = () => document.removeEventListener("keydown", keydown);
  el.querySelector("input:not([type=hidden]), select, textarea, button")?.focus();
  if (onMount) onMount(el);
}
