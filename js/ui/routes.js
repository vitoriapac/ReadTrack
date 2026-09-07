export function bookRoute(id) {
  return `#/livro/${encodeURIComponent(id)}`;
}

export function resolveRoute(hash) {
  if (hash === "#/biblioteca") return { name: "biblioteca" };
  if (hash.startsWith("#/livro/")) {
    try {
      const id = decodeURIComponent(hash.slice("#/livro/".length));
      return { name: "livro", id: /^[a-zA-Z0-9_-]+$/.test(id) ? id : null };
    } catch { return { name: "livro", id: null }; }
  }
  return { name: "dashboard" };
}
