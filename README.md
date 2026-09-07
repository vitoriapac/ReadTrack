# ReadTrack

Aplicação estática em português para acompanhar livros, releituras, progresso e avaliações. Usa módulos JavaScript nativos, CSS e localStorage; não precisa de compilação nem de dependências npm.

## Executar

Sirva esta pasta com um servidor HTTP estático, por exemplo com a extensão Live Server do editor. Com Python instalado, execute `python -m http.server 8080 --bind 127.0.0.1` e abra `http://127.0.0.1:8080`. Abrir o HTML diretamente via `file://` não é o fluxo suportado para módulos ES.

Mantenha o mesmo endereço e porta: o navegador separa os dados por origem. Fontes são carregadas do Google Fonts, e capas das URLs informadas; as informações da biblioteca são gravadas localmente.

## Verificar

Com Node.js 20 ou superior, execute `node --test` (ou `npm test`; no PowerShell com restrição a scripts, `npm.cmd test`). Não é necessário instalar pacotes.

Os testes cobrem transações, falhas de persistência, dados corrompidos, conflito entre abas, validação, migração, progresso, conclusão, avaliação, releitura, exclusão em cascata e escape de HTML.

## Organização

- `js/app.js`: navegação por hash, estrutura da aplicação e backup.
- `js/ui/`: páginas, modais e notificações.
- `js/domain/`: regras de livros, autores, leituras, sessões e avaliações.
- `js/storage/`: estado, transações e validação de backups versionados.
- `js/services/`: indicadores.
- `js/utils/`: datas, formatação, validação e escape de texto.
- `styles/`: tokens, base, layout, componentes e ajustes por página.

Operações compostas compartilham um rascunho e gravam uma única vez. Se uma validação ou gravação falhar, o estado anterior permanece. A interface é notificada após a gravação. O domínio ainda usa um armazenamento global; a classe Store aceita uma persistência injetável para testes.

## Dados e backup

Use **Exportar backup** regularmente. **Restaurar backup** valida o JSON e substitui a biblioteca após confirmação. Não há sincronização em nuvem. Limpar os dados do navegador remove a biblioteca.

Dados ilegíveis bloqueiam novas gravações para evitar sobrescrita silenciosa. O botão de exportação preserva o conteúdo original disponível; restaure uma cópia válida para recuperar a aplicação. Backups de versões futuras são rejeitados. Alterações detectadas em outra aba exigem recarregamento antes de salvar; isso não constitui sincronização nem bloqueio distribuído entre abas.

## Definição dos indicadores

- **Leituras concluídas**: conta conclusões; reler o mesmo livro conta novamente.
- **Páginas lidas**: soma do volume efetivo das sessões mais o saldo histórico sem data conhecida. Correções recalculam o volume original; retornos de posição não descontam páginas.
- **Autores lidos**: autores distintos das leituras concluídas.
- **Avaliação média**: média das notas das leituras concluídas com avaliação.

Concluir uma leitura registra as páginas restantes como uma sessão na data de conclusão. Consultas por período usam as datas reais das sessões e excluem saldos sem data, apresentados separadamente.

## Histórico e correções (esquema v2)

Na biblioteca, abra **Mais ações → Histórico e correções** para consultar leituras, sessões, notas e auditoria.

- **Corrigir registro** altera página final e/ou data com motivo obrigatório. Os valores anteriores e posteriores ficam vinculados à sessão em `revisions`. Corrigir 120→160 para 120→145 reduz o volume de 40 para 25 no período original.
- A posição só acompanha a correção do último registro de uma leitura em andamento ou pausada. Registros antigos não reescrevem posições posteriores, e leituras encerradas não são reabertas.
- **Voltar para reler** muda a posição sem descontar páginas. O trecho relido conta quando um novo progresso é registrado.
- Datas retroativas são aceitas desde o início da leitura. A data determina o período; a posição avança na ordem dos lançamentos (`sequence`). Não duplique uma sessão existente: corrija o registro. A conclusão não pode anteceder nenhuma sessão.

A migração v1→v2 preserva sessões e converte diferenças positivas do progresso antigo em saldo `balance`, sem inventar datas. O saldo mantém o total histórico, mas não conta em períodos filtrados ou dias de leitura. Sessões antigas que excedam o progresso causam rejeição da migração, preservando o original.

Transformações ficam em `js/storage/migrations.js` e validações em `schema.js`. A migração no carregamento é feita em memória e persistida na próxima operação salva. Backups novos usam v3; versões antigas do aplicativo não podem abri-los.

## Detalhes do livro e arquivamento (esquema v3)

Clique no título de um livro na biblioteca ou em Lendo agora para abrir `#/livro/{id}`. O endereço funciona diretamente e após recarregar. A página mostra metadados, situação atual, histórico por leitura, sessões, notas e avaliações. Avaliações antigas continuam consultáveis e editáveis durante uma releitura. Correções e retornos podem ser feitos na própria página. Endereços inexistentes mostram uma mensagem com retorno à biblioteca.

Os filtros **Ativos** e **Arquivados** separam a visibilidade da biblioteca. **Arquivar livro** mantém leituras, sessões, notas, correções, avaliações e indicadores. Uma leitura em andamento ou pausada precisa ser concluída ou abandonada primeiro. Livros em Quero ler podem ser arquivados, mas precisam ser restaurados antes de iniciar a leitura. **Restaurar livro** devolve o item à biblioteca ativa.

A migração v2→v3 adiciona `archivedAt: null` aos livros existentes. Livros arquivados e seu histórico continuam incluídos no backup. O domínio mantém `listBooks()` com todos os livros para consultas históricas e usa `listLibraryBooks()` para filtrar a visibilidade.

**Excluir permanentemente** apresenta quantidades de leituras, sessões/saldos e avaliações, além do impacto em páginas e conclusões. Oferece exportação de backup e, quando possível, arquivamento como alternativa principal. Exige confirmação explícita; se os registros mudarem desde a abertura, a exclusão é bloqueada até revisar novamente. Não há lixeira: recuperação depende de backup.

Biblioteca e detalhes retornam uma função de limpeza ao roteador. Listeners usam AbortController, incluindo os eventos globais do menu, e são removidos a cada nova renderização ou saída de página. Ações de leitura e renderização de sessões são compartilhadas entre as telas.

## Prévia da restauração

O arquivo é validado e migrado antes da confirmação. A prévia mostra versões, quantidades e saldo sem data; permite exportar a biblioteca atual e exige consentimento explícito para substituí-la. Cancelar não modifica dados. Uma prévia fica inválida se a biblioteca mudar antes de confirmar. Falhas de gravação mantêm o estado anterior.

## Limites atuais

A página ainda é renderizada integralmente nas atualizações. O armazenamento é síncrono e destinado a bibliotecas pessoais pequenas. A validação de importação rejeita dados inconsistentes, em vez de tentar repará-los automaticamente. Futuras mudanças de esquema devem adicionar passos explícitos em `migrations.js` e testes com backups anteriores.
