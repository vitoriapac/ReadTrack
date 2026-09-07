export function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
export function pageNumber(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  requireValue(Number.isSafeInteger(number) && number >= 0 && number <= max, "Informe uma página inteira dentro do total do livro.");
  return number;
}
export function validDate(value, earliest = null) {
  requireValue(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value), "Informe uma data válida.");
  const date = new Date(`${value}T00:00:00Z`);
  requireValue(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value, "Informe uma data válida.");
  requireValue(!earliest || value >= earliest, "A data não pode ser anterior ao início ou ao último progresso.");
  return value;
}
export function coverURL(value) {
  if (!value) return null;
  let url;
  try { url = new URL(String(value).trim()); } catch { throw new Error("Informe uma URL de capa HTTP ou HTTPS válida."); }
  requireValue(["http:", "https:"].includes(url.protocol) && !url.username && !url.password, "Use uma URL de capa HTTP ou HTTPS sem credenciais.");
  return url.href;
}
