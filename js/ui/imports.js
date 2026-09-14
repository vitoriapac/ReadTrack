import { prepareCatalogImport, commitCatalogImport } from "../services/imports.js";
import { store } from "../storage/storage.js";
import { escapeHTML as esc } from "../utils/html.js";
import { openModal,closeModal } from "./dialog.js";
export function openCatalogImport() {
  openModal({title:"Importar catálogo CSV",bodyHTML:'<p>Compatível com catálogo Goodreads e CSV com title, author, pages (ou título, autor, páginas). Livros válidos serão adicionados a Quero ler. Datas, avaliações e histórico de leitura do arquivo não são importados.</p><div class="field"><label for="catalog-file">Arquivo CSV (até 2 MB)</label><input id="catalog-file" type="file" accept=".csv,text/csv" /></div><div id="catalog-preview"></div><p role="alert" id="catalog-error"></p>',footHTML:'<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" id="catalog-confirm" disabled>Importar livros válidos</button>',onMount(el){
    let prepared=null,expected=null;
    const confirm=el.querySelector("#catalog-confirm"),preview=el.querySelector("#catalog-preview");
    el.querySelector("#catalog-file").addEventListener("change",async event=>{
      confirm.disabled=true;prepared=null;preview.innerHTML="";
      try{const file=event.target.files[0];if(!file)return;if(file.size>2000000)throw Error("O arquivo deve ter até 2 MB.");const text=await file.text();expected=store.exportJSON();prepared=prepareCatalogImport(text);preview.innerHTML=`<p>${prepared.items.length} livros novos; ${prepared.issues.length} linhas ignoradas.</p><ul>${prepared.items.slice(0,20).map(b=>`<li>${esc(b.title)} — ${esc(b.authorName)} (${b.pages} páginas)</li>`).join("")}</ul>${prepared.items.length>20?"<p>Mostrando os primeiros 20 livros.</p>":""}<ul>${prepared.issues.map(i=>`<li>Linha ${i.line}: ${esc(i.reason)}</li>`).join("")}</ul><label><input type="checkbox" id="catalog-consent" /> Confirmo a importação dos livros válidos para Quero ler.</label>`;el.querySelector("#catalog-consent").addEventListener("change",e=>{confirm.disabled=!e.target.checked||!prepared.items.length;});}
      catch(error){el.querySelector("#catalog-error").textContent=error.message;}
    });
    confirm.addEventListener("click",()=>{try{commitCatalogImport(prepared,expected);closeModal();}catch(error){el.querySelector("#catalog-error").textContent=error.message;}});
  }});
}
