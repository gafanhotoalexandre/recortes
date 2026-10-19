# Fase 3 — fotografias, edição e estados

Concluída para avaliação em 18/10/2026. **Parada obrigatória antes da Fase 4.**

Aplicação: <http://127.0.0.1:5173/>. Build de produção: execute `npm run preview` e abra <http://127.0.0.1:4173/>.

## Entrega e marcos

1. **Importação e recursos:** validação pelo conteúdo, limites antes da decodificação, preparo serial, publicação atômica, cancelamento e descarte. O marco passou por TypeScript, lint e 111 testes unitários/de componentes antes de prosseguir.
2. **Edição e histórico:** associações, controles, geometria de gestos, rascunho e histórico. O marco passou por 115 testes unitários/de componentes, build e oito novos cenários de navegador em Chromium.
3. **Miniaturas e validação:** fotografias reais nas miniaturas, invalidação por entradas efetivas, fila de pinturas, acessibilidade, comparação da POC e matriz de engines. Resultado final detalhado abaixo.

O registro de modelos e o fluxo `CompositionState → resolveGeometry/resolveScene → renderScene` foram preservados. Geometria, recorte e desenho continuam independentes de React. As sobreposições interativas consomem a geometria e as máscaras do mesmo motor; indicadores de seleção não entram na cena fotográfica.

Não houve nova dependência de runtime, Worker, exportação pública, persistência, preparação offline ou publicação.

## Biblioteca, primeira importação e associações

A primeira importação bem-sucedida substitui a biblioteca demonstrativa e reconstrói **todas as doze posições**, com novos IDs de fotografia, recortes centralizados e posições restantes vazias. Modelo, formato e aparência são preservados; legenda e data demonstrativas são limpas. O teste cobre explicitamente duas fotografias em Mural, que exige oito: seis molduras visíveis vazias e nenhuma associação demonstrativa nas doze posições.

Fontes já preparadas, biblioteca e composição são publicadas juntas. Lotes parcialmente válidos publicam somente os arquivos aceitos na ordem recebida; falha total e cancelamento preservam a composição e seu histórico. Durante o preparo, alterações da composição/biblioteca ficam ocupadas, enquanto navegação, ajuda, cancelamento e recomeço continuam disponíveis.

Selecionar na biblioteca e aplicar permanece uma ação direta. Antes do clique, a interface mostra o destino por número, contorno discreto e texto. Após a ação, destaca a moldura e informa aplicação ou troca. Sem moldura visível selecionada, o destino é a primeira vazia visível ou a primeira quando todas estão ocupadas.

Seleção da biblioteca, seleção da moldura, fotografia associada e enquadramento têm responsabilidades distintas. A fotografia do Inspector é derivada da moldura. Reaplicar a mesma foto preserva seu recorte. Uma foto já usada troca a associação completa, incluindo recorte, mesmo quando sua origem está oculta.

Trocar modelo/formato preserva posições e recortes ocultos. Seleção de moldura oculta fica suspensa, com indicação na bancada, e retorna ao expandir o modelo. “Mudar a ordem” rotaciona as posições visíveis, conforme a POC; não reorganiza a biblioteca. “Retirar da colagem” mantém o arquivo na biblioteca. Remover da biblioteca limpa suas associações, inclusive ocultas, inicia novo histórico e libera os recursos correspondentes.

A sessão distingue biblioteca demonstrativa e pessoal explicitamente: remover todas as fotos pessoais não faz a próxima importação apagar novamente o texto como se fossem exemplos.

## Enquadramento, estado React e histórico

O mouse arrasta diretamente. No celular, toque seleciona a moldura e abre seus ajustes; **Ajustar enquadramento** fecha o painel e apresenta zoom e **Concluir** junto à bancada. Fora desse modo, o toque permite rolagem normal. Não foi implementada pinça própria.

Os deslocamentos passam de coordenadas CSS para a cena e depois pela transformação inversa da moldura. Máscaras, inclinações e ordem de sobreposição participam da seleção. O gesto parte do recorte efetivamente visível, evitando zona morta ou salto após adaptar formato. Zoom de 100% a 300%, setas, centralização e troca também estão disponíveis por controles acessíveis.

Cada gesto confirma uma operação. Escape, cancelamento do ponteiro e perda de captura restauram o gesto em andamento. Um segundo dedo cancela o arraste, preservando o enquadramento confirmado. Mudanças de formato, modelo, tamanho e ocupação cancelam gestos espaciais incompatíveis. Concluir somente encerra a ferramenta; não agrupa todos os gestos do modo numa operação única.

O reducer contém dados serializáveis da biblioteca/composição e até 40 operações de histórico. Fotografias originais, URLs e fontes Canvas ficam fora dele. Seleção, foco, abas e filtros não entram no histórico. Adição/remoção efetiva de fotos inicia novo histórico. Atalhos da aplicação não substituem o desfazer nativo enquanto se escreve em campos de texto.

O acionador de importação permanece focalizável enquanto a ação está ocupada. Após soltar arquivos, o foco é restaurado depois da atualização da interface, apenas se o usuário não o tiver movido; recomeçar invalida restaurações pendentes.

