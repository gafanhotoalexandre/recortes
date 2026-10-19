# Revisão de pré-publicação

19/10/2026 · recortes. · revisão local, sem commit, push ou deploy.

Registro da revisão anterior. A pendência da roda de cores foi posteriormente encerrada por substituição original; consulte [ajustes finais](ajustes-finais.md) para o estado atual.

## Estado geral

**A preparação técnica local está aprovada nesta revisão. A publicação pública ainda está pendente do conjunto demonstrativo.** Não apareceu um motivo técnico para reabrir o desenvolvimento ou mudar a arquitetura.

A aplicação continua em `recortes/`. Não há repositório Git inicializado nessa pasta nem na pasta superior; portanto, não existem arquivos versionados, branch, remoto ou histórico local que esta revisão possa conferir. Nenhum Git foi inicializado automaticamente. Preferir iniciar o futuro repositório nesta pasta evita misturar as POCs da pasta superior com a aplicação.

## O que impede publicar e o que pode esperar

| Prioridade | Achado | Encaminhamento |
| --- | --- | --- |
| **P1 — pendente** | A roda de cores (`photo-8.jpg`) foi identificada, mas não tem permissão específica comprovada nesta revisão. Há BSD geral no upstream; não foi presumida como liberação específica dessa imagem. | Esclarecer com o responsável pela imagem ou aprovar uma substituição de origem comprovada. O bloqueio vale para deploy **e repositório público**, incluindo imagens derivadas. |
| **P2 — corrigido** | O `dist` não levava os avisos das dependências; o aviso local remetia a `node_modules`. | O pós-build agora reúne os textos de licença das 88 entradas de produção do lockfile e os créditos das imagens. Inclui MIT/Zlib do pako e a cópia upstream da licença MIT omitida no tarball de `react-remove-scroll-bar`. |
| **P2 — atenção ao uso** | O retrato de Eileen Collins tem domínio público declarado, mas contém pessoa identificável/símbolos NASA. Isso não autoriza qualquer divulgação promocional. | Não usar como capa/anúncio sem resolver as condições pertinentes. A captura nova do README não utiliza esse retrato. |
| **P2 — publicação futura** | Git/remoto/projeto Vercel ainda não foram criados. | Decidir o conteúdo e a raiz do repositório após encerrar a questão das imagens. Nenhuma ação remota foi realizada. |
| **P3 — escolha do autor** | Não há licença própria definida para reutilização do código e da identidade visual. | Escolher caso se queira permitir reutilização. Não é um impedimento técnico para hospedar a aplicação nem autoriza presumir MIT para todo o projeto. |
| **P3 — validação real** | Safari/iPhone/Android, leitores de tela, memória e impressão reais continuam pendentes. | Validar no primeiro ambiente de testes autorizado. A emulação e o WebKit automatizado não encerram essas verificações; essa pendência é distinta da autorização das fotos. |

## Fotografias demonstrativas

As oito imagens correspondem ao conjunto do scikit-image: café, Chelsea, foguete, astronauta, câmera, grama, Hubble e roda de cores. Quatro têm declaração CC0 específica; outras três têm declaração de domínio público no upstream, com as ressalvas de crédito e uso indicadas. A roda de cores permanece **não verificada quanto à permissão específica**. Essa é uma avaliação conservadora de evidência, não uma afirmação de infração.

A [tabela por fotografia](fotografias-demonstrativas.md) registra autor/crédito, fonte, licença declarada, condições e páginas indisponíveis. O [inventário de proveniência](demos-proveniencia.json) contém os hashes locais e upstream. Nenhuma licença foi inferida apenas de uma busca de imagens; nenhuma fotografia foi substituída.

O cuidado vale também para `public/references`, snapshots de testes, capturas antigas, POCs e amostras exportadas. Excluir as referências do build não autoriza distribuí-las no futuro repositório. Os materiais de desenvolvimento foram preservados enquanto a decisão está pendente.

## README e acabamento

