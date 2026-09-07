// Utilitários de data — trabalham sempre com strings ISO (YYYY-MM-DD)
// para simplificar armazenamento e comparação.

export function todayISO() {
  return toISODate(new Date());
}

export function toISODate(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatDateBR(isoDate) {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}`;
}

export function formatDateFullBR(isoDate) {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateLongBR(isoDate) {
  if (!isoDate) return "—";
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function relativeDayLabel(isoDate) {
  if (!isoDate) return "";
  const today = todayISO();
  const yesterday = toISODate(new Date(Date.now() - 86400000));
  if (isoDate === today) return "hoje";
  if (isoDate === yesterday) return "ontem";
  return formatDateFullBR(isoDate);
}

export function daysBetween(isoStart, isoEnd) {
  const start = new Date(`${isoStart}T00:00:00`);
  const end = new Date(`${isoEnd}T00:00:00`);
  return Math.max(1, Math.round((end - start) / 86400000));
}

export function monthLabel(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}
