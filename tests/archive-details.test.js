import test from "node:test";
import assert from "node:assert/strict";
const memory = { raw: null, fail: false, writes: 0, getItem() { return this.raw; }, setItem(key, raw) { if (this.fail) throw new Error("quota"); this.raw = raw; this.writes++; } };
globalThis.localStorage = memory;
const { store } = await import("../js/storage/storage.js");
const { emptyState, migrate, CURRENT_VERSION } = await import("../js/storage/migrations.js");
const { createBook, getBook, listBooks, listLibraryBooks, archiveBook, restoreBook, canArchiveBook, bookDeletionSummary, deleteBook } = await import("../js/domain/books.js");
const { addToWantToRead, startReading, logProgress, completeReading, pauseReading, abandonReading } = await import("../js/domain/readings.js");
const { saveRating, ratingForReading } = await import("../js/domain/ratings.js");
const { computeOverviewStats } = await import("../js/services/statistics.js");
const { bookDetailsHTML, renderBookDetailsPage } = await import("../js/ui/book-details.js");
const { resolveRoute, bookRoute } = await import("../js/ui/routes.js");
const { renderLibraryPage } = await import("../js/ui/library.js");
function reset() { memory.fail = false; store.replaceAll(emptyState()); }
function book(title = "Livro") { return createBook({ title, authorName: "Autor compartilhado", pages: 100 }); }
function completed(bookId, note = "Notas da primeira leitura") {
  const reading = startReading(bookId, { startedAt: "2026-01-01" });
  logProgress(reading.id, { currentPage: 40, date: "2026-01-02", notes: note });
  completeReading(reading.id, { finishedAt: "2026-01-03" });
  return reading;
}

test("arquivar preserva histórico e indicadores, restaurar devolve à biblioteca", () => {
  reset(); const b = book(); const r = completed(b.id);
  saveRating(r.id, { overall: 4, review: "Boa leitura" });
  const stats = computeOverviewStats(), before = structuredClone(store.getState());
  let notifications = 0; const off = store.subscribe(() => notifications++);
  const writes = memory.writes;
  archiveBook(b.id);
  assert.equal(memory.writes - writes, 1); assert.equal(notifications, 1); off();
  assert.equal(listLibraryBooks().length, 0);
  assert.equal(listLibraryBooks({ archived: true })[0].id, b.id);
  assert.equal(listBooks().length, 1);
  assert.deepEqual(computeOverviewStats(), stats);
  for (const key of ["readings", "sessions", "ratings", "authors"]) assert.deepEqual(store.getState()[key], before[key]);
  assert.deepEqual(migrate(JSON.parse(store.exportJSON())), store.getState());
  restoreBook(b.id);
  assert.equal(getBook(b.id).archivedAt, null);
  assert.equal(listLibraryBooks().length, 1);
  assert.deepEqual(computeOverviewStats(), stats);
});

test("leitura em andamento ou pausada bloqueia arquivamento", () => {
  reset(); const b = book(); const r = startReading(b.id);
  assert.equal(canArchiveBook(b.id), false);
  assert.throws(() => archiveBook(b.id), /Conclua ou abandone/);
  pauseReading(r.id);
  assert.throws(() => archiveBook(b.id), /Conclua ou abandone/);
  abandonReading(r.id, "Outro");
  archiveBook(b.id); assert.ok(getBook(b.id).archivedAt);
});

test("arquivar quero ler preserva fila e bloqueia início até restauração", () => {
  reset(); const b = book(); const want = addToWantToRead(b.id);
  archiveBook(b.id);
  assert.equal(store.getState().readings[want.id].status, "want_to_read");
  assert.throws(() => startReading(b.id), /Restaure/);
  assert.throws(() => addToWantToRead(b.id), /Restaure/);
  restoreBook(b.id); assert.equal(startReading(b.id).id, want.id);
});

