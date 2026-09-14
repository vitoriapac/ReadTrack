import { requireValue } from "../utils/validation.js";
export async function lookupISBN(value, request=fetch) {
  const isbn=value.replace(/[\s-]/g,"").toUpperCase();
  requireValue(/^(\d{9}[\dX]|\d{13})$/.test(isbn),"Informe um ISBN de 10 ou 13 caracteres.");
  const response=await request(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,{signal:AbortSignal.timeout(12000)});
  requireValue(response.ok,"A consulta está indisponível. Tente novamente mais tarde.");
  const json=await response.json(),book=json[`ISBN:${isbn}`];
  requireValue(book&&typeof book.title==="string","ISBN não encontrado.");
  return {isbn,title:book.title,authorName:(book.authors||[]).map(a=>a.name).filter(n=>typeof n==="string").join(", "),publisher:(book.publishers||[]).map(p=>p.name).filter(n=>typeof n==="string").join(", "),pages:Number.isSafeInteger(book.number_of_pages)?book.number_of_pages:"",year:/\b\d{4}\b/.exec(book.publish_date||"")?.[0]||""};
}
