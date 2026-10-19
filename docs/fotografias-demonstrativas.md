# Fotografias demonstrativas: origem e condições

Atualizado em 19/10/2026 após a substituição autorizada da roda de cores. **O conjunto atual tem evidências suficientes para a demonstração pública de testes do recortes**, com os créditos e condições abaixo. Isso não é uma autorização genérica para campanhas publicitárias com imagens de terceiros.

## O que a aplicação distribui

São oito JPEGs em `public/demos/`, referenciados por `src/features/editor/demo-assets.json`: sete fotografias e um estudo cromático original. Todos têm 460 × 560 px. Os nomes da biblioteca são rótulos da POC, não títulos nem créditos das obras. As imagens podem aparecer na biblioteca, nos modelos, nas miniaturas e nos arquivos exportados com os exemplos.

As sete fotografias foram extraídas dos data URLs da POC. Seu SHA-256 confere com `sourceHash` do catálogo: `cde6f552440d7b3d417888390fdb554543e9b810156112d6e533a6596f3b669a`. As POCs permanecem intactas. O script `scripts/capture-poc.mjs` agora apenas captura referências: carrega o estudo cromático aprovado em memória, não extrai fotografias nem regrava o catálogo. O build e a captura verificam o hash aprovado e recusam a roda antiga.

