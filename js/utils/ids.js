// Geração de identificadores únicos simples (sem dependências externas).
// Formato: <timestamp base36>-<aleatório base36>

export function createId(prefix = "") {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 9);
  return prefix ? `${prefix}_${time}${rand}` : `${time}${rand}`;
}
