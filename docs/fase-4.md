# Fase 4 — Exportação e preparação para publicação

Entrega para avaliação final em 18/10/2026. Aplicação integralmente em `recortes/`, sem deploy. A POC original, os relatórios anteriores e todas as referências visuais foram preservados.

Atualização de 19/10/2026: a [revisão de pré-publicação](revisao-pre-publicacao.md) registra a investigação das fotografias, os avisos distribuídos e a remoção do rótulo de fase, incluindo os sete snapshots de rodapé atualizados por essa alteração. Os resultados abaixo são o registro histórico da entrega da Fase 4.

## Marcos e decisões

### 1. Dev e preview

O defeito foi reproduzido antes da implementação: o cleanup de `FrameControls` zerava o Canvas de hit testing mantido por `useState`. No ciclo setup → cleanup → setup do StrictMode, o objeto continuava com 0 × 0, e `isPointInPath` retornava falso. Enter selecionava normalmente, enquanto o clique falhava. Restaurar somente o Canvas durante a instrumentação recuperou o clique; recarregar reproduziu o defeito.

O efeito agora cria seu próprio Canvas 1 × 1 e libera exatamente esse objeto, listeners, observador e interação ativa. StrictMode continua habilitado. O teste de componente confirma os dois setups e o descarte dos dois recursos; o teste real confirma seleção, zoom, teclado, recarregamento e reinício.

Fast Refresh foi verificado nos três navegadores por alteração controlada e restauração de `FrameControls`: Canvas preservado, seleção e zoom funcionais, sem erros. Não houve refatoração geral da Fase 3.

A regressão também identificou uma corrida de foco após importação no WebKit: a promessa podia terminar antes de o React remover `disabled` da moldura. A restauração passou a acontecer no layout effect após esse commit, respeitando mudanças de foco do usuário. O caso de soltar arquivos passou cinco vezes consecutivas após a correção.

### 2. PNG/JPEG e cena compartilhada

`ExportSnapshot` mantém composição imutável, metadados orientados e referências aos originais visíveis. Arquivos e recursos pesados ficam fora do estado React. O histórico continua contendo somente dados da composição; a exportação não cria operações de edição.

O fluxo é `resolveScene → nós em ordem → drawNode`. Prévia, execução principal e Worker compartilham as mesmas funções. A inicialização do contexto também é compartilhada. Cada nó fotográfico abre seu original, desenha e libera o bitmap antes do seguinte. Não há agrupamento por fotografia que altere sobreposições, fitas, bordas ou textos.

Uma fotografia reutilizada em várias molduras, com enquadramentos independentes, foi testada explicitamente no motor. A política de associação da biblioteca permanece a aprovada na Fase 3.

| Formato da composição | Alta resolução |
|---|---:|
| Retrato 4:5 | 2400 × 3000 px |
| Quadrado | 2800 × 2800 px |
| Paisagem 3:2 | 3000 × 2000 px |
| A4 | 2480 × 3508 px |

Compartilhar limita o lado maior a 1800 px. PNG e alta resolução são os padrões. JPEG usa qualidade 0,95. O papel da cena compõe o fundo, incluindo fotografias de entrada transparentes.

O nome opcional é normalizado com prefixo `recortes-` e extensão controlada. Sem nome, utiliza legenda ou `minha-colagem`. Molduras visíveis vazias impedem exportar; posições ocultas não impedem. O aviso de resolução compara o recorte efetivo do original com a moldura de saída, usando 0,6 como referência inicial da POC, sem bloquear o arquivo.

Nome, tipo e tamanho são preservados entre aberturas do dialog; Recomeçar restaura os padrões. Esses campos não reiniciam a preparação dos recursos nem alteram o histórico.

### 3. PDF, Worker, memória e cancelamento

Única nova dependência de produção: **pdf-lib 1.17.1, MIT**, fixada no lockfile. PDF contém uma imagem da composição em uma página, sem anexar os originais. A4 tem 210 × 297 mm, aproximadamente 595,276 × 841,890 pt, em ambas as resoluções. Os demais formatos mantêm altura de 720 pt e largura proporcional à composição.

**JPEG 0,96 foi escolhido para incorporar a imagem ao PDF.** Não há dupla codificação ou heurística de conteúdo em cada exportação. PNG continua disponível como formato de arquivo sem perdas.

