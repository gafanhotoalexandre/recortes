# recortes.

Um jeito de montar colagens com suas fotos, direto no navegador. Escolha um modelo, encontre um enquadramento e ajuste o papel, as bordas e o texto. Quando estiver do seu jeito, baixe em PNG, JPEG ou PDF.

A proposta é conseguir uma colagem agradável sem precisar aprender um editor inteiro. Os modelos dão um ponto de partida; os ajustes ficam à mão para acertar os detalhes.

![Bancada do recortes com o modelo Arcos, biblioteca de fotos e ajustes de papel](docs/images/recortes-desktop.png)

Captura real da aplicação com três imagens CC0: café de Rachel Michetti, Chelsea de Stefan van der Walt e grama de linolafett, distribuídas pelo scikit-image. [Fontes e condições das imagens](docs/fotografias-demonstrativas.md).

## Na bancada

- Nove modelos em quatro formatos: retrato, quadrado, paisagem e A4.
- Biblioteca com até 12 fotos JPEG, PNG ou WebP. As miniaturas dos modelos também mostram suas fotos.
- Enquadramento por arraste e zoom. No celular, o modo **Ajustar enquadramento** deixa o gesto separado da rolagem da página.
- Papel, margens, cantos, bordas, legenda, data e fontes, conforme o modelo.
- Desfazer e refazer até 40 alterações. Cada gesto de enquadramento conta como uma alteração.
- Exportação em alta resolução ou em tamanho para compartilhar. PDF A4 tem uma página de 210 × 297 mm.

As fotos de exemplo ajudam a explorar a aplicação. Ao importar suas fotos pela primeira vez, todos os exemplos e seus enquadramentos são substituídos. Você pode selecionar uma moldura e aplicar uma foto pela biblioteca; o destino aparece numerado.

## Executar localmente

Use Node.js 24 e npm. Dentro da pasta da aplicação — `recortes`, se você estiver na pasta que também contém as POCs:

```sh
npm ci
npm run dev
```

Abra [localhost:5173](http://127.0.0.1:5173/). Para conferir o build de produção:

```sh
npm run build
npm run preview
```

O preview fica em [localhost:4173](http://127.0.0.1:4173/). Não é necessário configurar `.env`, serviço de nuvem ou chave de API. Os arquivos precisam ser servidos por HTTP; abrir o HTML do build diretamente não funciona.

## Por dentro

A interface usa **React 19, TypeScript, Vite, Tailwind CSS 4, Radix/shadcn e Lucide**. O PDF é gerado com **pdf-lib**. Vitest, Testing Library e Playwright cuidam dos testes.

Os modelos ficam em um registro único: cada definição descreve a disposição das molduras, os ajustes disponíveis e os elementos gráficos. A partir disso, o motor monta uma cena e a desenha no Canvas. Bancada, miniaturas e exportação usam as mesmas regras.

Na edição, versões menores das fotos mantêm a bancada leve. A exportação usa os originais: abre, desenha e libera cada imagem na ordem da cena, preservando as sobreposições.

Quando o navegador oferece os recursos necessários, a exportação roda em um Worker para deixar a interface disponível. O renderizador é o mesmo no Worker e no caminho alternativo da thread principal. O PDF recebe uma imagem JPEG da colagem inteira, incluindo os textos.

Os detalhes, comandos de teste e medições estão em [Desenvolvimento](docs/desenvolvimento.md) e nos [resultados da Fase 4](docs/fase-4.md).

## Suas fotos e a sessão

As fotos são processadas no navegador. O aplicativo não faz upload delas e não usa backend, conta de usuário ou telemetria. O link de autoria abre um site externo quando você o aciona.

A sessão fica em memória: **recarregar ou fechar a página perde as fotos e os ajustes**. Não há salvamento de projeto. Para continuar exportando sem internet, abra **Exportar** enquanto estiver conectado e aguarde a preparação dos recursos; isso vale para a aba aberta, não para uma nova visita offline.

Alguns limites ajudam a manter o processamento viável: 12 fotos, 15 MiB por arquivo, 80 MiB no conjunto, 32 megapixels e 16.000 pixels por lado. Fotos pequenas geram um aviso de resolução, sem impedir o download.

HEIC/HEIF não é aceito. O PDF tem texto rasterizado, sem seleção ou busca. Safari real, aparelhos iPhone/Android, leitores de tela e pressão de memória em dispositivos modestos ainda precisam de validação; os testes automatizados não substituem esses usos.

## Autoria e licenças

recortes. por [alemartins.dev](https://alemartins.dev.br/).

A licença de reutilização do código e da identidade visual ainda não foi definida. As dependências mantêm suas próprias licenças; o build reúne os avisos em `dist/third-party-licenses.txt`. Veja também [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

As sete fotografias demonstrativas têm suas fontes e condições registradas na [revisão de licenciamento](docs/fotografias-demonstrativas.md). A oitava imagem é um estudo cromático original, gerado por código para o recortes, sem material externo. Os créditos acompanham o build. O material NASA é usado como exemplo, sem endosso; seu uso em anúncios ou capas promocionais exige avaliação própria.

A [entrega dos ajustes finais](docs/ajustes-finais.md) registra a substituição da imagem, as verificações e os materiais históricos preservados fora do futuro Git público.
