# Fase 2 — modelos e composição Canvas

Status: concluída para avaliação em 18/10/2026. **Parada antes da Fase 3.**

## Marcos e responsabilidades

O marco 1 consolidou contratos, registro, capacidades, geometria e reducer mínimo. Passaram 51 testes unitários/de componentes, build e quatro testes E2E de navegação/painéis antes da integração Canvas.

O marco 2 implementou cena, renderizador, recursos demonstrativos e integração. A substituição da prévia aconteceu após comparação isolada com todas as referências da POC.

### Modelos

- Um registro estático importa as nove definições individuais.
- Cada definição contém quatro variantes normalizadas, identidade/ordem das molduras e capacidades tipadas.
- A quantidade de fotos é derivada da ordem de molduras. Galeria, contador e ajuda consultam o registro.
- O catálogo temporário foi removido. Restaram no editor apenas os tipos e labels de navegação.
- Fotogramas, Bilhetes e Arcos geram elementos gráficos puros encapsulados. Fitas pertencem ao tratamento compartilhado da moldura.
- Modelos não importam React e não desenham em Canvas. Não há condicionais de modelo nos componentes.

### Composição e desenho

- `CompositionState` armazena modelo, formato, aparência e doze posições lógicas.
- Centro normalizado da fotografia e zoom são canônicos; o recorte efetivo depende da moldura e não é escrito de volta ao estado.
- O reducer só seleciona modelo/formato e reinicia. Repetir a mesma seleção preserva a referência do estado.
- Seleção da biblioteca, abas e painéis permanecem separados. A seleção de uma foto fora do modelo não é apagada.
- `resolveGeometry` resolve dimensões, transformações e capacidades efetivas sem alterar as escolhas armazenadas.
- `resolveScene` produz uma cena de dados serializáveis, com recortes de origem normalizados e ordem explícita de desenho.
- `renderScene` e `drawNode` são o único desenho para bancada, miniaturas e resumo do diálogo.
- Bordas, sombras e fontes são resolvidas nas dimensões do destino, incluindo os ensaios em alta resolução.

O contexto aceito permite futura reutilização com OffscreenCanvas. Não existe Worker ou exportador implementado, nem validação de execução em Worker nesta entrega.

## Continuidade visual e recursos

O Canvas visível permanece montado. O adaptador consolida solicitações em um frame, observa apenas mudanças de tamanho/DPR e evita desenho quando composição, fontes e dimensões permanecem iguais. Abas, filtros, seleção da biblioteca e ajuda não redesenham a composição nos cenários testados.

Um Canvas auxiliar reutilizável recebe o quadro completo. Somente após sucesso ocorrem cópia, atualização de dimensões e proporção visível. Uma exceção durante a preparação mantém o quadro anterior. No carregamento inicial, o papel tem espaço reservado e feedback até a primeira composição pronta.

As oito fontes demonstrativas são compartilhadas entre todos os consumidores e ficam fora do reducer. Cancelamento impede conclusão antiga; cleanup cancela frames, desconecta observadores e libera fontes e buffers. Os testes também exercitam falha e recuperação de carregamento.

Miniaturas ficam montadas ao trocar filtros. Painéis responsivos e o tratamento de foco em WebKit foram preservados.

## Fidelidade e diferenças visuais

O comando `npm run compare:poc` comparou as 36 composições e nove miniaturas nas dimensões exatas dos WebPs existentes, em Chromium/Windows. Não houve regeneração dessas referências.

| Comparação     | Erro médio RGB, escala 0–255 | Pixels com algum canal diferente em mais de 24 |
| -------------- | ---------------------------- | ---------------------------------------------- |
| 36 composições | 0,762–1,019                  | 0,127%–0,258%                                  |
| 9 miniaturas   | 1,274–1,677                  | 0,056%–0,350%                                  |

Todos os casos ficaram dentro das referências quantitativas iniciais: erro médio até 3 e até 1% de pixels acima de 24. Esses valores são diagnóstico complementar, não prova isolada de fidelidade.

Também foram inspecionados os resultados de Bilhetes em paisagem, Arcos em retrato, Fotogramas em A4, Postal horizontal e a bancada integrada. Não foi identificado desvio estrutural de geometria, máscara, sobreposição ou enquadramento. As pequenas diferenças residuais são compatíveis com compressão WebP, reamostragem e rasterização, sem exigência de igualdade binária.

A prévia atual é desenhada na resolução adequada ao espaço e DPR; a antiga imagem tinha maior lado fixo de 1000 px e era reamostrada pelo navegador. Pequenas diferenças de nitidez de textos/arestas em alguns tamanhos são esperadas por esse caminho diferente. Não foram introduzidas novas composições ou ajustes visuais para aproximar artificialmente os pixels.

Os 45 WebPs e as baselines da Fase 1 permanecem preservados. Foram criadas 18 baselines específicas da Fase 2, com nomes novos, que passaram depois em uma execução normal sem atualização de snapshots. Elas registram Canvas, indicador da fase e controles que agora respeitam as capacidades dos modelos.