| Ensaio de PDF | JPEG 0,96 | PNG |
|---|---:|---:|
| Bilhetes A4, fixture sintética texturizada | 1.894.163 bytes | 9.226.067 bytes |
| Arcos para compartilhar, entrada com transparência | 736.059 bytes | 1.930.858 bytes |
| Bilhetes A4 com os exemplos da aplicação, ensaio isolado | 965.464 bytes | 5.723.554 bytes |
| Maior heap JS observado nos pontos amostrados desse ensaio isolado | 6.815.892 bytes | 137.145.447 bytes |

Os PDFs foram abertos com Poppler, rasterizados e inspecionados, inclusive textos, data pequena, bordas, sobreposições, arcos e elementos de Fotogramas. A comparação JPEG/PNG da fixture texturizada rasterizada a 1800 px teve diferença média de aproximadamente 0,32/255, sem diferença estrutural observada. Os recortes ampliados dos textos estão em `output/pdf/rendered`.

A medição de memória usa contextos novos do Chromium, `--enable-precise-memory-info`, GC antes da operação e amostras nas fronteiras de incorporação e gravação. **É heap JavaScript observado, não RAM total nem pico exato.** Depois do GC, o heap voltou a aproximadamente 2,9 MB nos dois casos. Métodos e amostras: [pdf-memory-fase-4.json](pdf-memory-fase-4.json).

#### Evidência para Worker

A execução sequencial na thread principal foi medida antes de decidir. No ensaio de Bilhetes A4 com JPEG, a tarefa longa chegou a 398 ms com limitação CDP de CPU 4×. A separação por etapas localizou o maior trecho no desenho de elementos da cena, cerca de 394 ms; decodificação e codificação também têm tempos registrados. PNG incorporado ao PDF apresentou tarefas de até aproximadamente 4 s nessa condição.

O Worker utiliza o mesmo executor e pintor, com `OffscreenCanvas` próprio. No ensaio normal, PDF A4/JPEG levou cerca de 629 ms e PNG A4 com originais de 32 MP, cerca de 1162 ms. Não foram observadas tarefas longas na página nesses ensaios com Worker; os intervalos máximos entre quadros ficaram próximos de 16,8 ms. Isso demonstra isolamento da interface, não redução garantida do tempo total ou da memória.

O CDP 4× limita a página, **não a CPU do Worker**. Seus tempos totais entre estratégias nessa condição não representam uma comparação de aparelhos equivalentes. Também não simulam um celular físico.

O preflight verifica APIs, codificação e métricas de Georgia/Arial. Chromium e Firefox utilizaram Worker; o WebKit automatizado utilizou fallback principal. Não foi forçado suporte quando a verificação falhou.

Há uma exportação por vez, um Canvas de saída e um bitmap original por vez. A instrumentação confirmou máximo de um bitmap, com todos fechados após os trabalhos concluídos. Um Canvas A4 representa cerca de 33,2 MiB de pixels; um original de 32 MP representa cerca de 122,1 MiB, além de prévias, arquivos comprimidos, encoder, PDF e buffers internos. Worker não elimina esses custos.

Os ensaios usam entradas sintéticas controladas, incluindo fotografias texturizadas de 12 MP e reutilização de uma fotografia de 32 MP em várias molduras. Não afirmam importar doze arquivos distintos de 32 MP ultrapassando o limite de 80 MiB.

#### Concorrência e recursos

- `AbortController` e identificador da operação invalidam conclusões antigas. Cancelar/fechar/reiniciar impede downloads tardios.
- No Worker, o cancelamento encerra o executor. O código estático da aplicação fica preparado em memória para criar outro mesmo offline; fotografias não são armazenadas nesse cache.
- No fallback, chamadas nativas não interrompíveis terminam antes de liberar os recursos; a interface informa o cancelamento e impede outra exportação concorrente nesse intervalo.
- Falhas de decode, desenho, codificação ou PDF preservam composição e histórico. Não há repetição automática pesada em outro executor após falha.
- O Canvas é zerado antes da incorporação no PDF, após a imagem estar codificada.
- Somente uma URL de resultado é retida; o descarte após fechamento é adiado por 60 s para o navegador consumir o arquivo. Nova exportação ou reinício libera o resultado anterior.

O dialog permanece aberto após solicitar o download e oferece um link para baixar o resultado novamente. O texto não afirma que o arquivo já foi gravado no dispositivo. Cancelar/Fechar continuam disponíveis; não há bloqueio global adicional, opacidade da prévia ou remontagem da bancada durante a exportação.

### 4. Bundle, offline e preparação de publicação

