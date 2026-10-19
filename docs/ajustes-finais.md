# Ajustes finais antes do Git e da publicação

19/10/2026. **Sim: o recortes está pronto para inicializar o Git e preparar sua primeira publicação pública para testes**, com os créditos e exclusões de histórico já preparados. Nenhum Git, remoto ou deploy foi criado nesta execução.

## Imagem e integridade visual

`public/demos/photo-8.jpg` agora é um estudo cromático original: seis faixas com gradientes, bordas suaves e grão procedural discreto. Foi criado por `scripts/generate-colors.mjs`, sem imagens externas, em **460 × 560 px e 37.621 bytes**. Seu hash consta do catálogo e do inventário de proveniência. As outras sete fotografias são idênticas por SHA-256.

Não foi atribuída automaticamente uma licença MIT/CC0 ao código ou ao novo asset. Ele foi criado a pedido para uso e distribuição com o próprio recortes; a decisão de licença para reutilização independente continua pendente, sem impedir esta publicação.

A substituição afeta a biblioteca, a miniatura Mural e a sétima moldura do Mural. Foram recriadas **somente as cinco referências Mural**: quatro formatos e miniatura, pela POC com `demo-8` substituído em memória. As outras **40 referências permanecem idênticas**. Nenhum motor, modelo ou componente React foi alterado.

Nas 18 baselines ativas da interface, **nove** mostravam a imagem antiga. Receberam somente recortes dos screenshots reais nas caixas da oitava foto e da miniatura Mural. Todos os pixels fora dessas regiões são idênticos às versões anteriores. As outras nove capturas mantiveram os bytes originais. Esse procedimento também retira a imagem antiga onde a diferença ficaria abaixo da tolerância do teste. [Registro dos diffs](visuais-ajustes-finais.json).

`capture-poc.mjs` não extrai mais fotografias nem sobrescreve o catálogo. Valida a imagem aprovada e permite `--model=mural`; mesmo uma captura completa usa o novo recurso em memória. O build também valida o hash e a igualdade do JPEG distribuído. A restauração do JPEG antigo foi testada e recusada; o arquivo novo foi restaurado e revalidado em seguida.

## Histórico preservado, fora do futuro Git público

- `historico-local/`: JPEG aposentado, cinco referências Mural antigas e cópias anteriores dos snapshots.
- `docs/screenshots-fase-3/` e `docs/screenshots-fase-4/`: capturas históricas, mantidas no disco e ignoradas.
- 36 snapshots inativos das Fases 1/2: preservados, com exclusões específicas. As 18 baselines ativas continuam incluídas.
- `.cache/`, `output/` e relatórios de teste gerados: permanecem ignorados.
- POCs e capturas da pasta superior: intactas, com exclusões no `.gitignore` dessa pasta caso ela seja escolhida como raiz do Git.

Esses materiais podem conter a roda antiga. Não incluí-los por `git add -f` nem por upload manual. Não houve exclusão de material histórico. O repositório pode começar diretamente em `recortes/`; se começar na pasta superior, as exclusões preparadas também cobrem as POCs. [Conferência de hashes e distribuição](integridade-ajustes-finais.json).

## README e licenciamento

O README manteve sua abertura e funcionalidades. Foram acrescentadas duas frases sobre criar colagens sem aprender um editor inteiro, trocado o título para “Executar localmente” e dividida a explicação técnica entre modelos/Canvas, originais e Worker/exportação. Instalação, privacidade e limitações foram preservadas.

A captura principal foi conferida e mantida: usa apenas café, Chelsea e grama, com declaração CC0 documentada; não contém a roda antiga, fotos pessoais, dialog aberto ou processamento em andamento. Não foi acrescentada outra imagem nem regenerada uma captura já adequada.

A [tabela de licenciamento](fotografias-demonstrativas.md) foi atualizada. As quatro declarações CC0 e as três declarações de domínio público das fotografias mantidas continuam documentadas, sem inventar novas autorizações. A fonte direta SpaceX e a página original de grama antes indisponíveis continuam assim identificadas; a evidência utilizada é a declaração específica do distribuidor oficial scikit-image.

A pendência de `photo-8` está encerrada. Os créditos, incluindo NASA/ESA/equipe Hubble, acompanham `dist/third-party-licenses.txt`. O retrato NASA é um exemplo factual, sem endosso, e não está na captura promocional do README. Isso não autoriza seu uso em anúncios ou capas comerciais; uma campanha futura precisa respeitar a [política NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/). Essa condição não impede a versão atual de demonstração para testes.

## Validação desta execução

- TypeScript, lint e build de produção aprovados.
- 136 testes unitários/componentes aprovados em 14 arquivos.
- 135 E2E aprovados nas três engines, sem modo de atualização; três omissões conhecidas por capacidades de toque/CDP.
- 45 comparações visuais aprovadas: 40 referências intactas e cinco Mural com substituição isolada na POC. Também foram verificados os três casos de resolução alta incluídos nesse comando.
- Download PNG real do Mural em tamanho para compartilhar; dimensões conferidas e resposta da nova imagem verificada pelo hash.
- Os 16 arquivos do `dist` responderam HTTP 200. A imagem antiga, referências de teste e arquivos históricos não integram a distribuição.
- POCs originais e outras sete fotografias preservadas por hash. Nenhuma dependência foi alterada.

[Resultados técnicos](verificacao-ajustes-finais.json). Benchmarks de desempenho e verificações físicas não foram repetidos nem apresentados como resultados novos.

## Próximo passo

Inicializar o Git com as exclusões preparadas, conferir os arquivos a adicionar e, quando autorizado, criar o remoto e preparar a Vercel com Node 24, build `npm run build` e saída `dist`. A raiz será `.` se o Git começar em `recortes`, ou `recortes` se começar na pasta superior. Não há impedimento efetivo identificado nesta execução para seguir com essa preparação.

Safari/iPhone/Android, leitores de tela, downloads no dispositivo, memória e impressão reais continuam no roteiro de testes após a publicação autorizada. A licença permissiva do código permanece uma escolha futura do autor. Não houve commit, push, deploy ou alteração de domínio.

O preview utilizado nas verificações foi encerrado; a porta 4180 está liberada.
