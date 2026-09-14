# Plano priorizado de conclusão

O roadmap anterior contém implementações parciais. Cada etapa só é concluída após validação dos comportamentos, além dos testes antigos.

1. **P0 — Confiabilidade:** corrigir métricas por data da sessão, metas zeradas por mapeamento incorreto, migração de abandonos sem data, exclusão de livros com anotações e escape de textos nas telas novas.
2. **P1 — Fluxos completos:** filtros reutilizáveis de período; metas com formulário, edição e exclusão; rankings e detalhes de autores; distribuições e comparações temporais.
3. **P2 — Análise pessoal:** projeções com data de referência, previsão de término, abandono, perfil com amostra mínima, insights e retrospectivas visíveis, sugestões da fila e séries.
4. **P3 — Registro diário:** anotações e citações pesquisáveis nos detalhes, tempo e sequências corretas, dados demo isolados e testes específicos.
5. **P4 — Integrações:** importação CSV com prévia e confirmação, consulta ISBN com prévia, impressão/exportação de relatórios.

## Critérios

- Páginas e dias vêm de sessões de todas as leituras, inclusive em andamento e abandonadas. Saldos sem data não entram em recortes temporais.
- Livros/autores/notas usam a data de conclusão; autores novos usam a primeira conclusão no histórico completo.
- Não inventar datas de abandono antigas. Mostrar ausência de data explicitamente.
- Projeções não incluem registros posteriores à data de referência e não prometem precisão com amostra insuficiente.
- Análises e demonstração não gravam na biblioteca real.
- Toda entrada textual renderizada deve ser escapada; falhas de persistência não deixam operações parciais.

## Validação

Testes focados em migrações, integridade referencial, períodos, progresso das metas, previsões, limites de confiança e preservação de dados. Conferência das interfaces após os testes.

## Resultado da implementação

- Etapas 1–4 implementadas: correções de consistência; período/metas/autores; análises e recomendações conectadas; calendário e anotações com interface e cronômetro.
- Etapa 5: consulta ISBN com prévia, importação de **catálogo** CSV com confirmação e impressão para salvar PDF implementadas. Importação do histórico e avaliações do Goodreads e geração direta de PDF permanecem como extensões específicas.
- 50 testes, incluindo 13 regressões novas para métricas, metas, migrações, projeções, exclusão com anotações, sequências, demo, CSV e ISBN.
- Conferência visual em desktop e 390px: formulário de metas, página do autor, anotação nos detalhes e calendário mensal. ISBN validado com respostas simuladas; disponibilidade externa não garantida.