A revisão anterior identificou os oito exemplos então utilizados como derivados do scikit-image **v0.25.2**, com os hashes de origem conferidos no [registro oficial](https://github.com/scikit-image/scikit-image/blob/v0.25.2/skimage/data/_registry.py). As sete fotografias mantidas são recortes/redimensionamentos recomprimidos. A antiga `color.png` deixou de integrar o conjunto público.

Hashes, dimensões, URLs fixadas e resultados da comparação estão em [demos-proveniencia.json](demos-proveniencia.json). Não foram usadas fotografias pessoais.

## Resultado por imagem

“Verificada” abaixo significa que há identificação do arquivo e declaração específica de direitos no distribuidor oficial do conjunto. Não significa liberação de direitos de imagem, marcas ou endosso para qualquer publicidade.

| Arquivo / rótulo | Origem e autor/crédito | Declaração encontrada / situação |
| --- | --- | --- |
| `photo-1.jpg` — Um café | `coffee.png`; Rachel Michetti, Pikolo Espresso Bar | CC0. **Verificada.** [Fonte](https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.coffee) |
| `photo-2.jpg` — O gato | `chelsea.png`; Stefan van der Walt | CC0. **Verificada.** [Fonte](https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.chelsea) |
| `photo-3.jpg` — Lançamento | `rocket.jpg`; SpaceX, DSCOVR/Falcon 9 | Domínio público declarado pelo upstream. **Verificada nesse nível; fonte direta indisponível nesta consulta.** [Declaração e origem Flickr](https://github.com/scikit-image/scikit-image/blob/v0.25.2/skimage/data/_fetchers.py#L959-L978) |
| `photo-4.jpg` — Retrato | `astronaut.png`; NASA, retrato de Eileen Collins | Domínio público declarado. **Direito autoral identificado; publicidade exige atenção adicional.** [Fonte](https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut) |
| `photo-5.jpg` — Na rua | `camera.png`; Lav Varshney | CC0. **Verificada; corresponde à versão atual, não ao antigo cameraman removido.** [Fonte](https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.camera) |
| `photo-6.jpg` — Texturas | `grass.png`; Grass-01, linolafett | CC0 documentada pelo upstream. **Verificada nesse nível; página original indisponível nesta consulta.** [Declaração](https://github.com/scikit-image/scikit-image/blob/v0.25.2/skimage/data/_fetchers.py#L437-L452), [origem](https://www.deviantart.com/linolafett/art/Grass-01-434853879) |
| `photo-7.jpg` — Noite | `hubble_deep_field.jpg`; Hubble eXtreme Deep Field | Domínio público declarado pelo upstream, com crédito NASA/ESA/equipe científica. **Verificada com condições de crédito.** [Origem e crédito](https://science.nasa.gov/asset/hubble/hubble-extreme-deep-field-xdf/) |
| `photo-8.jpg` — Cores | Estudo cromático original do recortes; `scripts/generate-colors.mjs` | **Origem própria documentada.** Seis faixas com gradientes e grão procedural; sem imagens, texturas ou composição externa. Criado nesta execução para uso e distribuição com o recortes. |

O novo estudo é gerado somente com operações Canvas e uma sequência numérica fixa para o grão, em JPEG de 460 × 560 px. Não reutiliza a roda de cores. Sua criação e distribuição como recurso da aplicação, capturas e demonstrações foram solicitadas pelo autor do projeto nesta etapa. Não há atribuição externa a cumprir; **não foi concedida automaticamente uma licença permissiva de reutilização independente do asset ou do código**. A decisão geral de licença continua pendente, sem impedir seu uso no próprio recortes.

Para reproduzir: `node scripts/generate-colors.mjs` (Playwright/Chromium instalado). O script grava o JPEG e seu hash no catálogo; depois, atualizar somente as referências e capturas afetadas. Os outros sete JPEGs não são regravados. Uma versão de Chromium diferente pode codificar bytes diferentes; o hash registra o arquivo efetivamente aprovado, não promete identidade entre encoders.

## Usos e condições

As imagens CC0 permitem cópia, redistribuição e transformação, inclusive comercial. Isso cobre recortes, miniaturas e capturas; não é necessário pedir autorização autoral adicional nem atribuir como condição de CC0. Os créditos foram mantidos por rastreabilidade. CC0 não concede direitos sobre marcas ou pessoas retratadas. [Termos oficiais CC0](https://creativecommons.org/publicdomain/zero/1.0/).

Para o material NASA, não presumir apoio institucional nem usar logotipos/pessoas como endosso. O retrato de Eileen Collins contém pessoa identificável e símbolos NASA; **não está liberado por este relatório para capa ou divulgação promocional do recortes**. A política distingue uso factual de publicidade e prevê permissões adicionais para pessoas/logotipos. Não foi incluído na captura do README. [Política oficial NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/).

Crédito de `photo-7.jpg`: **NASA, ESA, G. Illingworth, D. Magee e P. Oesch (University of California, Santa Cruz), R. Bouwens (Leiden University) e HUDF09 Team**. Preservar o crédito nos materiais que distribuam essa imagem. [Ficha oficial](https://science.nasa.gov/asset/hubble/hubble-extreme-deep-field-xdf/).

A declaração sobre SpaceX está preservada no código/documentação oficial do conjunto. A página Flickr apontada não pôde ser lida nesta consulta; não se afirma ter confirmado nela a licença atual. Para uma campanha publicitária ou uma revisão que exija a declaração direta do titular, confirmar essa fonte antes de usar o lançamento como peça promocional.

## README, referências e futuro repositório

A captura nova `docs/images/recortes-desktop.png` foi feita na aplicação real após importar **somente photo-1, photo-2 e photo-6**, substituindo atomicamente os exemplos. Ela mostra Arcos com café, gato e grama, inclusive na biblioteca e nas miniaturas; não contém fotos pessoais nem a roda de cores. Esses três arquivos têm declaração CC0 específica.

As cinco referências Mural foram recriadas pela POC com apenas `demo-8` substituído em memória; as outras 40 são idênticas. Os snapshots ativos foram atualizados somente nas regiões da imagem trocada. A POC não foi modificada. As referências Mural antigas e cópias anteriores dos snapshots estão em `historico-local/`, ignorado pelo Git.

Capturas históricas em `docs/screenshots-fase-3/` e `docs/screenshots-fase-4/`, snapshots inativos das Fases 1/2, caches e `output/` permanecem no disco, mas foram excluídos do futuro Git público. As POCs e capturas da pasta superior também têm regras de exclusão no `.gitignore` dessa pasta, caso ela seja escolhida como raiz. Não publicar essas cópias por um envio manual fora do Git. Nada foi apagado para eliminar o histórico.

A pendência da roda antiga está encerrada por substituição. As declarações específicas das sete fotografias mantidas continuam sendo as fontes documentadas acima; não se afirma ter obtido autorizações novas ou consultado páginas que antes estavam indisponíveis. Para esta versão de demonstração, o material NASA tem uso factual, créditos e ausência de endosso. As limitações para publicidade futura são condições de uso, não uma pendência de copyright da nova imagem.
