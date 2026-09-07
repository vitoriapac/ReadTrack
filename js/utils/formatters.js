export function formatNumber(n) {
  return new Intl.NumberFormat("pt-BR").format(n ?? 0);
}

export function formatStars(value) {
  if (value == null) return "—";
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "");
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function pct(part, total) {
  if (!total) return 0;
  return clamp(Math.round((part / total) * 100), 0, 100);
}

export function truncate(text, max = 60) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}
