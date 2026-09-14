import { computePeriodStats } from "./statistics.js";
import { dayNumber, shiftDay } from "./periods.js";
import { todayISO } from "../utils/dates.js";
import { goalProgress } from "./goals.js";
export const inPeriod = (date, { from = null, to = null } = {}) => Boolean(date) && (!from || date >= from) && (!to || date <= to);
export const sizeBand = pages => pages < 200 ? "<200" : pages < 300 ? "200–299" : pages < 400 ? "300–399" : pages < 500 ? "400–499" : pages < 700 ? "500–699" : "700+";
export function authorStats(state, period = {}) {
  return Object.values(state.authors).map(author => {
    const books = Object.values(state.books).filter(b => b.authorIds.includes(author.id));
    const ids = new Set(books.map(b => b.id));
    const all = Object.values(state.readings).filter(r => ids.has(r.bookId) && r.status === "completed").sort((a,b) => a.finishedAt.localeCompare(b.finishedAt));
    const readings = all.filter(r => inPeriod(r.finishedAt, period));
    const ratings = readings.map(r => state.ratings[r.ratingId]?.overall).filter(Number.isFinite);
    const sessions = Object.values(state.sessions).filter(s => s.type === "reading" && ids.has(state.readings[s.readingId]?.bookId) && inPeriod(s.date, period));
    return { ...author, books, readings, count: readings.length, pages: sessions.reduce((n,s) => n + s.pagesRead, 0), ratings: ratings.length, average: ratings.length ? ratings.reduce((a,b) => a+b,0)/ratings.length : null, first: all[0]?.finishedAt || null, last: all.at(-1)?.finishedAt || null, isNew: inPeriod(all[0]?.finishedAt, period) };
  }).sort((a,b) => b.count-a.count || b.pages-a.pages || a.name.localeCompare(b.name));
}
export function abandonmentStats(state, period = {}) {
  const ended = Object.values(state.readings).filter(r => r.status === "completed" && inPeriod(r.finishedAt, period) || r.status === "abandoned" && (inPeriod(r.abandonedAt?.slice(0,10), period) || !period.from && !period.to));
  const abandoned = ended.filter(r => r.status === "abandoned");
  function groups(key) {
    const groups = new Map();
    ended.forEach(r => {
      const b = state.books[r.bookId];
      const value = key === "genre" ? b.primaryGenre : key === "size" ? sizeBand(b.pages) : b.format;
      const item = groups.get(value) || { label: value || "Não informado", ended: 0, abandoned: 0 };
      item.ended++; if (r.status === "abandoned") item.abandoned++;
      groups.set(value, item);
    });
    return [...groups.values()].map(g => ({ ...g, rate: g.ended >= 5 ? Math.round(g.abandoned/g.ended*100) : null }));
  }
  const reasons = new Map();
  abandoned.forEach(r => reasons.set(r.abandonReason || "Não informado", (reasons.get(r.abandonReason || "Não informado") || 0)+1));
  return { count: abandoned.length, ended: ended.length, rate: ended.length ? Math.round(abandoned.length/ended.length*100) : null, unknownDates: Object.values(state.readings).filter(r => r.status === "abandoned" && !r.abandonedAt).length, reasons: Object.fromEntries(reasons), genres: groups("genre"), sizes: groups("size"), formats: groups("format") };
}
export function profileStats(state, period = {}) {
  const completed = Object.values(state.readings).filter(r => r.status === "completed" && inPeriod(r.finishedAt, period));
  const dates = completed.flatMap(r => [r.startedAt,r.finishedAt]).filter(Boolean).sort();
  const span = dates.length ? dayNumber(dates.at(-1))-dayNumber(dates[0]) : 0;
  const ready = completed.length >= 5 && span >= 60;
  function categories(getKey) {
    const map = new Map();
    completed.forEach(r => {
      const b = state.books[r.bookId], key = getKey(b);
      const item = map.get(key) || { label: key, ids: new Set(), ratings: [] };
      item.ids.add(b.id);
      const rating = state.ratings[r.ratingId];
      if (rating) item.ratings.push(rating.overall);
      map.set(key,item);
    });
    return [...map.values()].filter(g => g.ids.size >= 3).map(g => ({ label: g.label, count: g.ids.size, average: g.ratings.length >= 3 ? g.ratings.reduce((a,b)=>a+b,0)/g.ratings.length : null })).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label));
  }
  const genres = categories(b => b.primaryGenre || "Outro"), sizes = categories(b => sizeBand(b.pages));
  const affinity = genres.filter(g=>g.average != null).sort((a,b)=>b.average-a.average || b.count-a.count)[0];
  return { ready, count: completed.length, span, dominantGenre: ready ? genres[0]?.label : null, sizeRange: ready ? sizes[0]?.label : null, affinity: ready ? affinity : null, message: "São necessárias 5 conclusões, 60 dias de histórico e 3 livros distintos por categoria." };
}
export function seriesStats(state) {
  const groups = new Map();
  Object.values(state.books).filter(b => b.series?.trim()).forEach(b => {
    const key = b.series.trim().toLocaleLowerCase("pt-BR");
    if (!groups.has(key)) groups.set(key,{ name:b.series.trim(), books:[] });
    const readings = Object.values(state.readings).filter(r=>r.bookId===b.id);
    const completed = readings.some(r=>r.status==="completed");
    const active = readings.find(r=>["reading","paused","want_to_read"].includes(r.status));
    groups.get(key).books.push({ ...b, completed, status: active?.status || (completed ? "completed" : "want_to_read") });
  });
  return [...groups.values()].map(g=>{
    g.books.sort((a,b)=>(a.seriesNumber??Infinity)-(b.seriesNumber??Infinity)||a.title.localeCompare(b.title));
    g.completed=g.books.filter(b=>b.completed).length;
    g.next=g.books.find(b=>!b.completed&&!b.archivedAt)||null;
    return g;
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
export function recommendations(state, mode = "short", today = todayISO()) {
  const read = new Set(Object.values(state.readings).filter(r=>r.status==="completed"&&r.finishedAt<=today).flatMap(r=>state.books[r.bookId].authorIds));
  const queued = new Set(Object.values(state.readings).filter(r=>r.status==="want_to_read").map(r=>r.bookId));
  const profile = profileStats(state, {to:today});
  const series = seriesStats(state);
  return Object.values(state.books).filter(b=>queued.has(b.id)&&!b.archivedAt).map(book=>{
    const newAuthor = book.authorIds.length>0&&book.authorIds.every(id=>!read.has(id));
    const next = series.some(g=>g.completed>0&&g.next?.id===book.id);
    const goal = Object.values(state.goals||{}).find(g=>g.startDate<=today&&g.endDate>=today&&goalProgress(g,state,today).remaining>0&&(!g.filters?.genre||book.genres.includes(g.filters.genre))&&(!g.filters?.minPages||book.pages>=g.filters.minPages)&&(!["newAuthors","authors"].includes(g.type)||newAuthor));
    const eligible = mode==="newAuthor" ? newAuthor : mode==="series" ? next : mode==="affinity" ? profile.ready&&book.genres.includes(profile.affinity?.label||profile.dominantGenre) : mode==="outside" ? profile.ready&&!book.genres.includes(profile.dominantGenre) : mode==="goal" ? Boolean(goal) : true;
    return { book, eligible, reason: mode==="newAuthor" ? "Autor sem conclusão anterior." : mode==="series" ? "Próximo volume cadastrado ainda não concluído." : mode==="goal" ? "Compatível com uma meta no período atual." : mode==="affinity" ? "Gênero frequente ou bem avaliado no seu histórico." : mode==="outside" ? "Gênero diferente do predominante." : `${book.pages} páginas: opção curta da sua fila.` };
  }).filter(r=>r.eligible).sort((a,b)=>a.book.pages-b.book.pages||a.book.title.localeCompare(b.book.title)).slice(0,5);
}
export function retrospective(state, period) {
  const stats=computePeriodStats(state,period);
  const readings=Object.values(state.readings).filter(r=>r.status==="completed"&&inPeriod(r.finishedAt,period));
  const books=readings.map(r=>state.books[r.bookId]).sort((a,b)=>a.pages-b.pages);
  const rated=readings.filter(r=>state.ratings[r.ratingId]).sort((a,b)=>state.ratings[b.ratingId].overall-state.ratings[a.ratingId].overall);
  return {...stats, shortest:books[0]||null, longest:books.at(-1)||null, favorite:rated.length?state.books[rated[0].bookId]:null, rereads:readings.filter(r=>r.isReread).length};
}
export function calendarComparisons(state, today = todayISO()) {
  const [year,month]=today.split("-").map(Number);
  const monthStart=offset=>new Date(Date.UTC(year,month-1+offset,1)).toISOString().slice(0,10);
  const ranges=[
    {label:"Mês anterior × mês precedente",current:{from:monthStart(-1),to:shiftDay(monthStart(0),-1)},previous:{from:monthStart(-2),to:shiftDay(monthStart(-1),-1)}},
    {label:"Últimos 3 meses completos × 3 anteriores",current:{from:monthStart(-3),to:shiftDay(monthStart(0),-1)},previous:{from:monthStart(-6),to:shiftDay(monthStart(-3),-1)}},
    {label:"Ano atual × ano anterior (até o mesmo dia)",current:{from:`${year}-01-01`,to:today},previous:{from:`${year-1}-01-01`,to:today.slice(5)==="02-29"?`${year-1}-02-28`:`${year-1}${today.slice(4)}`}}
  ];
  return ranges.map(r=>({...r,a:computePeriodStats(state,r.current),b:computePeriodStats(state,r.previous)}));
}
export function genreEvolution(state) {
  const years=new Map();
  Object.values(state.readings).filter(r=>r.status==="completed").forEach(r=>{
    const year=r.finishedAt.slice(0,4),genre=state.books[r.bookId].primaryGenre||"Outro";
    const item=years.get(year)||{year,total:0,genres:new Map()};item.total++;item.genres.set(genre,(item.genres.get(genre)||0)+1);years.set(year,item);
  });
  return [...years.values()].sort((a,b)=>a.year.localeCompare(b.year)).map(y=>({year:y.year,total:y.total,genres:[...y.genres].map(([genre,count])=>({genre,count,percentage:Math.round(count/y.total*100)}))}));
}
