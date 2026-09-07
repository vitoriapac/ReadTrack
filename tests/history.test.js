import test from "node:test";
import assert from "node:assert/strict";

const memory = { raw: null, fail: false, writes: 0, getItem() { return this.raw; }, setItem(key, value) { if (this.fail) throw new Error("quota"); this.raw = value; this.writes++; } };
globalThis.localStorage = memory;
const { store, Store } = await import("../js/storage/storage.js");
const { emptyState, migrate } = await import("../js/storage/migrations.js");
const { createBook } = await import("../js/domain/books.js");
const { startReading, logProgress, completeReading, getReading } = await import("../js/domain/readings.js");
const { correctSession, returnToPage } = await import("../js/domain/sessions.js");
const { readingVolume } = await import("../js/services/history.js");
const { prepareBackup, restorePreparedBackup } = await import("../js/storage/backup.js");

function setup(initialPage = 120) {
  memory.fail = false; store.replaceAll(emptyState());
  const book = createBook({ title: "Livro de teste", authorName: "Autor", pages: 400 });
  const reading = startReading(book.id, { initialPage, startedAt: "2026-01-01" });
  return { book, reading };
}
function legacy() {
  const { reading } = setup();
  logProgress(reading.id, { currentPage: 160, date: "2026-01-02" });
  const state = structuredClone(store.getState());
  state.meta.version = 1;
  for (const s of Object.values(state.sessions)) { delete s.type; delete s.revisions; delete s.sequence; }
  state.readings[reading.id].currentPage = 400;
  state.readings[reading.id].status = "completed";
  state.readings[reading.id].finishedAt = "2026-02-01";
  return state;
}

test("correção 120→160 para 145 reduz volume e preserva auditoria", () => {
  const { reading } = setup();
  const session = logProgress(reading.id, { currentPage: 160, date: "2026-01-02" });
  correctSession(session.id, { endPage: 145, reason: "Digitei errado" });
  assert.equal(readingVolume(store.getState()).pagesRead, 25);
  assert.equal(readingVolume(store.getState(), { from: "2026-01-01", to: "2026-01-31" }).pagesRead, 25);
  assert.equal(getReading(reading.id).currentPage, 145);
  const corrected = store.getState().sessions[session.id];
  assert.equal(corrected.revisions[0].before.pagesRead, 40);
  assert.equal(corrected.revisions[0].after.pagesRead, 25);
  assert.equal(corrected.date, "2026-01-02");
  correctSession(session.id, { endPage: 150, reason: "Conferi novamente" });
  assert.equal(store.getState().sessions[session.id].revisions.length, 2);
  assert.deepEqual(migrate(JSON.parse(store.exportJSON())), store.getState());
});

test("voltar para reler mantém volume e permite contar o trecho relido", () => {
  const { reading } = setup();
  logProgress(reading.id, { currentPage: 160, date: "2026-01-02" });
  returnToPage(reading.id, { currentPage: 145, date: "2026-01-03" });
  assert.equal(readingVolume(store.getState()).pagesRead, 40);
  assert.equal(readingVolume(store.getState()).readingDays, 1);
  logProgress(reading.id, { currentPage: 160, date: "2026-01-04" });
  assert.equal(readingVolume(store.getState()).pagesRead, 55);
  assert.equal(readingVolume(store.getState()).readingDays, 2);
  returnToPage(reading.id, { currentPage: 100, date: "2026-01-05" });
  assert.deepEqual(migrate(JSON.parse(store.exportJSON())), store.getState());
});

test("concluir após retorno registra somente o trecho restante", () => {
  const { reading } = setup();
  logProgress(reading.id, { currentPage: 365, date: "2026-01-02" });
  completeReading(reading.id, { finishedAt: "2026-01-03" });
  assert.equal(Object.values(store.getState().sessions).at(-1).pagesRead, 35);
  assert.equal(readingVolume(store.getState()).pagesRead, 280);
  assert.throws(() => completeReading(reading.id), /andamento/);
});

test("lançamento retroativo afeta a data real e não reordena a posição", () => {
  const { reading } = setup(0);
  logProgress(reading.id, { currentPage: 40, date: "2026-02-01" });
  logProgress(reading.id, { currentPage: 60, date: "2026-01-20" });
  assert.equal(readingVolume(store.getState(), { from: "2026-01-01", to: "2026-01-31" }).pagesRead, 20);
  assert.equal(getReading(reading.id).currentPage, 60);
  assert.throws(() => logProgress(reading.id, { currentPage: 70, date: "2025-12-31" }));
  assert.throws(() => completeReading(reading.id, { finishedAt: "2026-01-31" }));
});

test("correção de registro antigo não reescreve posições posteriores", () => {
  const { reading } = setup();
  const first = logProgress(reading.id, { currentPage: 160, date: "2026-01-02" });
  logProgress(reading.id, { currentPage: 200, date: "2026-02-01" });
  correctSession(first.id, { endPage: 145, date: "2026-01-03", reason: "Registro antigo errado" });
  assert.equal(getReading(reading.id).currentPage, 200);
  assert.equal(readingVolume(store.getState()).pagesRead, 65);
  assert.equal(readingVolume(store.getState(), { from: "2026-02-01", to: "2026-02-28" }).pagesRead, 40);
});

