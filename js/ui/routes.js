export function bookRoute(id) {
  return `#/livro/${encodeURIComponent(id)}`;
}

export function resolveRoute(hash) {
  if (hash.startsWith("#/autor/")) {
    try { const id = decodeURIComponent(hash.slice(8)); return { name: "autor", id: /^[a-zA-Z0-9_-]+$/.test(id) ? id : null }; }
    catch { return { name: "autor", id: null }; }
  }
  if (hash === "#/biblioteca") return { name: "biblioteca" };
  if (hash === "#/estatisticas") return { name: "estatisticas" };
  if (hash === "#/series") return { name: "series" };
  if (hash === "#/calendario") return { name: "calendario" };
  if (hash === "#/anotacoes") return { name: "anotacoes" };
  if (hash.startsWith("#/livro/")) {
    try {
      const id = decodeURIComponent(hash.slice("#/livro/".length));
      return { name: "livro", id: /^[a-zA-Z0-9_-]+$/.test(id) ? id : null };
    } catch { return { name: "livro", id: null }; }
  }
  return { name: "dashboard" };
}
