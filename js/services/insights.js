import { computePeriodStats } from "./statistics.js";
import { profileStats, abandonmentStats } from "./analysis.js";
import { periodFor, previousPeriod } from "./periods.js";
export function buildInsights(state, period = periodFor("year")) {
  const stats = computePeriodStats(state, period), profile = profileStats(state, period);
  const insights = [];
  if (stats.distinctAuthors >= 3) insights.push(`${Math.round(stats.newAuthors / stats.distinctAuthors * 100)}% dos autores concluídos no período foram lidos pela primeira vez nesse período.`);
  if (profile.ready && profile.dominantGenre) insights.push(`${profile.dominantGenre} é o gênero predominante, com amostra mínima de 3 livros distintos.`);
  if (profile.affinity) insights.push(`${profile.affinity.label} tem média ${profile.affinity.average.toFixed(1)} entre categorias com amostra suficiente.`);
  const prior = previousPeriod(period);
  if (prior) {
    const before = computePeriodStats(state, prior);
    if (before.readingDays >= 3 && stats.readingDays >= 3 && before.pagesRead > 0) insights.push(`O volume variou ${Math.round((stats.pagesRead/before.pagesRead-1)*100)}% em relação ao intervalo anterior de mesma duração.`);
  }
  const abandonment = abandonmentStats(state, period);
  if (abandonment.ended >= 5) insights.push(`${abandonment.rate}% das leituras encerradas no período foram abandonadas (amostra: ${abandonment.ended}).`);
  return insights.length ? insights : ["Continue registrando leituras para obter análises com amostra suficiente."];
}