PDF e executor são carregados sob demanda ao abrir Exportar. Não foram acrescentados chunks manuais genéricos nem alterados limites para esconder avisos. O Worker é um arquivo independente para permitir reinício offline, e o PDF principal permanece como caminho de fallback. A soma de todos os arquivos inclui caminhos alternativos; não equivale ao carregamento inicial. Números finais: [build-metrics-fase-4.json](build-metrics-fase-4.json).

Referências de tamanho gzip: aproximadamente **117,5 KiB de JavaScript inicial**, cerca de **3 KiB a mais** que a Fase 3; CSS próximo de 7,4 KiB. O Worker custa aproximadamente 182,2 KiB e o PDF do fallback, 171,2 KiB, carregados sob demanda. Um preflight reprovado após carregar o Worker pode também carregar o fallback. São tamanhos comprimidos de arquivos, não medição de transferência em rede móvel.

A preparação inclui os originais de todos os exemplos da biblioteca, permitindo depois trocar de modelo offline. Fotos pessoais continuam como `File` na sessão. A garantia é para a **aba aberta após preparar os recursos**, sem service worker, PWA ou salvamento persistente. Recarregar offline não é garantido. No dev, o grafo HTTP do Vite tem preparação adicional do fallback, preservando o comportamento funcional; o build utiliza o executor autocontido.

O build retira apenas `dist/references`, após conferir o caminho absoluto de saída. Os 45 WebP originais continuam em `public/references` e nos testes. Isso evita publicar aproximadamente 4 MB de referências de teste. POC, backups, testes, amostras e relatórios não integram o `dist`.

`vercel.json` prepara build, pasta `dist` e headers para hospedagem estática. A raiz do projeto de hospedagem deve ser **recortes**, não a pasta superior. Nenhuma configuração de conta ou deploy foi executada.

## Verificações

| Verificação | Resultado |
|---|---|
| TypeScript, ESLint e build | Aprovados |
| Vitest / componentes | 136 testes em 14 arquivos |
| Playwright de produção | 135 aprovados; 3 omissões explícitas por capacidades de toque/CDP |
| Fluxos no dev | 9 casos: seleção, PNG/JPEG e PDF com fotos locais/offline, nas três engines |
| Fast Refresh da camada de molduras | Chromium, Firefox e WebKit; Canvas preservado |
| Fidelidade da exportação | 108 casos PNG: 72 Chromium, 18 Firefox, 18 WebKit; mais 36 arquivos JPEG/PDF verificados |
| Referências da POC | 45 comparações aprovadas; originais não regenerados |
| Baselines da interface | Baselines existentes aprovadas, sem regeneração |
| Dependências de produção | Nenhum aviso conhecido em `npm audit --omit=dev` na data da avaliação |

As três omissões são as já conhecidas: dois casos de toque não disponíveis no Firefox desse ambiente e um caso CDP exclusivo de Chromium omitido no WebKit. WebKit não equivale a Safari real em iPhone/Mac. Firefox precisou executar fora do sandbox de processos do agente; nenhuma preferência de segurança foi alterada.

A comparação entre renderização normal com originais e execução sequencial principal foi idêntica nos casos testados. No Worker, a maior diferença média foi 0,1554/255, com até 0,4784% dos pixels inspecionados acima de 24 por canal. A inspeção usa lado maior de 1000 px; diferenças pequenas são compatíveis com rasterização/amostragem, sem alteração estrutural identificada. [Relatório da matriz](export-fidelity-fase-4.json).

Na comparação com os WebP da POC, as 36 composições mantiveram MAE de 0,762–1,019/255, e as nove miniaturas, de 1,274–1,677/255, como nas fases anteriores. [Comparação original](visual-comparison-fase-4.json).

Os testes incluem downloads reais reabertos, dimensões, página A4, enquadramentos, fontes, transparência, fotografia reutilizada, cancelamento tardio de decode/encode, falha de encoder, cancelamento/recriação de Worker offline, Escape seguido de reinício, erros de preparação, foco, histórico, biblioteca, gestos e transições de painéis.

## Desempenho da bancada

As medições locais em Chromium não mostraram regressão relevante: FCP de 136–140 ms, CLS zero, troca de formato de 48,8 ms no p95, arraste com intervalo p95 de aproximadamente 16,7 ms e nenhuma pintura de miniaturas durante o gesto. Após confirmar o gesto, cada modelo afetado recebeu uma pintura.

O ensaio com doze JPEGs sintéticos de 12 MP importou em aproximadamente 862–868 ms. É uma fixture de baixa entropia comprimida, não uma previsão para qualquer biblioteca pessoal. Após reiniciar, a instrumentação voltou a zero para URLs pessoais, bitmaps vivos e superfícies pessoais retidas. [Medições da bancada](browser-metrics-fase-4.json), [edição e recursos](editing-metrics-fase-4.json).