O README agora apresenta o uso do recortes antes da stack, com instalação, explicação técnica breve, privacidade, limites e autoria. O texto deixou de ser um documento de entrega por fases. Os detalhes e comandos de desenvolvimento foram mantidos em [desenvolvimento.md](desenvolvimento.md).

Foi incluída uma captura real de **1440 × 1165 px**, usando apenas café, Chelsea e grama, com declaração CC0 documentada. A importação substituiu os exemplos antes da captura; biblioteca, colagem e miniaturas usam somente esses três arquivos. Não há fotografia pessoal nem roda de cores na imagem. A captura pode ser reproduzida por `node scripts/capture-readme.mjs`, com preview na porta 4180. Uma segunda imagem não foi necessária.

Na UI, foi removido o rótulo “Fase 4 · avaliação” e o CSS correspondente. Nenhuma etiqueta provisória o substituiu. Não houve alteração de modelos, motor Canvas, gestos, transições, estados React ou microcopy dos fluxos.

A remoção do rótulo mudou a altura do rodapé: uma diferença de arredondamento no desktop/320 px e uma linha a menos em 390 px. As sete capturas afetadas foram revisadas e atualizadas **por essa mudança autorizada**, após preservar suas versões anteriores localmente. A comparação RGB confirma igualdade fora da área pintada pelo rodapé; o limite considera os 2 px de tinta/borda do antigo badge que ultrapassavam sua caixa de linha. [Evidências dos diffs](baselines-pre-publicacao.json). As 45 referências WebP da POC e o HTML original permanecem idênticos. Os outros snapshots foram preservados.

## Privacidade, dependências e build

A inspeção do código encontrou requisições apenas para recursos locais de demonstração e código do Worker. Não há backend, upload, analytics, persistência, código de autenticação ou serviço remoto de imagens. O link de autoria é uma navegação externa explícita. Os testes de rede e exportação confirmaram o processamento local no fluxo exercitado. Isso não promete ausência de logs de acesso na futura hospedagem estática.

Os limites de importação, leitura pelo conteúdo e descarte dos recursos permanecem os da Fase 4. Nenhuma dependência foi adicionada, removida ou atualizada. As sete dependências diretas têm usos no código; a árvore npm não apresentou dependências inválidas ou extraneous. `npm audit` completo retornou zero avisos conhecidos em 19/10/2026; é uma consulta de avisos, não uma auditoria exaustiva de segurança.

O build possui **16 arquivos**: HTML, favicon, CSS/JS, oito JPEGs demonstrativos e os avisos de terceiros. Não inclui POCs, referências de comparação, testes, capturas, relatórios, `.env` ou sourcemaps. As 45 referências originais ficam em desenvolvimento. Todos os arquivos do `dist` foram solicitados no preview com resposta HTTP 200, e a CSP confere com a configuração de produção. [Inventário da distribuição](distribuicao-pre-publicacao.json).

`vercel.json` já define build `npm run build`, saída `dist` e headers estáticos. Node 24 é compatível com a configuração atual e a documentação oficial consultada. Na importação futura, escolher preset Vite, instalação `npm ci` e a raiz correta: `recortes` se o repositório começar na pasta superior, ou `.` se começar na pasta da aplicação. Não há rotas internas que precisem de rewrite SPA. Não são necessários banco de dados, funções ou variáveis de ambiente. Nenhum domínio ou projeto remoto foi configurado.

## Arquivos alterados e limpeza

| Arquivo/grupo | Motivo |
| --- | --- |
| `README.md` | Apresentação, uso, stack, privacidade e autoria em texto mais direto |
| `docs/desenvolvimento.md` | Preservar comandos e detalhes que saíram do README |
| `docs/fotografias-demonstrativas.md`, `docs/demos-proveniencia.json` | Fontes, condições, hashes e pendências das oito imagens |
| `docs/images/recortes-desktop.png`, `scripts/capture-readme.mjs` | Captura real e reproduzível com apenas três imagens documentadas |
| `src/app/App.tsx`, `src/styles/index.css` | Retirar o rótulo de fase e seu estilo sem uso |
| Sete `fase-3-bancada-*.png` em `tests/e2e/workbench.spec.ts-snapshots/` | Refletir exclusivamente a remoção do rótulo e a altura do rodapé |
| `.gitignore` | Excluir logs, `.env`, `.vercel` e amostras geradas de `output/` do futuro Git |
| `scripts/prepare-dist.mjs`, `THIRD-PARTY-NOTICES.md`, `licenses/react-remove-scroll-bar.LICENSE` | Levar os avisos de distribuição para o build, sem acesso à rede durante o build |
| Relatórios desta revisão em `docs/` | Separar evidências atuais dos resultados históricos das fases |
| `debug.log` | Removido: log de diagnóstico do navegador, não fonte nem evidência necessária |