test("corrigir data move somente o volume daquela sessão entre períodos", () => {
  const { reading } = setup();
  const s = logProgress(reading.id, { currentPage: 160, date: "2026-01-31" });
  correctSession(s.id, { endPage: 160, date: "2026-02-01", reason: "Data correta" });
  assert.equal(readingVolume(store.getState(), { from: "2026-01-01", to: "2026-01-31" }).pagesRead, 0);
  assert.equal(readingVolume(store.getState(), { from: "2026-02-01", to: "2026-02-28" }).pagesRead, 40);
});

test("anular volume não cria um dia de leitura", () => {
  const { reading } = setup();
  const s = logProgress(reading.id, { currentPage: 160, date: "2026-01-02" });
  correctSession(s.id, { endPage: 120, reason: "Não houve leitura" });
  assert.equal(readingVolume(store.getState()).pagesRead, 0);
  assert.equal(readingVolume(store.getState()).readingDays, 0);
});

test("migração preserva total antigo sem inventar datas e é idempotente", () => {
  const old = legacy(), original = JSON.stringify(old);
  const migrated = migrate(old);
  assert.equal(migrated.meta.version, 3);
  assert.equal(JSON.stringify(old), original);
  assert.deepEqual(migrate(migrated), migrated);
  const volume = readingVolume(migrated);
  assert.equal(volume.pagesRead, 280); assert.equal(volume.datedPages, 40); assert.equal(volume.undatedPages, 240);
  const balance = Object.values(migrated.sessions).find(s => s.type === "balance");
  assert.equal(balance.date, null); assert.equal(balance.createdAt, null);
  assert.equal(readingVolume(migrated, { from: "2026-02-01", to: "2026-02-28" }).pagesRead, 0);
});

test("migração de dados inconsistentes bloqueia sem apagar o original", () => {
  const old = legacy(); const s = Object.values(old.sessions)[0];
  old.sessions.other = { ...s, id: "other", startPage: 0, endPage: 400, pagesRead: 400 };
  const raw = JSON.stringify(old);
  const local = new Store({ getItem() { return raw; }, setItem() { assert.fail("Não deve gravar"); } });
  assert.ok(local.loadError); assert.equal(local.exportJSON(), raw);
  assert.throws(() => migrate(old), /inconsistente/);
});

test("prévia migra, resume e não altera biblioteca", () => {
  const text = JSON.stringify(legacy());
  setup(); const before = store.exportJSON(), writes = memory.writes;
  const prepared = prepareBackup(text);
  assert.equal(prepared.sourceVersion, 1); assert.equal(prepared.targetVersion, 3);
  assert.equal(prepared.counts.books, 1); assert.equal(prepared.counts.sessions, 2);
  assert.equal(prepared.undatedPages, 240);
  assert.equal(store.exportJSON(), before); assert.equal(memory.writes, writes);
  restorePreparedBackup(store, prepared, before);
  assert.equal(readingVolume(store.getState()).pagesRead, 280);
});

test("prévia inválida e prévia desatualizada nunca substituem biblioteca", () => {
  setup(); const before = store.exportJSON();
  assert.throws(() => prepareBackup("{errado"), /JSON/);
  assert.throws(() => prepareBackup(JSON.stringify({ ...emptyState(), meta: { version: 99 } })), /incompatível/);
  const prepared = prepareBackup(before);
  createBook({ title: "Outro", authorName: "Outro", pages: 20 });
  const changed = store.exportJSON();
  assert.throws(() => restorePreparedBackup(store, prepared, before), /mudou/);
  assert.equal(store.exportJSON(), changed);
});

test("falhas ao corrigir, retornar ou restaurar deixam tudo intacto", () => {
  const { reading } = setup();
  const s = logProgress(reading.id, { currentPage: 160, date: "2026-01-02" });
  const before = store.exportJSON(), prepared = prepareBackup(before);
  memory.fail = true;
  assert.throws(() => correctSession(s.id, { endPage: 145, reason: "Erro" }), /salvar/);
  assert.throws(() => returnToPage(reading.id, { currentPage: 145, date: "2026-01-03" }), /salvar/);
  assert.throws(() => restorePreparedBackup(store, prepared, before), /salvar/);
  memory.fail = false; assert.equal(store.exportJSON(), before);
});

test("importação rejeita auditoria e ordem adulteradas", () => {
  const { reading } = setup();
  const s = logProgress(reading.id, { currentPage: 160, date: "2026-01-02" });
  correctSession(s.id, { endPage: 145, reason: "Erro" });
  const invalid = structuredClone(store.getState()); invalid.sessions[s.id].pagesRead = 999;
  assert.throws(() => migrate(invalid));
  const duplicate = structuredClone(store.getState()); duplicate.sessions.other = { ...duplicate.sessions[s.id], id: "other" };
  assert.throws(() => migrate(duplicate), /duplicada/);
});
