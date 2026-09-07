import { validDate, requireValue } from "../utils/validation.js";

// Pure queries: a correction changes its original session, not today's volume.
export function readingVolume(state, { from = null, to = null, readingId = null } = {}) {
  if (from) validDate(from);
  if (to) validDate(to, from);
  let datedPages = 0, undatedPages = 0;
  const days = new Set();
  for (const session of Object.values(state.sessions)) {
    if (readingId && session.readingId !== readingId) continue;
    if (session.type === "balance") { undatedPages += session.pagesRead; continue; }
    if (session.type !== "reading" || (from && session.date < from) || (to && session.date > to)) continue;
    datedPages += session.pagesRead;
    if (session.pagesRead > 0) days.add(session.date);
  }
  return { pagesRead: datedPages + (!from && !to ? undatedPages : 0), datedPages, undatedPages, readingDays: days.size };
}

export function nextSequence(state, readingId) {
  return Math.max(0, ...Object.values(state.sessions).filter(s => s.readingId === readingId).map(s => s.sequence)) + 1;
}

export function sessionDate(date, reading) {
  validDate(date, reading.startedAt);
  requireValue(!reading.finishedAt || date <= reading.finishedAt, "A data não pode ser posterior à conclusão.");
}