`node_modules`, `dist`, caches, resultados/relatórios Playwright e `output` são gerados/ignorados, não arquivos versionados. As amostras em `output` continuam no disco. Nenhuma exclusão em massa foi feita. Testes, fixtures, referências, POCs e relatórios históricos úteis permanecem disponíveis. O pós-build continua retirando apenas a cópia gerada de `dist/references` após validar seu caminho absoluto.

## Validações desta execução

| Verificação | Resultado |
| --- | --- |
| TypeScript | Aprovado |
| ESLint | Aprovado, incluindo o script novo de captura |
| Vitest/componentes | 136 testes aprovados em 14 arquivos |
| Árvore npm e audit completo | Árvore válida; zero vulnerabilidades conhecidas na consulta |
| Build de produção | Aprovado, com os avisos de licença gerados offline |
| Playwright: matriz inicial nas três engines | 132 aprovados, 3 omissões conhecidas e 3 falhas de snapshot decorrentes da remoção do rótulo |
| Revisão/reexecução visual | Sete capturas conferidas; os 3 testes visuais passaram depois, **sem** modo de atualização |
| Resultado consolidado | 135 casos E2E aprovados; 3 omissões por capacidades de toque/CDP. Não foi repetida a matriz funcional inteira após a revisão das imagens de referência |
| Distribuição e headers | 16 arquivos HTTP 200, CSP igual à preparada para produção, nenhum resíduo distribuído |
| POC e referências rasterizadas | SHA-256 preservados; nenhuma referência WebP regenerada |
| Captura README | Gerada na aplicação real e inspecionada visualmente |

Os fluxos exercitados incluem carregamento, 36 combinações de modelos/formatos, importação atômica, biblioteca, máscaras, enquadramento, desktop/mobile, foco, dialogs, exportação nos três formatos, erros, cancelamento, offline preparado e privacidade de rede. As transições discretas não foram alteradas. Não foi identificado outro defeito reproduzível que justificasse alterar a interface nesta revisão.

Os benchmarks de CPU, memória, PDF JPEG/PNG, 108 comparações de exportação e Fast Refresh das três engines **são resultados anteriores**, registrados na [Fase 4](fase-4.md). Não foram repetidos nem apresentados como novas validações. Safari real, hardware, leitores de tela e impressão seguem sem validação física.

## Próximos passos

1. Resolver a permissão da roda de cores ou aprovar sua substituição pontual; conferir a repercussão em referências/capturas antes do primeiro push público.
2. Manter os créditos e evitar o retrato NASA em materiais promocionais sem a autorização pertinente. Decidir separadamente a licença de reutilização do código.
3. Após autorização, criar o repositório e o projeto Vercel com a raiz correta. Publicar primeiro para testes reais, com as limitações registradas.
4. No ambiente publicado, testar Safari/iPhone/Android, download/salvamento, VoiceOver/TalkBack e comportamento com memória limitada. Conferir os headers efetivamente servidos pela hospedagem.

Os servidores locais de desenvolvimento/preview foram encerrados: PIDs 16336 e 16236, portas 5173 e 4180 liberadas. Não restou processo Vite deste projeto. [Registro da limpeza](servidores-pre-publicacao.json). Para voltar a experimentar, execute `npm run dev` dentro de `recortes/`.

**Nenhum commit, push, deploy ou configuração de domínio foi realizado.**
