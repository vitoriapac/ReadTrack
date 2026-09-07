import test from "node:test";
import assert from "node:assert/strict";
const memory = { raw: null, fail: false, writes: 0, getItem() { return this.raw; }, setItem(key, value) { if (this.fail) throw new Error("QuotaExceededError"); this.raw = value; this.writes++; } };
globalThis.localStorage = memory;
const { store, Store } = await import("../js/storage/storage.js");
const { emptyState, migrate } = await import("../js/storage/migrations.js");
const { createBook, updateBook, deleteBook } = await import("../js/domain/books.js");
const { addToWantToRead, startReading, logProgress, completeReading, pauseReading, resumeReading } = await import("../js/domain/readings.js");
const { saveRating } = await import("../js/domain/ratings.js");
const { computeOverviewStats } = await import("../js/services/statistics.js");
const { escapeHTML } = await import("../js/utils/html.js");
const { coverURL } = await import("../js/utils/validation.js");
function reset() { memory.fail = false; store.replaceAll(emptyState()); }
function book() { return createBook({ title: 'Livro "A" <teste>', authorName: "Autor", pages: 100 }); }

test("cadastro composto grava e notifica apenas uma vez", () => {
  reset(); let events = 0; const off = store.subscribe(() => events++); const before = memory.writes;
  store.mutate(() => { const b = book(); addToWantToRead(b.id); });
  assert.equal(memory.writes - before, 1); assert.equal(events, 1); off();
});
test("falha de persistência reverte livro, autor e notificações", () => {
  reset(); const before = store.exportJSON(); let events = 0; const off = store.subscribe(() => events++);
  memory.fail = true; assert.throws(book, /salvar/); memory.fail = false;
  assert.equal(store.exportJSON(), before); assert.equal(events, 0); off();
});
test("dados ilegíveis são preservados e bloqueiam gravação", () => {
  const storage = { raw: "{quebrado", getItem() { return this.raw; }, setItem(k, v) { this.raw = v; } };
  const local = new Store(storage); assert.ok(local.loadError);
  assert.throws(() => local.mutate(s => s.books = {})); assert.equal(local.exportJSON(), "{quebrado");
  local.replaceAll(emptyState()); assert.equal(local.loadError, null);
});
test("conflito entre abas não sobrescreve dados", () => {
  const storage = { raw: null, getItem() { return this.raw; }, setItem(k, v) { this.raw = v; } };
  const first = new Store(storage), second = new Store(storage);
  first.mutate(s => s.meta.createdAt = "2026-01-01");
  assert.throws(() => second.mutate(s => s.meta.createdAt = "2026-02-01"), /outra aba/);
});
test("progresso, conclusão, releitura e exclusão preservam invariantes", () => {
  reset(); const b = book(); const want = addToWantToRead(b.id);
  assert.equal(addToWantToRead(b.id).id, want.id);
  const r = startReading(b.id, { initialPage: 10, startedAt: "2026-01-01" });
  assert.throws(() => startReading(b.id), /aberta/);
  logProgress(r.id, { currentPage: 40, date: "2026-01-02" });
  assert.equal(computeOverviewStats().pagesRead, 30);
  assert.throws(() => logProgress(r.id, { currentPage: 20, date: "2026-01-02" }));
  assert.throws(() => logProgress(r.id, { currentPage: 101, date: "2026-01-02" }));
  assert.throws(() => logProgress(r.id, { currentPage: 50, date: "2025-12-31" }));
  assert.throws(() => updateBook(b.id, { pages: 20 }));
  pauseReading(r.id); resumeReading(r.id);
  completeReading(r.id, { finishedAt: "2026-01-03" });
  assert.equal(Object.values(store.getState().sessions).reduce((n, s) => n + s.pagesRead, 0), 90);
  saveRating(r.id, { overall: 4, review: "Ótimo" });
  assert.equal(computeOverviewStats().avgRating, 4);
  assert.throws(() => logProgress(r.id, { currentPage: 100 }));
  const reread = startReading(b.id, { startedAt: "2026-02-01" }); assert.equal(reread.isReread, true);
  assert.deepEqual(migrate(JSON.parse(store.exportJSON())), store.getState());
  deleteBook(b.id);
  for (const key of ["books", "authors", "readings", "sessions", "ratings"]) assert.equal(Object.keys(store.getState()[key]).length, 0);
});
test("migrações rejeitam versões futuras, tipos e referências inválidas", () => {
  assert.throws(() => migrate({ ...emptyState(), meta: { version: 99 } }));
  assert.throws(() => migrate({ ...emptyState(), books: [] }));
  assert.throws(() => migrate(null));
  assert.throws(() => migrate({ ...emptyState(), readings: { x: { id: "x", bookId: "missing" } } }));
  assert.equal(migrate({}).meta.version, 3);
});
test("textos são escapados e capas aceitam apenas HTTP(S)", () => {
  assert.equal(escapeHTML('<img src="x" onerror=\'bad\'>&'), "&lt;img src=&quot;x&quot; onerror=&#39;bad&#39;&gt;&amp;");
  assert.throws(() => coverURL("javascript:alert(1)"));
  assert.throws(() => coverURL("data:text/html,test"));
  assert.equal(coverURL("https://example.com/capa.jpg"), "https://example.com/capa.jpg");
});

test("erro de validação em operação composta não deixa dados parciais", () => {
  reset(); const before = store.exportJSON();
  assert.throws(() => store.mutate(() => { book(); createBook({ title: "", pages: -1 }); }));
  assert.equal(store.exportJSON(), before);
});

test("datas impossíveis, notas inválidas e referências cruzadas são rejeitadas", () => {
  reset(); const a = book(), b = book();
  assert.throws(() => startReading(a.id, { startedAt: "2026-02-30" }));
  const want = addToWantToRead(a.id);
  assert.throws(() => startReading(b.id, { fromReadingId: want.id }));
  const reading = startReading(a.id, { startedAt: "2026-01-01" });
  assert.throws(() => saveRating(reading.id, { overall: 4 }));
  completeReading(reading.id, { finishedAt: "2026-01-02" });
  assert.throws(() => saveRating(reading.id, { overall: 6 }));
  assert.throws(() => saveRating(reading.id, { overall: NaN }));
});

test("restauração inválida não substitui biblioteca nem conteúdo persistido", () => {
  reset(); book(); const before = store.exportJSON(), raw = memory.raw;
  assert.throws(() => store.replaceAll({ ...emptyState(), books: [] }));
  assert.equal(store.exportJSON(), before); assert.equal(memory.raw, raw);
});

test("conclusão e avaliação falham juntas quando não é possível salvar", () => {
  reset(); const b = book(); const r = startReading(b.id, { startedAt: "2026-01-01" });
  const before = store.exportJSON(); memory.fail = true;
  assert.throws(() => store.mutate(() => {
    completeReading(r.id, { finishedAt: "2026-01-02" });
    saveRating(r.id, { overall: 5 });
  }));
  memory.fail = false; assert.equal(store.exportJSON(), before);
});
