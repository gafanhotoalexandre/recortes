# Desenvolvimento

## Verificações usuais

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium firefox webkit
npm run build
npm run test:e2e
```

O E2E inicia um preview na porta 4173. Para reutilizar um preview desse projeto no PowerShell, configure `$env:PW_REUSE_SERVER='1'`. `PW_BASE_URL` permite apontar para outra porta, mas não altera a porta do comando que inicia o servidor; nesse caso, inicie o preview na porta desejada e habilite a reutilização.

Os testes em desenvolvimento e de Fast Refresh usam a porta 5173; inicie `npm run dev` antes:

```sh
npm run test:e2e:dev
npm run check:development
```

Neste ambiente, o Firefox do Playwright precisou de execução fora do sandbox de processos do agente. Isso não exige desativar preferências de segurança do navegador. Em uma máquina comum, execute a configuração padrão primeiro.

## Comparações e medições

```sh
npm run compare:poc -- --phase=4
npm run verify:export
npm run measure -- --phase=4
npm run measure:browser -- --phase=4
npm run measure:editing -- --phase=4
npm run measure:export
npm run measure:export:worker
```

Esses comandos pertencem à avaliação registrada da Fase 4. Reutilizar `--phase=4` sobrescreve seus relatórios; preserve uma cópia se quiser comparar resultados. Não é necessário repetir a matriz de desempenho a cada alteração de documentação.

As medições usam 4175, 4177, 4186 e 4187; a comparação da POC usa 4176. Execute ensaios de desempenho separados das demais suítes. As fixtures sintéticas ficam em `.cache`. Tempo de CPU, heap JavaScript e custo dos pixels não representam RAM total nem um celular físico.

`npm run references` captura referências usando a POC histórica da pasta superior, sem modificá-la. O script carrega a imagem cromática aprovada em memória e **não extrai nem sobrescreve as fotografias da POC**. `npm run references -- --model=mural` limita a captura às cinco referências afetadas por essa imagem. Não use recapturas para ocultar diferenças de geometria. O histórico anterior fica em `historico-local/`, ignorado pelo Git.

Para reproduzir o recurso original, use `node scripts/generate-colors.mjs`: grava somente `photo-8.jpg` e seu hash no catálogo. Depois investigue as diferenças e atualize apenas referências/snapshots afetados. `npm run compare:poc -- --final` verifica as 45 referências atuais e grava um relatório separado dos históricos das fases. São 40 imagens originais da POC e cinco Mural com a substituição isolada em memória.

`scripts/capture-release.mjs` captura amostras pela interface do preview na porta 4180. `scripts/measure-pdf-memory.mjs` usa o PNG de exemplo em `output/exports`. A inspeção independente do PDF usa Poppler. As amostras de `output/` são locais e não entram no primeiro commit pelo `.gitignore`.

`node scripts/capture-readme.mjs` também usa o preview na porta 4180 e importa apenas as três imagens CC0 documentadas para recriar a captura do README. Não utiliza fotos pessoais nem altera os recursos demonstrativos do projeto.

## Organização

| Diretório em `src/` | Responsabilidade |
| --- | --- |
| `app` | Interface, seleções e comandos da bancada |
| `core/models` | Registro único, variantes, capacidades e elementos autorais |
| `core/geometry` | Máscaras, transformações e enquadramento |
| `core/composition` | Estado serializável, associações e histórico |
| `core/render` | Cena e desenho compartilhado, independentes de React |
| `features/photos` | Leitura, validação e preparo das imagens |
| `features/editor` | Recursos da sessão, rascunho, galeria, biblioteca e painéis |
| `features/export` | Snapshot, execução sequencial, Worker/main, PNG/JPEG/PDF |
| `components/ui` | Primitivas de Dialog e Tabs adaptadas de shadcn/Radix |

O fluxo é `CompositionState → resolveGeometry/resolveScene → renderScene/drawNode`. Arquivos, URLs e fontes Canvas ficam fora do reducer; o histórico guarda dados da composição. O Canvas agenda as pinturas imperativamente, e as miniaturas recebem o estado confirmado após os gestos.

Não há catálogo temporário nem renderizador separado no Worker. A exportação mantém a ordem dos nós, mesmo quando a fotografia aparece em mais de uma moldura. PDF usa JPEG 0,96 conforme os ensaios da Fase 4.

## Distribuição estática

`npm run build` gera `dist/`, retira somente a cópia gerada de `references/` e acrescenta `third-party-licenses.txt` a partir do lockfile e das licenças instaladas. `public/references/` permanece como referência de testes. O build não consulta a internet para reunir os avisos. A exceção de empacotamento de `react-remove-scroll-bar` está documentada em `THIRD-PARTY-NOTICES.md` e `licenses/`.

No futuro projeto Vercel: preset Vite, Node 24.x, instalação `npm ci`, build `npm run build`, saída `dist`. A raiz será `recortes` se o repositório incluir a pasta superior; será `.` se o repositório começar nesta pasta. Não há rotas internas que exijam rewrite SPA. A CSP preparada em `vercel.json` é exercitada também no preview; dev/HMR usa sua configuração própria.

Vite e Node 24 são suportados segundo a [documentação de Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite) e as [versões Node suportadas](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), consultadas em 19/10/2026. Nenhum projeto remoto foi criado nesta revisão.

As [condições das imagens](fotografias-demonstrativas.md) acompanham a distribuição atual. Materiais históricos que ainda contêm a roda aposentada ficam no disco, excluídos do futuro Git público: `historico-local/`, capturas das Fases 3/4, snapshots inativos das Fases 1/2, caches, `output` e POCs/capturas da pasta superior. Não os inclua por envio manual. A licença de reutilização do código continua sendo uma escolha do autor, separada das dependências e das fotografias.
