import { store } from "../storage/storage.js";
import { createBook } from "../domain/books.js";
import { addToWantToRead } from "../domain/readings.js";
import { requireValue } from "../utils/validation.js";
export function parseCSV(text) {
  requireValue(typeof text === "string" && text.length <= 2000000,"O CSV deve ter até 2 MB.");
  text=text.replace(/^\uFEFF/,"");
  const first=text.split(/\r?\n/)[0], delimiter=first.includes(";")&&!first.includes(",")?";":",";
  const rows=[];let row=[],cell="",quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c==='"'){requireValue(!cell&&!closed,"Aspas fora de posição no CSV.");quoted=true;}
    else if(c===delimiter){row.push(cell);cell="";closed=false;}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell="";closed=false;}
    else{requireValue(!closed||/\s/.test(c),"Conteúdo após fechamento de aspas.");if(!closed)cell+=c;}
  }
  requireValue(!quoted,"Campo CSV com aspas não fechadas.");row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  requireValue(rows.length>1&&rows.length<=1001,"Informe cabeçalho e até 1.000 livros.");
  const headers=rows.shift().map(h=>h.trim().toLowerCase());
  requireValue(new Set(headers).size===headers.length,"Cabeçalhos duplicados.");
  return rows.map((row,index)=>{requireValue(row.length===headers.length,`Linha ${index+2}: número de colunas inválido.`);return Object.fromEntries(headers.map((h,i)=>[h,row[i].trim()]));});
}
const normalize=value=>String(value||"").trim().toLocaleLowerCase("pt-BR");
function identity(book,state) {return normalize(book.title)+"|"+normalize(book.authorName || book.authorIds.map(id=>state.authors[id].name).join(", "));}
export function prepareCatalogImport(text,state=store.getState()) {
  const rows=parseCSV(text),items=[],issues=[];
  const identities=new Set(Object.values(state.books).map(b=>identity(b,state))),isbns=new Set(Object.values(state.books).map(b=>b.isbn).filter(Boolean));
  rows.forEach((row,index)=>{
    const isbn=(row.isbn13||row.isbn||"").replace(/^="(.*)"$/,"$1").replace(/[\s-]/g,"");
    const item={title:row.title||row["título"],authorName:row.author||row.autor,pages:Number(row.pages||row["number of pages"]||row["páginas"]),isbn,publisher:row.publisher||row.editora||"",primaryGenre:row.genre||row["gênero"]||"Outro",year:row["year published"]||row.year||""};
    let problem=!item.title||!item.authorName?"título e autor são obrigatórios":!Number.isSafeInteger(item.pages)||item.pages<=0?"total de páginas ausente ou inválido":null;
    if(!problem&&(identities.has(identity(item,state))||isbn&&isbns.has(isbn)))problem="livro já cadastrado ou duplicado no arquivo";
    if(problem)issues.push({line:index+2,reason:problem});else {items.push(item);identities.add(identity(item,state));if(isbn)isbns.add(isbn);}
  });
  return {items,issues,total:rows.length};
}
export function commitCatalogImport(prepared,expectedJSON) {
  requireValue(store.exportJSON()===expectedJSON,"A biblioteca mudou. Abra a prévia novamente.");
  requireValue(prepared.items.length>0,"Não há livros válidos para importar.");
  store.mutate(()=>{for(const item of prepared.items){const book=createBook(item);addToWantToRead(book.id);}});
}
