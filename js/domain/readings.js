import { nextSequence, sessionDate } from "../services/history.js";
import { requireValue, pageNumber, validDate } from "../utils/validation.js";
import { store } from "../storage/storage.js";
import { createId } from "../utils/ids.js";
import { todayISO } from "../utils/dates.js";
import { getBook } from "./books.js";

export const STATUS = {
  WANT_TO_READ: "want_to_read",
  READING: "reading",
  PAUSED: "paused",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
};

export const STATUS_LABELS = {
  [STATUS.WANT_TO_READ]: "Quero ler",
  [STATUS.READING]: "Lendo",
  [STATUS.PAUSED]: "Pausado",
  [STATUS.COMPLETED]: "Concluído",
  [STATUS.ABANDONED]: "Abandonado",
};

export const ABANDON_REASONS = [
  "Não me prendeu",
  "Ritmo lento",
  "Escrita não agradou",
  "Muito difícil",
  "Tema não interessou",
  "Outro",
];

export function listReadings() {
  return Object.values(store.getState().readings);
}

export function getReading(id) {
  return store.getState().readings[id] || null;
}

export function listReadingsByBook(bookId) {
  return listReadings()
    .filter((r) => r.bookId === bookId)
    .reverse() // Em empates de timestamp, a leitura inserida por último vem primeiro.
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

/** Leitura "em aberto" mais recente do livro (não concluída/abandonada), se houver. */
export function openReadingForBook(bookId) {
  return listReadingsByBook(bookId).find(
    (r) => r.status !== STATUS.COMPLETED && r.status !== STATUS.ABANDONED
  ) || null;
}

export function listByStatus(status) {
  return listReadings()
    .filter((r) => r.status === status)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function addToWantToRead(bookId) {
  requireValue(getBook(bookId), "Livro não encontrado.");
  requireValue(!getBook(bookId).archivedAt, "Restaure o livro antes de iniciar uma leitura.");
  const existing = openReadingForBook(bookId);
  if (existing) return existing;
  const reading = {
    id: createId("rd"),
    bookId,
    status: STATUS.WANT_TO_READ,
    startedAt: null,
    finishedAt: null,
    initialPage: 0,
    currentPage: 0,
    ratingId: null,
    isReread: listReadingsByBook(bookId).some((r) => r.status === STATUS.COMPLETED),
    abandonReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.mutate((state) => { state.readings[reading.id] = reading; });
  return reading;
}

/** Inicia uma leitura nova (ou promove um "quero ler" existente). */
export function startReading(bookId, { initialPage = 0, startedAt = todayISO(), fromReadingId = null } = {}) {
  const book = getBook(bookId);
  requireValue(book, "Livro não encontrado.");
  requireValue(!book.archivedAt, "Restaure o livro antes de iniciar uma leitura.");
  initialPage = pageNumber(initialPage, book.pages);
  validDate(startedAt);
  let reading = fromReadingId ? getReading(fromReadingId) : openReadingForBook(bookId);
  requireValue(!fromReadingId || reading, "Leitura não encontrada.");
  requireValue(!reading || (reading.bookId === bookId && reading.status === STATUS.WANT_TO_READ), "Já existe uma leitura aberta ou a leitura não pode ser iniciada.");
  requireValue(!openReadingForBook(bookId) || openReadingForBook(bookId).id === reading?.id, "Já existe uma leitura aberta.");

  if (!reading) {
    reading = {
      id: createId("rd"),
      bookId,
      status: STATUS.READING,
      startedAt,
      finishedAt: null,
      initialPage: Number(initialPage) || 0,
      currentPage: Number(initialPage) || 0,
      ratingId: null,
      isReread: listReadingsByBook(bookId).some((r) => r.status === STATUS.COMPLETED),
      abandonReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.mutate((state) => { state.readings[reading.id] = reading; });
  } else {
    store.mutate((state) => {
      const r = state.readings[reading.id];
      r.status = STATUS.READING;
      r.startedAt = r.startedAt || startedAt;
      r.initialPage = Number(initialPage) || 0;
      r.currentPage = Number(initialPage) || 0;
      r.updatedAt = new Date().toISOString();
    });
    reading = getReading(reading.id);
  }
  return reading;
}

/**
 * Registra progresso de leitura: cria uma ReadingSession com o delta de
 * páginas e atualiza a página atual da leitura. Nunca sobrescreve o
 * histórico — cada chamada gera um novo registro.
 */
export function logProgress(readingId, { currentPage, date = todayISO(), notes = "" }) {
  const reading = getReading(readingId);
  requireValue(reading && [STATUS.READING, STATUS.PAUSED].includes(reading.status), "A leitura precisa estar em andamento.");
  sessionDate(date, reading);
  requireValue(typeof notes === "string", "Notas inválidas.");
  const newPage = pageNumber(currentPage, getBook(reading.bookId).pages);
  requireValue(newPage > reading.currentPage, "A página deve ser maior que a última registrada.");
  const previousPage = reading.currentPage;
  const pagesRead = newPage - previousPage;

  const session = {
    id: createId("ses"),
    readingId,
    type: "reading",
    sequence: nextSequence(store.getState(), readingId),
    revisions: [],
    date,
    startPage: previousPage,
    endPage: newPage,
    pagesRead,
    duration: null,
    notes: notes || "",
    createdAt: new Date().toISOString(),
  };

  store.mutate((state) => {
    state.sessions[session.id] = session;
    const r = state.readings[readingId];
    r.currentPage = newPage;
    r.updatedAt = new Date().toISOString();
    if (r.status === STATUS.PAUSED) r.status = STATUS.READING;
  });

  return session;
}

export function pauseReading(readingId) {
  requireValue(getReading(readingId)?.status === STATUS.READING, "Só é possível pausar uma leitura em andamento.");
  store.mutate((state) => {
    const r = state.readings[readingId];
    if (!r) return;
    r.status = STATUS.PAUSED;
    r.updatedAt = new Date().toISOString();
  });
}

export function resumeReading(readingId) {
  requireValue(getReading(readingId)?.status === STATUS.PAUSED, "Só é possível retomar uma leitura pausada.");
  store.mutate((state) => {
    const r = state.readings[readingId];
    if (!r) return;
    r.status = STATUS.READING;
    r.updatedAt = new Date().toISOString();
  });
}

export function abandonReading(readingId, reason = null) {
  requireValue([STATUS.READING, STATUS.PAUSED].includes(getReading(readingId)?.status), "A leitura precisa estar em andamento.");
  store.mutate((state) => {
    const r = state.readings[readingId];
    if (!r) return;
    r.status = STATUS.ABANDONED;
    r.abandonReason = reason;
    r.updatedAt = new Date().toISOString();
  });
}

/** Marca a leitura como concluída. A avaliação (se houver) é criada à parte. */
export function completeReading(readingId, { finishedAt = todayISO() } = {}) {
  const reading = getReading(readingId);
  requireValue(reading && [STATUS.READING, STATUS.PAUSED].includes(reading.status), "A leitura precisa estar em andamento.");
  const lastDate = Object.values(store.getState().sessions).filter(s => s.readingId === readingId).reduce((last, s) => s.date > last ? s.date : last, reading.startedAt);
  validDate(finishedAt, lastDate);
  store.mutate((state) => {
    const r = state.readings[readingId];
    if (!r) return;
    const book = state.books[r.bookId];
    if (r.currentPage < book.pages) logProgress(readingId, { currentPage: book.pages, date: finishedAt });
    r.status = STATUS.COMPLETED;
    r.finishedAt = finishedAt;
    if (book?.pages) r.currentPage = book.pages;
    r.updatedAt = new Date().toISOString();
  });
}

export function linkRating(readingId, ratingId) {
  requireValue(getReading(readingId) && store.getState().ratings[ratingId]?.readingId === readingId, "Vínculo de avaliação inválido.");
  store.mutate((state) => {
    const r = state.readings[readingId];
    if (r) r.ratingId = ratingId;
  });
}

export function deleteReading(readingId) {
  store.mutate((state) => {
    Object.values(state.sessions)
      .filter((s) => s.readingId === readingId)
      .forEach((s) => delete state.sessions[s.id]);
    Object.values(state.ratings)
      .filter((r) => r.readingId === readingId)
      .forEach((r) => delete state.ratings[r.id]);
    delete state.readings[readingId];
  });
}

export function progressPercent(reading, book) {
  if (!book?.pages) return 0;
  return Math.min(100, Math.round((reading.currentPage / book.pages) * 100));
}
