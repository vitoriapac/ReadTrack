import { periodFor } from "../services/periods.js";
import { escapeHTML as esc } from "../utils/html.js";
import { validDate } from "../utils/validation.js";
let selection = { key: "year", ...periodFor("year") };
export const selectedPeriod = () => ({ ...selection });
export function periodFilterHTML() {
  return `<form id="period-form" class="toolbar no-print"><div class="field"><label for="period-kind">Período</label><select id="period-kind" name="kind">${Object.entries({ month: "Este mês", year: "Este ano", previousYear: "Ano anterior", all: "Todo período", custom: "Personalizado" }).map(([key,label]) => `<option value="${key}" ${key === selection.key ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label for="period-from">De</label><input id="period-from" type="date" name="from" value="${esc(selection.from || "")}" /></div><div class="field"><label for="period-to">Até</label><input id="period-to" type="date" name="to" value="${esc(selection.to || "")}" /></div><button class="btn btn-secondary">Aplicar</button><p id="period-error" role="alert"></p></form>`;
}
export function wirePeriod(container, render) {
  const form = container.querySelector("#period-form");
  form.elements.kind.addEventListener("change", () => {
    if (form.elements.kind.value !== "custom") {
      selection = { key: form.elements.kind.value, ...periodFor(form.elements.kind.value) };
      render();
    }
  });
  for (const name of ["from", "to"]) form.elements[name].addEventListener("input", () => { form.elements.kind.value = "custom"; });
  form.addEventListener("submit", event => {
    event.preventDefault();
    try {
      const from = form.elements.from.value, to = form.elements.to.value;
      if (form.elements.kind.value === "all") selection = { key: "all", from: null, to: null };
      else { validDate(from); validDate(to, from); selection = { key: form.elements.kind.value, from, to }; }
      render();
    } catch (error) { container.querySelector("#period-error").textContent = error.message; }
  });
}
