import { createGoal, updateGoal, deleteGoal, GOAL_TYPES } from "../services/goals.js";
import { projectGoal } from "../services/projections.js";
import { store } from "../storage/storage.js";
import { escapeHTML as esc } from "../utils/html.js";
import { openModal, closeModal } from "./dialog.js";
export function goalsHTML(state) {
  return `<section class="card"><div class="card-head"><h2>Metas</h2><button class="btn btn-primary no-print" data-goal="new">Nova meta</button></div>${Object.values(state.goals || {}).map(goal => {
    const g = projectGoal(goal, state);
    return `<article class="history-entry"><h3>${GOAL_TYPES[g.type]}: ${g.current} / ${g.target}</h3><p>${esc(g.startDate)} a ${esc(g.endDate)}${g.filters?.genre ? ` · ${esc(g.filters.genre)}` : ""}${g.filters?.minPages ? ` · a partir de ${g.filters.minPages} páginas` : ""}</p><progress max="100" value="${g.percentage}" aria-label="Progresso da meta"></progress><p>Ritmo: ${g.perMonth.toFixed(1)}/mês. ${g.remainingDays ? `Necessário: ${g.neededPerMonth.toFixed(1)}/mês.` : "Período encerrado."} ${g.projection == null ? "Projeção disponível após 7 dias." : `Projeção no prazo: ${g.projection}.`}</p><div class="detail-actions no-print"><button class="btn btn-secondary" data-goal="${g.id}">Editar</button><button class="btn btn-danger-ghost" data-delete-goal="${g.id}">Excluir</button></div></article>`;
  }).join("") || "<p>Nenhuma meta cadastrada.</p>"}</section>`;
}
export function openGoalForm(id = null) {
  const goal = id ? store.getState().goals[id] : null;
  const year = new Date().getFullYear();
  openModal({ title: goal ? "Editar meta" : "Nova meta",
    bodyHTML: `<form id="goal-form" class="history-form"><div class="field"><label for="goal-type">Medida</label><select id="goal-type" name="type">${Object.entries(GOAL_TYPES).map(([key,label]) => `<option value="${key}" ${goal?.type === key ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label for="goal-target">Alvo</label><input id="goal-target" name="target" type="number" min="1" step="1" required value="${goal?.target || 12}" /></div><div class="field"><label for="goal-start">Início</label><input id="goal-start" name="startDate" type="date" required value="${goal?.startDate || year + "-01-01"}" /></div><div class="field"><label for="goal-end">Fim</label><input id="goal-end" name="endDate" type="date" required value="${goal?.endDate || year + "-12-31"}" /></div><div class="field"><label for="goal-genre">Gênero (opcional)</label><input id="goal-genre" name="genre" value="${esc(goal?.filters?.genre || "")}" /></div><div class="field"><label for="goal-size">Mínimo de páginas por livro (opcional)</label><input id="goal-size" name="minPages" type="number" min="0" value="${goal?.filters?.minPages || ""}" /></div><p role="alert" id="goal-error"></p></form>`,
    footHTML: '<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" form="goal-form">Salvar</button>',
    onMount(el) { el.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      try {
        const data = Object.fromEntries(new FormData(event.target));
        const payload = { type: data.type, target: Number(data.target), startDate: data.startDate, endDate: data.endDate, filters: { genre: data.genre.trim(), minPages: Number(data.minPages) } };
        if (goal) updateGoal(goal.id, payload); else createGoal(payload);
        closeModal();
      } catch (error) { el.querySelector("#goal-error").textContent = error.message; }
    }); }
  });
}
export function wireGoals(container) {
  container.querySelectorAll("[data-goal]").forEach(button => button.addEventListener("click", () => openGoalForm(button.dataset.goal === "new" ? null : button.dataset.goal)));
  container.querySelectorAll("[data-delete-goal]").forEach(button => button.addEventListener("click", () => {
    openModal({ title: "Excluir meta", bodyHTML: "<p>A meta será removida. As leituras serão preservadas.</p>", footHTML: '<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-danger-ghost" id="confirm-goal-delete">Excluir meta</button>', onMount(el) { el.querySelector("#confirm-goal-delete").addEventListener("click", () => { deleteGoal(button.dataset.deleteGoal); closeModal(); }); } });
  }));
}
