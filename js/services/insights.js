import { computePeriodStats } from "./statistics.js";
export function buildInsights(state) {
  const all = Object.values(state.readings), completed = all.filter(r => r.status === "completed"), abandoned = all.filter(r => r.status === "abandoned");
  if (completed.length < 3) return ["Registre pelo menos três leituras concluídas para liberar insights confiáveis."];
  const stats = computePeriodStats(state, { from: "0000-01-01", to: "9999-12-31" }), insights = [];
  if (stats.newAuthors && stats.distinctAuthors) insights.push(`${Math.round(stats.newAuthors / stats.distinctAuthors * 100)}% dos seus autores foram descobertos recentemente.`);
  if (abandoned.length && abandoned.length / Math.max(1, all.filter(r => r.status !== "want_to_read").length) >= .2) insights.push("Sua taxa de abandono está acima de 20%; talvez valha revisar o tamanho ou os gêneros escolhidos.");
  const genre = Object.entries(stats.genres).sort((a,b) => b[1]-a[1])[0]; if (genre) insights.push(`${genre[0]} é o gênero mais recorrente no seu histórico.`);
  return insights;
}