test("falha de gravação reverte arquivamento e restauração", () => {
  reset(); const b = book(); const before = store.exportJSON();
  memory.fail = true; assert.throws(() => archiveBook(b.id), /salvar/);
  assert.equal(store.exportJSON(), before);
  memory.fail = false; archiveBook(b.id);
  const archived = store.exportJSON();
  memory.fail = true; assert.throws(() => restoreBook(b.id), /salvar/);
  assert.equal(store.exportJSON(), archived); memory.fail = false;
});

test("migração v2→v3 apenas inicializa arquivamento e preserva volume", () => {
  reset(); const b = book(); completed(b.id);
  const legacy = structuredClone(store.getState()); legacy.meta.version = 2;
  for (const item of Object.values(legacy.books)) delete item.archivedAt;
  const raw = JSON.stringify(legacy), next = migrate(legacy);
  assert.equal(next.meta.version, CURRENT_VERSION);
  assert.equal(next.books[b.id].archivedAt, null);
  assert.deepEqual(next.sessions, legacy.sessions);
  assert.deepEqual(next.readings, legacy.readings);
  assert.equal(JSON.stringify(legacy), raw);
  assert.deepEqual(migrate(next), next);
});

test("backup rejeita data inválida e livro arquivado com leitura ativa", () => {
  reset(); const b = book(); startReading(b.id);
  const invalid = structuredClone(store.getState());
  invalid.books[b.id].archivedAt = "inválido"; assert.throws(() => migrate(invalid));
  invalid.books[b.id].archivedAt = new Date().toISOString(); assert.throws(() => migrate(invalid), /Encerre/);
});

test("resumo da exclusão corresponde ao alvo e preserva outro livro e autor compartilhado", () => {
  reset(); const a = book("A"), b = book("B");
  const ra = completed(a.id); saveRating(ra.id, { overall: 4 });
  const rb = completed(b.id); saveRating(rb.id, { overall: 5 });
  const summary = bookDeletionSummary(a.id);
  assert.equal(summary.readings, 1); assert.equal(summary.sessions, 2);
  assert.equal(summary.ratings, 1); assert.equal(summary.pagesRead, 100);
  assert.equal(summary.completed, 1);
  deleteBook(a.id, { expectedSnapshot: summary.snapshot });
  assert.equal(getBook(a.id), null); assert.ok(getBook(b.id));
  assert.ok(store.getState().readings[rb.id]); assert.ok(ratingForReading(rb.id));
  assert.equal(Object.keys(store.getState().authors).length, 1);
  assert.equal(computeOverviewStats().pagesRead, 100);
});

test("confirmação antiga de exclusão falha e erro de persistência não exclui", () => {
  reset(); const b = book(); const preview = bookDeletionSummary(b.id);
  completed(b.id);
  assert.throws(() => deleteBook(b.id, { expectedSnapshot: preview.snapshot }), /mudaram/);
  const before = store.exportJSON(), fresh = bookDeletionSummary(b.id);
  memory.fail = true;
  assert.throws(() => deleteBook(b.id, { expectedSnapshot: fresh.snapshot }), /salvar/);
  memory.fail = false; assert.equal(store.exportJSON(), before);
});

test("detalhes agrupam notas e avaliações na leitura correta durante releitura", () => {
  reset(); const b = book('Título <img src=x> "literal"');
  const first = completed(b.id, "Nota <b>literal</b>");
  saveRating(first.id, { overall: 4, review: "Resenha anterior", favorite: true });
  const second = startReading(b.id, { startedAt: "2026-02-01" });
  logProgress(second.id, { currentPage: 20, date: "2026-02-02", notes: "Nota da releitura" });
  const html = bookDetailsHTML(b.id);
  assert.ok(html.includes('Título &lt;img src=x&gt; &quot;literal&quot;'));
  assert.ok(html.includes("Nota &lt;b&gt;literal&lt;/b&gt;"));
  const sectionStart = html.indexOf('data-reading-section="' + first.id + '"');
  const firstSection = html.slice(sectionStart, html.indexOf("</section>", sectionStart));
  assert.ok(firstSection.includes("Resenha anterior"));
  assert.ok(firstSection.includes('data-action="rate" data-reading="' + first.id + '"'));
  assert.ok(!firstSection.includes("Nota da releitura"));
  saveRating(first.id, { overall: 5, review: "Resenha editada" });
  assert.equal(ratingForReading(first.id).favorite, true);
  assert.equal(store.getState().readings[second.id].currentPage, 20);
  assert.equal(ratingForReading(second.id), null);
  assert.ok(bookDetailsHTML(b.id).includes("Resenha editada"));
});

