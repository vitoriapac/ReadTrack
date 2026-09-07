import { openStartReadingModal, openProgressModal, openCompleteFlow, openAbandonModal } from "./modals.js";
import { pauseReading, resumeReading } from "../domain/readings.js";
import { showToast } from "./toast.js";

export function performReadingAction(action, book, reading) {
  switch (action) {
    case "start": return openStartReadingModal(book, reading);
    case "reread": return openStartReadingModal(book, null);
    case "progress": return openProgressModal(book, reading);
    case "complete":
    case "rate": return openCompleteFlow(book, reading);
    case "abandon": return openAbandonModal(book, reading);
    case "pause": pauseReading(reading.id); showToast("Leitura pausada."); break;
    case "resume": resumeReading(reading.id); showToast("Leitura retomada."); break;
  }
}