Tempos por etapa, codificação, tamanho e custos de pixels: [executor principal](export-metrics-main-fase-4.json), [Worker](export-metrics-worker-fase-4.json). Esses relatórios distinguem esperas assíncronas de tarefas longas observadas na página.

## Privacidade e segurança

O fluxo com fotografias sintéticas contendo EXIF de orientação, GPS e descrição foi exportado para PNG, JPEG e PDF. As saídas não preservaram o bloco EXIF nem a descrição. Os PDFs não receberam autor/título derivados das fotografias, anexos ou JavaScript. Textos da composição são rasterizados e nomes passam pela normalização controlada.

O registro de requisições na jornada verificou somente GETs locais de recursos da aplicação, sem corpos ou nomes pessoais. Não há upload, autenticação, persistência ou telemetria de fotografias. Medidas `performance` contêm apenas nomes de etapas e durações.

A CSP de produção foi aplicada também ao preview e verificada com exportações: scripts locais, sem `eval`; imagens locais/Blob; conexões locais; Worker local/Blob; objetos e formulários bloqueados. Estilos inline são permitidos para os estilos dinâmicos de React/Radix. O HMR permanece separado dessa política. Um teste compara os headers do preview aos preparados para hospedagem.

As 88 entradas de dependências de produção do lockfile declaram MIT, ISC, `(MIT AND Zlib)` ou 0BSD. Isso é inventário de declarações, não comprovação dos direitos sobre as fotografias. [Inventário](production-dependencies-fase-4.json), [consulta de avisos](dependency-audit-fase-4.json).

## Arquivos e avaliação

- [PNG Bilhetes A4](../output/exports/recortes-bilhetes-a4.png).
- [JPEG Arcos para compartilhar](../output/exports/recortes-arcos-compartilhar.jpg).
- [PDF Bilhetes A4](../output/pdf/recortes-bilhetes-a4.pdf).
- [PDF Fotogramas A4](../output/pdf/recortes-fotogramas-a4.pdf).
- Comparações PNG/JPEG incorporados em PDF e páginas rasterizadas: `output/pdf/`.
- Capturas de interface: `docs/screenshots-fase-4/`.

Para experimentar: importar fotos, ajustar uma moldura, abrir Exportar e aguardar a preparação. Testar alta/compartilhar, os três arquivos, cancelamento e nova tentativa. Depois de preparar, desligar a conexão sem recarregar e repetir a edição/exportação.

Os comandos estão no README. `capture-release.mjs` usa o preview na porta 4180; `measure-pdf-memory.mjs` utiliza seu PNG de exemplo. Poppler é necessário para repetir a inspeção independente dos PDFs. O aviso de importação dinâmica do harness de biblioteca ocorre somente nesse harness que importa o executor diretamente, não no build da aplicação.

## Limitações e pendências antes da publicação

1. **Origem/licença dos exemplos:** ainda não comprovada. Resolver antes de publicação pública. Os exemplos aprovados não foram substituídos arbitrariamente.
2. **Hardware e navegadores reais:** validar Safari em iPhone/Mac, Android, downloads/salvamento e pressão de memória em aparelhos modestos. O fallback pode ter bloqueios perceptíveis em hardware limitado; limitação de CPU em desktop não encerra essa validação.
3. **Acessibilidade assistiva:** navegação por teclado, foco, rótulos e movimento reduzido foram testados; VoiceOver, TalkBack e outros leitores reais continuam pendentes.
4. **Impressão:** PDF A4 físico e rasterização foram verificados; impressoras, papel e gestão de cores reais não foram validados. PNG/JPEG definem dimensões em pixels; PDF é o caminho para o tamanho físico A4. PDF é rasterizado, sem texto pesquisável.
5. **Memória:** não há garantia universal contra encerramento de aba pelo sistema operacional. Limites existentes, sequência e descarte reduzem o consumo; RAM/GPU/decodificador completos e aparelhos físicos não foram medidos.
6. **Formatos e offline:** HEIC/HEIF continua fora, sem biblioteca de conversão. Offline vale após preparação na aba aberta, não para uma nova navegação sem internet. Erros de módulos preservam a sessão; não há recarregamento automático que apague as fotos.

**Parada obrigatória:** Fase 4 entregue para avaliação final. Nenhum deploy foi realizado; publicação depende de autorização e das pendências acima.
