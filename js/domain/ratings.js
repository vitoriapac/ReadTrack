import { store } from "../storage/storage.js";
import { createId } from "../utils/ids.js";
import { linkRating } from "./readings.js";

export function getRating(id) {
  return store.getState().ratings[id] || null;
}

export function ratingForReading(readingId) {
  const reading = store.getState().readings[readingId];
  if (!reading?.ratingId) return null;
  return getRating(reading.ratingId);
}

/**
 * Cria ou atualiza a avaliação de uma leitura.
 * Só a nota geral é obrigatória — o resto é opcional.
 */
export function saveRating(readingId, { overall, favorite = false, review = "" }) {
  const existing = ratingForReading(readingId);

  if (existing) {
    store.mutate((state) => {
      const r = state.ratings[existing.id];
      r.overall = overall;
      r.favorite = favorite;
      r.review = review;
      r.updatedAt = new Date().toISOString();
    });
    return existing;
  }

  const rating = {
    id: createId("rt"),
    readingId,
    overall: Number(overall),
    favorite: !!favorite,
    review: review || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.mutate((state) => { state.ratings[rating.id] = rating; });
  linkRating(readingId, rating.id);
  return rating;
}