test("rotas diretas e inválidas não causam falha de renderização", () => {
  reset(); const b = book();
  assert.deepEqual(resolveRoute(bookRoute(b.id)), { name: "livro", id: b.id });
  assert.deepEqual(resolveRoute("#/livro/%ZZ"), { name: "livro", id: null });
  for (const id of [null, "missing", "constructor", "__proto__"]) assert.ok(bookDetailsHTML(id).includes("Livro não encontrado"));
  archiveBook(b.id); assert.ok(bookDetailsHTML(b.id).includes("Arquivado em"));
  assert.ok(bookDetailsHTML(b.id).includes("Restaurar livro"));
});

test("limpeza da página aborta os listeners de cada montagem", () => {
  reset(); const b = book(); const signals = [];
  const container = { innerHTML: "", addEventListener(type, handler, options) { signals.push(options.signal); } };
  for (let i = 0; i < 5; i++) {
    const cleanup = renderBookDetailsPage(container, b.id);
    assert.equal(signals.at(-1).aborted, false);
    cleanup(); assert.equal(signals.at(-1).aborted, true);
  }
});

test("biblioteca troca filtros sem acumular eventos e limpa handlers globais ao sair", () => {
  reset(); const activeBook = book("Ativo"), archivedBook = book("Arquivado");
  archiveBook(archivedBook.id);
  class Probe {
    events = new Set();
    innerHTML = "";
    addEventListener(type, fn, { signal }) {
      const entry = { type, fn }; this.events.add(entry);
      signal.addEventListener("abort", () => this.events.delete(entry), { once: true });
    }
    fire(type, event) { for (const entry of [...this.events]) if (entry.type === type) entry.fn(event); }
    contains() { return true; }
    focus() {}
    setSelectionRange() {}
  }
  const previousDocument = globalThis.document;
  const doc = new Probe(), container = new Probe(), search = new Probe(), sort = new Probe();
  container.querySelector = selector => selector === "#library-search" ? search : selector === "#library-sort" ? sort : null;
  globalThis.document = doc;
  let cleanup;
  try {
    cleanup = renderLibraryPage(container);
    assert.ok(container.innerHTML.includes(bookRoute(activeBook.id)));
    assert.ok(!container.innerHTML.includes(bookRoute(archivedBook.id)));
    for (let i = 0; i < 6; i++) {
      const archived = i % 2 === 0;
      const button = { id: "", dataset: { scope: archived ? "archived" : "active" } };
      container.fire("click", { target: { closest() { return button; } }, stopPropagation() {} });
      assert.equal(doc.events.size, 2);
      assert.equal(container.events.size, 1);
      assert.equal(search.events.size, 1);
      assert.equal(sort.events.size, 1);
      assert.ok(container.innerHTML.includes(bookRoute(archived ? archivedBook.id : activeBook.id)));
    }
    cleanup();
    assert.equal(doc.events.size, 0); assert.equal(container.events.size, 0);
    assert.equal(search.events.size, 0); assert.equal(sort.events.size, 0);
    container.innerHTML = "Outra página";
    doc.fire("click", { target: { closest() { return null; } } });
    assert.equal(container.innerHTML, "Outra página");
  } finally { cleanup?.(); globalThis.document = previousDocument; }
});
