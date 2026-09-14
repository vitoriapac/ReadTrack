import test from "node:test";
import assert from "node:assert/strict";
const memory={raw:null,fail:false,getItem(){return this.raw;},setItem(k,v){if(this.fail)throw Error("quota");this.raw=v;}};
globalThis.localStorage=memory;
const {store}=await import("../js/storage/storage.js");
const {emptyState,migrate}=await import("../js/storage/migrations.js");
const {createBook,deleteBook,bookDeletionSummary}=await import("../js/domain/books.js");
const {startReading,logProgress,completeReading}=await import("../js/domain/readings.js");
const {createAnnotation,updateAnnotation}=await import("../js/domain/annotations.js");
const {computePeriodStats}=await import("../js/services/statistics.js");
const {goalProgress,createGoal,updateGoal}=await import("../js/services/goals.js");
const {projectGoal,predictFinish}=await import("../js/services/projections.js");
const {readingStreak}=await import("../js/services/reading-calendar.js");
const {demoState}=await import("../js/services/demo.js");
const {profileStats,recommendations,abandonmentStats}=await import("../js/services/analysis.js");
const {prepareBackup,restorePreparedBackup}=await import("../js/storage/backup.js");
function setup(){memory.fail=false;store.replaceAll(emptyState());const b=createBook({title:"Livro",authorName:"Autor",pages:200});return {b,r:startReading(b.id,{startedAt:"2026-01-01"})};}
test("páginas por sessão incluem leitura aberta e conclusão fora do período",()=>{
 const {r}=setup();logProgress(r.id,{currentPage:40,date:"2026-01-02"});
 assert.equal(computePeriodStats(store.getState(),{from:"2026-01-01",to:"2026-01-31"}).pagesRead,40);
 completeReading(r.id,{finishedAt:"2026-02-01"});
 const s=computePeriodStats(store.getState(),{from:"2026-01-01",to:"2026-01-31"});assert.equal(s.pagesRead,40);assert.equal(s.booksCompleted,0);assert.equal(s.readingDays,1);
});
test("cinco tipos de metas usam métricas corretas e não incluem futuro",()=>{
 const {r}=setup();completeReading(r.id,{finishedAt:"2026-01-03"});
 for(const [type,expected] of Object.entries({books:1,pages:200,authors:1,newAuthors:1,readingDays:1})){
 const goal={type,target:300,startDate:"2026-01-01",endDate:"2026-12-31",filters:{}};
 assert.equal(goalProgress(goal,store.getState(),"2026-01-04").current,expected);
 assert.equal(goalProgress(goal,store.getState(),"2026-01-02").current,0);
 }
});
test("meta filtrada não transforma autor antigo em novo",()=>{
 const {r}=setup();completeReading(r.id,{finishedAt:"2026-01-02"});
 const b=createBook({title:"Outro",authorName:"Autor",pages:300,primaryGenre:"Fantasia"});const next=startReading(b.id,{startedAt:"2026-02-01"});completeReading(next.id,{finishedAt:"2026-02-02"});
 assert.equal(goalProgress({type:"newAuthors",target:3,startDate:"2026-02-01",endDate:"2026-02-28",filters:{genre:"Fantasia"}},store.getState(),"2026-03-01").current,0);
});
test("metas rejeitam filtro inválido e falha de gravação reverte edição",()=>{
 setup();const g=createGoal({type:"books",target:12,startDate:"2026-01-01",endDate:"2026-12-31"});const before=store.exportJSON();
 assert.throws(()=>updateGoal(g.id,{target:3,filters:{unknown:true}}));assert.equal(store.exportJSON(),before);
 memory.fail=true;assert.throws(()=>updateGoal(g.id,{target:20}));memory.fail=false;assert.equal(store.exportJSON(),before);
});
test("projeções respeitam início, fim e dias inclusivos",()=>{
 const {r}=setup();completeReading(r.id,{finishedAt:"2026-01-03"});const goal={type:"books",target:10,startDate:"2026-01-01",endDate:"2026-01-10",filters:{}};
 assert.equal(projectGoal(goal,store.getState(),"2025-12-31").projection,null);
 const ended=projectGoal(goal,store.getState(),"2026-02-01");assert.equal(ended.projection,1);assert.equal(ended.remainingDays,0);
});
test("previsão precisa de três dias recentes e inclui intervalos sem leitura",()=>{
 const {r}=setup();for(let i=1;i<=3;i++)logProgress(r.id,{currentPage:i*20,date:`2026-01-0${i}`});
 const p=predictFinish(store.getState(),store.getState().readings[r.id],"2026-01-06");assert.equal(p.perDay,10);assert.equal(p.days,14);
 assert.equal(predictFinish(store.getState(),r,"2026-03-01"),null);
});
test("abandono legado migra sem inventar data em v1/v2/v3",()=>{
 const {b,r}=setup();
 for(const version of [1,2,3]){
 const old=structuredClone(store.getState());old.meta.version=version;old.readings[r.id].status="abandoned";delete old.readings[r.id].abandonedAt;old.books[b.id].genre="Fantasia";delete old.books[b.id].primaryGenre;delete old.books[b.id].genres;
 const before=JSON.stringify(old),next=migrate(old);assert.equal(next.readings[r.id].abandonedAt,null);assert.equal(next.books[b.id].primaryGenre,"Fantasia");assert.equal(JSON.stringify(old),before);assert.deepEqual(migrate(next),next);
 const preview=prepareBackup(before);restorePreparedBackup(store,preview,store.exportJSON());assert.equal(abandonmentStats(store.getState()).unknownDates,1);
 }
});
test("exclusão inclui anotações na prévia, detecta mudança e remove em transação",()=>{
 const {b}=setup();const a=createAnnotation({bookId:b.id,text:"Citação <literal>",type:"quote",page:10});const preview=bookDeletionSummary(b.id);assert.equal(preview.annotations,1);
 updateAnnotation(a.id,{text:"Alteração",type:"note",page:11});assert.throws(()=>deleteBook(b.id,{expectedSnapshot:preview.snapshot}));
 const before=store.exportJSON();memory.fail=true;assert.throws(()=>deleteBook(b.id));memory.fail=false;assert.equal(store.exportJSON(),before);deleteBook(b.id);assert.equal(Object.keys(store.getState().annotations).length,0);
});
test("sequência considera ontem e ignora registros futuros",()=>{
 const state=emptyState();for(const [i,date] of ["2026-02-27","2026-02-28","2026-03-01","2026-12-01"].entries())state.sessions[i]={date,type:"reading",pagesRead:1};
 assert.deepEqual(readingStreak(state,"2026-03-02"),{current:3,best:3});assert.equal(readingStreak(state,"2026-03-03").current,0);
});
test("demo válido com 40 livros, 28 autores e 350 sessões não altera biblioteca",()=>{
 setup();const before=store.exportJSON();const demo=demoState("2026-09-14");assert.deepEqual(migrate(demo),demo);assert.equal(Object.keys(demo.books).length,40);assert.equal(Object.keys(demo.authors).length,28);assert.equal(Object.keys(demo.sessions).length,350);assert.equal(Object.values(demo.readings).filter(r=>r.status==="completed").length,32);assert.ok(Object.values(demo.sessions).every(s=>s.date<="2026-09-14"));assert.equal(store.exportJSON(),before);
});
test("perfil exige tempo e livros distintos; recomendação exclui arquivos",()=>{
 const {r}=setup();completeReading(r.id,{finishedAt:"2026-01-02"});assert.equal(profileStats(store.getState()).ready,false);
 const demo=demoState("2026-09-14");assert.ok(profileStats(demo).ready);assert.ok(recommendations(demo).every(s=>!s.book.archivedAt));
});

