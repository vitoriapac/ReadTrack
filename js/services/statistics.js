import { listBooks, getBook } from "../domain/books.js";
import { listReadings, STATUS } from "../domain/readings.js";
import { ratingForReading } from "../domain/ratings.js";
import { store } from "../storage/storage.js";
import { readingVolume } from "./history.js";

/** KPIs simples de todo o histórico (a base para metas/projeções virá depois). */
export function computeOverviewStats() {
  const completed = listReadings().filter((r) => r.status === STATUS.COMPLETED);

  const { pagesRead, undatedPages } = readingVolume(store.getState());

  const authorIds = new Set();
  completed.forEach((r) => {
    const book = getBook(r.bookId);
    (book?.authorIds || []).forEach((id) => authorIds.add(id));
  });

  const ratings = completed
    .map((r) => ratingForReading(r.id)?.overall)
    .filter((v) => typeof v === "number");
  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : null;

  return {
    booksCompleted: completed.length,
    pagesRead,
    undatedPages,
    distinctAuthors: authorIds.size,
    avgRating,
    totalBooksInLibrary: listBooks().length,
  };
}