Um pequeno controlador de rascunho mantém a edição temporária. Os controles interessados se inscrevem em seus valores; o Canvas agenda pintura imperativamente, consolidada em `requestAnimationFrame`. O App e o histórico não recebem uma atualização por movimento. Efeitos tratam aquisição/limpeza de recursos e listeners, sem encadear estados derivados.

## Miniaturas e continuidade

As miniaturas usam associações, recortes e aparência confirmados da sessão, com seu próprio modelo em retrato e sem legenda/data. O recorte é resolvido para a geometria de cada modelo pelo motor compartilhado.

Durante arraste e ajustes ainda não confirmados, a galeria conserva suas imagens. Após confirmar, somente modelos cujas entradas visuais mudaram precisam desenhar novamente. Texto e formato da bancada não invalidam as miniaturas. Editar a posição 8 afeta somente Mural entre os modelos atuais, conforme teste automatizado.

Uma fila desenha uma miniatura por frame e consolida revisões pendentes. Cards filtrados e o painel mobile fechado adiam a pintura até reaparecer. Não existe decodificação por card. Canvas visível, auxiliar reutilizável, biblioteca, abas e campos permanecem montados nas interações verificadas. Um quadro completo substitui o anterior após o desenho; não se apresenta uma superfície limpa durante preparo ou falha.

## Recursos, privacidade e formatos

Limites mantidos: **12 fotos; 15 MiB por arquivo; 80 MiB no conjunto; 32 MP; 16.000 px por lado**.

JPEG, PNG e WebP são identificados pelo conteúdo. Dimensões são verificadas antes de decodificar e reconferidas na imagem decodificada. PNGs incompletos são recusados pela estrutura/término do arquivo, evitando depender da tolerância diferente dos decodificadores. PNG/WebP animados identificados no cabeçalho são recusados. A leitura inicial é limitada ao primeiro MiB; cabeçalhos com metadados excessivos podem ser recusados.

As oito orientações EXIF de JPEG foram efetivamente testadas nos três engines, incluindo dimensões e conteúdo dos pixels. A orientação é aplicada uma vez. Imagens cujas dimensões/orientação não possam ser conferidas com segurança são recusadas; não foi implementado um interpretador universal de metadados de PNG/WebP.

Cada arquivo é preparado serialmente. A fonte de trabalho tem maior lado de até 1024 px; a miniatura da biblioteca, até 256 px. O original permanece como `File` na sessão, sem decodificação permanente. Bitmaps originais são fechados e canvases temporários zerados. Cancelamento e recomeço invalidam operações antigas; resultados nativos tardios são descartados e liberados. Cancelar pode aguardar uma chamada nativa terminar antes de permitir outro lote.

Fotografias não são enviadas para processamento, armazenadas em banco/localStorage/IndexedDB ou registradas em logs. URLs são locais e revogadas ao retirar recursos da sessão. Os testes conferem liberação em remoção, recomeço, cancelamento e desmontagem.

**HEIC/HEIF não foi habilitado.** Validar dimensões e orientação da imagem principal, inclusive contêineres compostos, ampliaria o escopo antes de estabilizar as funções principais. A interface apresenta recusa clara e orienta JPEG/PNG/WebP. Não foi adicionado conversor ou promessa de suporte baseada somente no nome do navegador.

## Verificações finais

| Verificação                        | Resultado                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| TypeScript estrito, ESLint e build | Aprovados, sem avisos de lint                                                                         |
| Vitest/RTL                         | 120 testes aprovados em nove arquivos                                                                 |
| Playwright                         | 111 aprovados, três omissões explícitas; 114 casos configurados                                       |
| Chromium                           | 38 aprovados                                                                                          |
| Firefox                            | 36 aprovados; dois testes de toque omitidos por limitações das APIs de automação                      |
| WebKit                             | 37 aprovados; sequência CDP de múltiplos toques omitida                                               |
| POC                                | 36 composições + nove miniaturas comparadas, sem alterar referências                                  |
| Snapshots da interface             | 18 novas referências `fase-3-`, aprovadas depois em execução normal sem atualização                   |
| Layout                             | 320, 390, 720, 721, 860, 1150, 1151 e 1440 px; DPR 1 e 2                                              |
| Continuidade                       | Identidade do Canvas/controles, amostragem de ausência de quadros vazios e foco nos cenários testados |

A cobertura inclui importação menor que o modelo, falha parcial/total, limites, arquivo inválido, PNG truncado, conclusão tardia, cancelamento/recomeço, remoção associada, troca oculta, máscaras, histórico agrupado, controles, foco e miniaturas sem desenhos durante gestos.

Toque nativo de seleção foi automatizado em Chromium e WebKit. Chromium também executou sequência emulada de rolagem, arraste explícito e cancelamento com dois dedos via CDP. Esses ensaios **não são testes em aparelho físico**.

O Firefox inicialmente falhou ao criar até uma página vazia sob a restrição de processos do ambiente. A suíte foi executada com sucesso fora dessa restrição, sem mudar preferências de segurança na configuração do projeto. Os dois problemas efetivamente encontrados na aplicação — PNG truncado aceito pelo decoder e foco de clique no WebKit — foram corrigidos e verificados novamente.