O ensaio interno também desenhou Fotogramas A4 a 2480×3508, Bilhetes a 2400×3000 e Arcos a 3000×2000, verificando dimensões e papel opaco. Não gerou arquivos públicos nem comprova qualidade de impressão dos exemplos, que continuam limitados à resolução original disponível.

## Verificações automatizadas

| Verificação                | Resultado                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| Build e TypeScript estrito | Aprovados                                                                                     |
| ESLint                     | Aprovado, sem avisos                                                                          |
| Vitest/RTL                 | 92 testes em cinco arquivos aprovados                                                         |
| Playwright                 | 69 testes aprovados: 23 em cada engine                                                        |
| Engines                    | Chromium, Firefox e WebKit distribuídos com Playwright                                        |
| Composições na interface   | 36 combinações em cada engine                                                                 |
| Layout                     | 320, 390, 720, 721, 860, 1150, 1151 e 1440 px                                                 |
| DPR                        | 1 e 2 nos três engines                                                                        |
| Continuidade               | Canvas/biblioteca/controles preservados, trocas amostradas sem quadros pretos                 |
| Painéis                    | Foco, Escape, rolagem, reabertura e transições entre breakpoints                              |
| Rede                       | Interface sem solicitações das referências rasterizadas e sem requisições externas na jornada |
| Falhas                     | Erro de recursos, nova tentativa e conclusão antiga após cancelamento                         |
| Cena                       | Serialização/clone, ordem das fotos/decoração e ausência de mutação                           |

Os testes de apontamento e pixel amostram cenários específicos; não constituem uma garantia universal de ausência de flicker em qualquer dispositivo. A matriz física permanece separada.

Após a execução completa dos 69 E2E, um ajuste apenas no texto da ajuda passou novamente por build, lint, os 92 testes unitários/de componentes e seis testes focados de dialogs nos três engines. O relatório HTML do Playwright representa essa última execução focada.

## Métricas e memória

Arquivos reproduzíveis: `build-metrics-fase-2.json`, `browser-metrics-fase-2.json` e `visual-comparison.json`. Os JSONs da Fase 1 não foram sobrescritos.

- JavaScript: aproximadamente 106 KiB gzip, cerca de 6,6 KiB acima da Fase 1.
- CSS: aproximadamente 6,7 KiB gzip.
- Sem novas dependências de runtime, fragmentação manual de chunks ou aumento de limites para esconder avisos.
- Os aproximadamente 3,81 MiB de referências permanecem no diretório público para avaliação, mas não são solicitados pela interface. Sua retirada do pacote distribuído pode ser feita após a avaliação, preservando os fixtures de teste.

Medição local em Chromium headless, Windows, 1440×1000, sem throttling, cinco contextos novos:

- FCP entre 120 e 144 ms; CLS registrado igual a 0.
- Troca de formato com duas oportunidades adicionais de pintura: p95 de 49,3 ms, contra 47,8 ms na medição da Fase 1. Essa pequena diferença local não motivou otimizações adicionais.
- Resolução da cena inicial/final medida entre 0 e 0,1 ms, dentro da granularidade do relógio.
- Desenho e cópia da prévia: 1,5–1,7 ms nos registros coletados.
- Pixels RGBA dos canvases visíveis e buffers auxiliares: aproximadamente 4,07 MiB no cenário medido; metade corresponde aos auxiliares.

Essa última medida é uma estimativa por dimensões, não uma medição de memória total. Não inclui imagens decodificadas, heap, cópias do compositor, GPU ou estruturas internas. O limite de 1600 px restringe cada superfície da prévia; os buffers das miniaturas têm apenas 160×200 px. O auxiliar permite manter o quadro anterior quando o desenho falha, com custo proporcional neste cenário. Não foi introduzido um pool ou sistema complexo de gerenciamento de superfícies.

## Microinterações

Foi aplicado um ajuste local: dialogs têm backdrop e entrada/saída discretos, preservando o conteúdo até a desmontagem. `prefers-reduced-motion`, foco contido e retorno ao acionador foram testados. Não há animações de entrada a cada troca de aba ou modelo.

O painel mobile mantém seu movimento discreto de abertura. Um acabamento mais amplo, incluindo uma eventual saída animada do painel nativo, fica registrado para revisão posterior; não foi implementado um controlador adicional de animações nesta fase.

## Limitações e parada

- Fotos pessoais, importação, HEIC/HEIF, reorganização, ajuste de recorte, personalização e histórico continuam indisponíveis.
- PNG/JPEG/PDF públicos, escolha de codificação do PDF, Worker e preparação offline continuam nas fases seguintes.
- A interação de seleção de molduras no Canvas ainda não foi habilitada. A biblioteca mantém a seleção demonstrativa aprovada.
- Safari real em macOS/iOS, iPhone, Android físico, VoiceOver/TalkBack e memória sob pressão não foram validados.
- Testes nos engines do Playwright não representam as duas versões principais mais recentes de todos os navegadores instalados em dispositivos reais.
- A origem/licença dos exemplos ainda precisa ser conferida antes de publicação. Não houve publicação nesta fase.

**A implementação termina aqui, aguardando avaliação e autorização para a Fase 3.**

POC preservada: SHA-256 `cde6f552440d7b3d417888390fdb554543e9b810156112d6e533a6596f3b669a`.
