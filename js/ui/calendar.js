import { readingCalendar, readingStreak } from "../services/reading-calendar.js";
import { store } from "../storage/storage.js";
import { todayISO } from "../utils/dates.js";
let month = todayISO().slice(0,7);
export function renderCalendarPage(container) {
  const state=store.getState(),days=readingCalendar(state),streak=readingStreak(state);
  const selected=days.filter(d=>d.date.startsWith(month));
  const timed=Object.values(state.sessions).filter(s=>s.type==="reading"&&s.date.startsWith(month)&&s.duration>0);
  const minutes=timed.reduce((n,s)=>n+s.duration,0),timedPages=timed.reduce((n,s)=>n+s.pagesRead,0);
  const [year,m]=month.split("-").map(Number),count=new Date(Date.UTC(year,m,0)).getUTCDate();
  const offset=(new Date(month+"-01T00:00:00Z").getUTCDay()+6)%7;
  const map=new Map(selected.map(d=>[Number(d.date.slice(-2)),d]));
  container.innerHTML=`<h1>Calendário de leitura</h1><div class="field"><label for="calendar-month">Mês</label><input id="calendar-month" type="month" value="${month}" /></div><div class="kpi-grid">${Object.entries({"Sequência atual":streak.current,"Maior sequência":streak.best,"Dias ativos no mês":selected.length,"Horas registradas":(minutes/60).toFixed(1)}).map(([label,value])=>`<div class="kpi-card"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div></div>`).join("")}</div><p>Sequência atual inclui ontem enquanto o dia de hoje está aberto. Ritmo nas sessões com duração: ${minutes ? (timedPages/minutes*60).toFixed(1)+" páginas/hora" : "tempo insuficiente"}.</p><section class="card"><h2>${month}</h2><div class="calendar-grid">${["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d=>`<strong>${d}</strong>`).join("")}${Array.from({length:offset},()=>"<span></span>").join("")}${Array.from({length:count},(_,i)=>{const d=map.get(i+1);return `<div class="calendar-day ${d?"has-reading":""}" aria-label="Dia ${i+1}: ${d?.pages||0} páginas"><strong>${i+1}</strong><small>${d?d.pages+" pág.":"—"}</small></div>`;}).join("")}</div></section><section class="card"><h2>Registros do mês</h2>${selected.slice().reverse().map(d=>`<p>${d.date} · ${d.pages} páginas · ${d.sessions} sessões · ${d.minutes} minutos registrados</p>`).join("")||"<p>Sem sessões nesse mês.</p>"}</section>`;
  container.querySelector("#calendar-month").addEventListener("change",event=>{if(/^\\d{4}-\\d{2}$/.test(event.target.value)){month=event.target.value;renderCalendarPage(container);}});
}