O relatório HTML está em `playwright-report/index.html`. As referências e relatórios das fases anteriores permanecem preservados.

## Fidelidade visual

Não foi identificada nova divergência estrutural no desenho dos modelos. Os resultados contra os WebPs coincidem com as diferenças residuais da Fase 2:

| Referência      | Erro médio RGB (0–255) | Pixels com algum canal diferente em mais de 24 |
| --------------- | ---------------------- | ---------------------------------------------- |
| 36 composições  | 0,762–1,019            | 0,127%–0,258%                                  |
| Nove miniaturas | 1,274–1,677            | 0,056%–0,350%                                  |

As diferenças residuais continuam compatíveis com WebP, reamostragem e rasterização. Os valores são referências diagnósticas, não exigência de igualdade binária. Nenhum baseline original foi regenerado para ocultar diferenças.

Mudanças deliberadas da interface: controles habilitados, indicador numerado de destino/seleção, remoção acessível na biblioteca, feedback de operação e barra de enquadramento mobile. Capturas inspecionadas estão em `screenshots-fase-3/`.

## Medições

Arquivos reproduzíveis: `build-metrics-fase-3.json`, `browser-metrics-fase-3.json`, `editing-metrics-fase-3.json` e `visual-comparison-fase-3.json`.

- JavaScript inicial: aproximadamente **114,5 KiB gzip**, cerca de **8,5 KiB acima da Fase 2**; CSS: aproximadamente 7,2 KiB gzip. Sem novas dependências de runtime, fragmentação manual ou aumento de limites de aviso.
- Inicialização: FCP de 128–156 ms, CLS 0; troca de formato p95 49,0 ms no ensaio de cinco contextos locais, próximo dos 49,3 ms da Fase 2.
- Edição: três contextos Chromium/Windows, 1440×1000, DPR 1, sem throttling; doze arquivos JPEG sintéticos de 4000×3000 (12 MP) por contexto. Arquivos locais evitam incluir conversão Base64 da automação no custo de importação.
- Importação: aproximadamente **0,85–0,89 s** para os doze arquivos. As chamadas de redução medidas ficaram até aproximadamente 4,0 ms. Não houve tarefas longas registradas no intervalo medido de importação/arraste desse ensaio; isso não garante o mesmo comportamento para qualquer arquivo ou dispositivo.
- Arraste inclinado com zoom 2: 60 movimentos por contexto; intervalo entre frames p95 aproximadamente **16,7–16,8 ms**, desenho/cópia final aproximadamente 7,9–8,1 ms. Nenhum desenho das miniaturas durante o gesto; uma atualização por modelo afetado após confirmar.
- Recursos do ensaio: fontes reduzidas 36 MiB, miniaturas decodificadas aproximadamente 2,25 MiB; doze bitmaps nativos abertos e fechados. Após recomeçar: zero URLs pessoais ativas, zero bitmaps nativos vivos e zero pixels retidos nas fontes pessoais controladas.
- Picos instrumentados: aproximadamente 40,3 MiB em canvases e 45,8 MiB no bitmap nativo. São picos separados, que não ocorreram necessariamente juntos.

Esses números **não medem RAM total**, heap, GPU, cópias internas ou pressão de memória. O ensaio usa JPEGs sintéticos de baixa complexidade e aproximadamente 1,12 MiB comprimido no conjunto. A instrumentação retém referências aos canvases para contar dimensões. O limite de 32 MP pode produzir um bitmap temporário muito maior, aproximadamente 122 MiB, antes de cópias internas.

A medição não justificou introduzir Worker. O renderizador compartilhado permanece apto à estratégia futura, sem uma implementação paralela de desenho.

## Limitações e avaliação manual

- Exportação PNG/JPEG/PDF continua indisponível; o diálogo informa essa condição. Não houve avanço na Fase 4.
- Fontes de trabalho de até 1024 px podem parecer menos nítidas com zoom elevado ou telas densas. Os originais estão preservados para a exportação futura; não foi validada qualidade de impressão nesta fase.
- HEIC/HEIF, preparação offline, persistência e publicação não estão implementados.
- Safari real em macOS/iOS, duas versões principais recentes dos navegadores em sistemas reais, iPhone/Android físicos, VoiceOver/TalkBack e pressão de memória em hardware continuam pendentes.
- A origem/licença das fotografias demonstrativas precisa de conferência antes de publicação.

Para experimentar: importar duas fotos em Mural, aplicar pela biblioteca observando o destino, trocar uma foto oculta ao alternar modelos, ajustar Bilhetes/Arcos, personalizar papel/texto e testar desfazer/refazer. No celular, comparar rolagem normal com o modo Ajustar. A sessão é temporária: recomeçar ou fechar a página descarta seu trabalho.

POC preservada: SHA-256 `cde6f552440d7b3d417888390fdb554543e9b810156112d6e533a6596f3b669a`.

**A implementação para aqui, aguardando sua avaliação antes de qualquer trabalho da Fase 4.**
