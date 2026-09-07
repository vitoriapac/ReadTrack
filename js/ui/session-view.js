import { escapeHTML as esc } from "../utils/html.js";
import { formatDateFullBR } from "../utils/dates.js";

export function sessionHistoryHTML(session) {
  return `<article class="history-entry" data-session-id="${session.id}">
    <p><strong>${session.type === "balance" ? "Saldo sem data conhecida" : formatDateFullBR(session.date)}</strong></p>
    <p>${session.type === "balance" ? `${session.pagesRead} páginas preservadas do histórico antigo; não entram em períodos.` : session.type === "position" ? `Retorno: ${session.startPage} → ${session.endPage}. Nenhuma página descontada.` : `${session.startPage} → ${session.endPage} · ${session.pagesRead} páginas lidas`}</p>
    ${session.notes ? `<p class="history-note">${esc(session.notes)}</p>` : ""}
    ${session.revisions.length ? `<details><summary>${session.revisions.length} correção(ões)</summary>${session.revisions.map(revision => `<p class="history-note">${esc(revision.createdAt)} — ${revision.before.pagesRead} → ${revision.after.pagesRead} páginas; ${formatDateFullBR(revision.before.date)} → ${formatDateFullBR(revision.after.date)}. Motivo: ${esc(revision.reason)}</p>`).join("")}</details>` : ""}
    ${session.type === "reading" ? `<button class="btn btn-secondary btn-sm" data-correct="${session.id}">Corrigir registro</button>` : ""}
  </article>`;
}
