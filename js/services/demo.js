import { emptyState } from "../storage/migrations.js";
import { shiftDay } from "./periods.js";
import { todayISO } from "../utils/dates.js";
export function demoState(today = todayISO()) {
  const state=emptyState(), start=shiftDay(today,-364);
  const genres=["Ficção científica","Fantasia","Suspense","Romance","Clássico","Não ficção","Biografia","Autoajuda","História","Poesia","Quadrinhos","Outro"];
  const stamp=start+"T12:00:00Z";
  for(let i=0;i<28;i++) state.authors[`da_${i}`]={id:`da_${i}`,name:`Autor fictício ${i+1}`,createdAt:stamp,updatedAt:stamp};
  for(let i=0;i<40;i++) {
    const id=`db_${i}`;
    state.books[id]={id,title:`Livro demonstrativo ${i+1}`,authorIds:[`da_${i%28}`],pages:140+i*17,primaryGenre:genres[i%12],genres:[genres[i%12]],publicationYear:2000+i%26,format:["Físico","E-book","Audiobook"][i%3],language:"Português",series:i%4===0?"Coleção demonstrativa":null,seriesNumber:i%4===0?i/4+1:null,isbn:null,publisher:"Editora fictícia",cover:null,archivedAt:i<3?stamp:null,createdAt:stamp,updatedAt:stamp};
  }
  let serial=0,rated=0;
  function reading(bookIndex,status,reread=false) {
    const book=state.books[`db_${bookIndex}`],id=`dr_${serial++}`;
    const offset=reread?280+(bookIndex*8):bookIndex*8;
    const first=shiftDay(start,offset),last=shiftDay(first,15);
    const r={id,bookId:book.id,status,startedAt:status==="want_to_read"?null:first,finishedAt:status==="completed"?last:null,initialPage:0,currentPage:status==="completed"?book.pages:status==="abandoned"?Math.floor(book.pages*.3):0,ratingId:null,isReread:reread,abandonReason:status==="abandoned"?["Ritmo lento","Tema não interessou","Outro"][bookIndex%3]:null,abandonedAt:status==="abandoned"?last+"T12:00:00Z":null,createdAt:first+"T12:00:00Z",updatedAt:last+"T12:00:00Z"};
    state.readings[id]=r;
    const count=status==="completed"?10:status==="abandoned"?6:0;
    let position=0;
    for(let j=1;j<=count;j++) {
      const end=Math.floor(r.currentPage*j/count),sid=`ds_${id}_${j}`,date=shiftDay(first,Math.floor(j*15/count));
      state.sessions[sid]={id:sid,readingId:id,type:"reading",sequence:j,revisions:[],date,startPage:position,endPage:end,pagesRead:end-position,duration:15+j,notes:j===1?"Nota fictícia da demonstração.":"",createdAt:date+"T12:00:00Z"};position=end;
    }
    if(status==="completed"&&rated<30){const rid=`rating_${id}`;r.ratingId=rid;state.ratings[rid]={id:rid,readingId:id,overall:2+rated%4,review:"Resenha fictícia.",createdAt:last+"T12:00:00Z"};rated++;}
  }
  for(let i=0;i<40;i++) reading(i,i<28?"completed":i<33?"abandoned":"want_to_read");
  for(let i=3;i<7;i++) reading(i,"completed",true);
  return state;
}