test("CSV trata aspas, quebras, duplicados e importação atômica",async()=>{
 const {parseCSV,prepareCatalogImport,commitCatalogImport}=await import("../js/services/imports.js");setup();
 const csv='Title,Author,Number of Pages\n"Título, com vírgula","Autor\nNovo",120\nDuplicado,Autor,200\nDuplicado,Autor,200';
 assert.equal(parseCSV(csv)[0].author,"Autor\nNovo");const prepared=prepareCatalogImport(csv);assert.equal(prepared.items.length,2);assert.equal(prepared.issues.length,1);
 const before=store.exportJSON();memory.fail=true;assert.throws(()=>commitCatalogImport(prepared,before));memory.fail=false;assert.equal(store.exportJSON(),before);
 commitCatalogImport(prepared,before);assert.equal(Object.keys(store.getState().books).length,3);assert.throws(()=>commitCatalogImport(prepared,before),/mudou/);
 assert.throws(()=>parseCSV('title,author,pages\n"Não fechou,A,10'));
});
test("ISBN interpreta metadados e reporta consulta vazia",async()=>{
 const {lookupISBN}=await import("../js/services/isbn.js");
 const result=await lookupISBN("978-0-9802004-4-7",async()=>({ok:true,json:async()=>({"ISBN:9780980200447":{title:"Livro",authors:[{name:"Autor"}],number_of_pages:200,publish_date:"June 2008"}})}));
 assert.equal(result.year,"2008");assert.equal(result.pages,200);
 await assert.rejects(()=>lookupISBN("9780980200447",async()=>({ok:true,json:async()=>({})})),/não encontrado/);
});
