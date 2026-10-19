# Componentes de terceiros

`src/components/ui/dialog.tsx` e `tabs.tsx` foram obtidos pelo CLI oficial shadcn e adaptados para o recortes. Os estilos foram ajustados à aplicação; as transições discretas de dialogs e painéis foram preservadas. O comportamento acessível utiliza Radix UI.

## shadcn/ui — MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

O build reúne este aviso e os textos de licença das dependências de produção em `dist/third-party-licenses.txt`, incluindo dependências transitivas e os dois caminhos de exportação. É uma lista conservadora dos pacotes de produção do lockfile, não uma análise de quais trechos sobreviveram à minificação.

O pacote npm `react-remove-scroll-bar@2.3.8` declara MIT, mas não inclui o arquivo LICENSE. Sua cópia em `licenses/react-remove-scroll-bar.LICENSE` foi obtida do repositório oficial em 19/10/2026: https://raw.githubusercontent.com/theKashey/react-remove-scroll-bar/master/LICENSE. A origem é o ramo upstream consultado nessa data, não uma licença recuperada do commit do tarball.

As sete fotografias têm condições próprias, separadas das licenças de software; seus créditos e condições constam em `docs/fotografias-demonstrativas.md` e acompanham este aviso no build. `photo-8.jpg` é um estudo cromático original gerado para o recortes, sem material externo. A roda de cores anterior não integra a distribuição atual. O uso demonstrativo documentado não concede endosso NASA nem liberação geral para publicidade.
