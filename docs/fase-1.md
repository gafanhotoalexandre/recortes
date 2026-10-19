# Fase 1 — entrega para avaliação

Status: implementada e verificada localmente em 18/10/2026. **Aguardando avaliação do usuário antes da Fase 2.**

## Entregue

- Aplicação independente no subdiretório `recortes`, com React 19, TypeScript estrito, Vite e Tailwind 4.
- Identidade visual, estrutura e breakpoints da POC preservados.
- Nove modelos, três categorias e quatro formatos; 36 prévias reais da referência.
- Oito fotos demonstrativas locais, seleção na biblioteca e identificação da posição utilizada.
- Abas Papel, Foto e Texto, painéis mobile, ajuda e reinício com confirmação.
- Dialog e Tabs adaptados de shadcn/Radix; painéis responsivos nativos com a mesma subárvore no desktop e no mobile.
- Prévia anterior preservada durante decodificação da próxima imagem; resultados assíncronos antigos descartados.
- Dimensionamento da composição em CSS, sem observar tamanho e sincronizar estado React a cada resize.

O estado implementado é de navegação. Ainda não existe estado editável da composição, histórico, geometria, renderizador Canvas, processamento de arquivos, Worker ou exportação. As prévias rasterizadas são uma ponte de avaliação, não um segundo renderizador.

As abas e painéis mantêm os controles montados. Selecionar uma foto de exemplo abre seu painel, mas não modifica a imagem. A biblioteca também permanece montada durante trocas de modelo/formato.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Passou; inclui compilação TypeScript estrita |
| `npm run lint` | Passou, sem avisos |
| `npm test` | 10 testes passaram em 2 arquivos |
| `npm run test:e2e` | 51 testes passaram, 17 por engine: Chromium, Firefox e WebKit |
| Modelos e formatos | 36 combinações verificadas em cada engine |
| Larguras | 320, 390, 720, 721, 860, 1150, 1151 e 1440 px |
| Screenshots | 18 comparações: quatro larguras e dois painéis por engine |
| Navegação | Filtros, abas por teclado, foco contido e retorno ao acionador, Escape, reabertura e resize |
| Estabilidade | Identidade da prévia, biblioteca e controles; seleção preservada; posição da bancada em coordenadas do documento |
| Carregamento | Testes de resultado assíncrono antigo e erro de decodificação |
| Rede | Jornada observada sem requisições externas e sem erros de execução |
| POC original | SHA-256 conferido após a implementação; sem alterações |

As baselines visuais foram criadas nesta fase e depois comparadas em uma execução normal, sem `--update-snapshots`. Não são comparações automáticas com os JPEGs antigos. Houve inspeção visual das capturas desktop, intermediária, mobile e dos painéis contra a identidade fornecida.

Uma diferença de foco específica de WebKit foi corrigida: o acionador real é registrado explicitamente, porque um clique de apontador nesse engine não necessariamente foca o botão. Os testes de retorno de foco passaram após a correção.

O Firefox precisou ser executado fora da restrição de processos do agente; dentro dela, a criação de uma página encerrava o processo antes de carregar a aplicação. A matriz final foi executada com o acesso de processo necessário e passou. Isso não exigiu alterar a aplicação nem desativar a segurança interna do navegador.

## Métricas locais

Arquivos completos: `build-metrics.json` e `browser-metrics.json`.

- JavaScript: 328.326 bytes sem compressão; 101.758 bytes com `gzipSync` padrão, aproximadamente 99,4 KiB.
- CSS: 23.283 bytes; 6.219 bytes gzip, aproximadamente 6,1 KiB.
- Fotografias demonstrativas: 282.877 bytes no total, aproximadamente 276 KiB.
- Referências rasterizadas: 3.989.892 bytes armazenados, aproximadamente 3,81 MiB, incluindo 36 prévias e nove miniaturas. As 36 imagens não são carregadas juntas; a bancada solicita a prévia escolhida.
- Não houve configuração manual de chunks nem alteração de limite para esconder avisos.

Medição de navegador: Chromium headless 156.0.8078.4, Windows, viewport 1440×1000, localhost, sem limitação de CPU/rede, cinco contextos novos e 20 trocas de formato.

- Primeira pintura de conteúdo: 120–144 ms nas cinco execuções registradas.
- Troca de formato: p95 de 47,8 ms, incluindo referência/decodificação e duas oportunidades de pintura.
- Layout shift acumulado sem interação: 0 nas cinco execuções registradas.

Esses dados descrevem o ambiente local e a interface demonstrativa. **Não medem** navegação real pela internet, Canvas, arraste, exportação, pico de memória de fotografias originais ou desempenho em telefone. As metas são instrumentos de comparação, não justificativa para otimizações complexas nesta fase.

## Limitações e pendências

- Importação e exportação abrem explicações; não selecionam arquivos e não geram downloads.
- Papel, recorte, texto, reorganização e histórico estão visualizados, porém desabilitados.
- Sem preparação offline ou garantia de funcionamento desconectado. Isso fica para depois da estabilidade das funções principais.
- Sem HEIC/HEIF nesta fase.
- Sem publicação, cabeçalhos de produção ou declaração de segurança validada para produção.
- Safari em macOS/iOS, iPhone e Android físicos não foram testados. WebKit no Windows não substitui esses testes.
- As duas versões principais mais recentes de cada navegador ainda não formam uma matriz de compatibilidade concluída. A execução atual utilizou os engines distribuídos pelo Playwright instalado.
- Desempenho sob memória restrita, consumo total de memória, gestos touch físicos, VoiceOver e TalkBack continuam pendentes.
- Origem e licença dos exemplos precisam ser conferidas antes de publicação pública.

## Roteiro para a avaliação do usuário

1. Abra a aplicação e compare marca, proporções, cores e organização com a POC.
2. Navegue pelos nove modelos e quatro formatos, incluindo Bilhetes, Arcos e Postal horizontal.
3. Use os filtros e volte a Todas; confira se a composição escolhida continua selecionada.
4. Abra as três abas, selecione exemplos na biblioteca e experimente ajuda e reinício.
5. Redimensione entre desktop, intermediário e mobile. Abra/feche painéis, use Tab, setas nas abas e Escape.
6. Avalie se os controles indisponíveis e as explicações de importação/exportação deixam claro o estágio da entrega.

## Decisões mantidas para as próximas fases

- Motor de renderização único, independente de React; Worker será somente outra estratégia de execução.
- Avaliar JPEG e PNG na incorporação do PDF com exemplos reais de qualidade, arquivo e pico de memória.
- Tratar orçamentos como metas mensuráveis.
- Manter a lista de validações físicas separada dos testes automatizados.
- Evitar que HEIC/HEIF e preparação offline antecipem complexidade antes das funções principais.

Fonte preservada: `recortes-poc-final.html`, SHA-256 `cde6f552440d7b3d417888390fdb554543e9b810156112d6e533a6596f3b669a`.
