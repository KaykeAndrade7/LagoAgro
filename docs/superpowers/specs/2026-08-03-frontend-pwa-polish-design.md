# Design — Frontend: polimento PWA (Task #8, fatia 5/5)

## Contexto

Fatias 1 a 4 (scaffold+auth, cadastro, insumos+aplicações+tarefas+dashboard+push,
colheita+financeiro) estão mergeadas. Esta é a última sub-fatia do Task #8
(frontend) — depois dela só resta o Task #9 (Deploy).

O manifest (`frontend/public/manifest.json`) e o registro do service worker
(`vite-plugin-pwa`, `strategies: 'injectManifest'`) já existem desde a fatia
1 e não mudam de estrutura aqui. O que falta, conforme `CLAUDE.md`, são
"ícones reais" e "prompt de instalação". **Shell offline não é necessário**
— RNF02 define o app como sempre-online por requisito, então `sw.ts`
deliberadamente não ganha rota de fallback de navegação nesta fatia.

### Estado atual dos ícones (lido diretamente dos arquivos)

- `icon-192.png` (548 bytes) e `icon-512.png` (1882 bytes): blocos verde
  sólido lisos — placeholders do scaffold da fatia 1, sem nenhum desenho.
- `favicon.svg`: um logo roxo/azul (`#863bff`/`#47bfff`) genérico, sem
  nenhuma relação com a marca do app nem com o verde do tema
  (`theme_color: "#166534"`, já usado em `index.html` e no manifest).
- Nenhum ícone maskable, nenhum `apple-touch-icon`.
- Busca por `beforeinstallprompt|manifest` em `frontend/src` não retorna
  nenhum resultado — não existe hoje nenhum tratamento de instalação.

## Decisões de abordagem

**Uma marca única e simples: broto/folha branca sobre o verde do tema.**
Substitui os três ícones atuais (que nem batem entre si) por uma única
peça visual — reforça a identidade do app sem exigir arte externa. Vou
desenhar a marca como um SVG fonte único
(`frontend/src-assets/logo-fonte.svg`, fora de `public/` porque não é ele
mesmo servido — é a origem, não um artefato final) e gerar os PNGs finais
a partir dele.

**Geração via `@vite-pwa/assets-generator`, não rasterização manual.**
Este ambiente não tem ImageMagick, Python nem `sharp` instalados
previamente, e não existe hoje uma forma confiável de converter SVG→PNG
sem uma ferramenta dedicada. `@vite-pwa/assets-generator` é o companion
oficial do `vite-plugin-pwa` (que o projeto já usa) — resolve exatamente
esse problema, é mantido pelo mesmo projeto, e sabe gerar ícones normais
+ maskable + apple-touch-icon a partir de uma única fonte. Entra como
`devDependency` (uso local, não roda em produção — o build final só usa
os PNGs já gerados e commitados em `public/`).

**Ícones maskable com zona de segurança desenhada na própria fonte**, não
dependendo de padding automático do gerador: o SVG fonte já desenha o
fundo verde encostando nas 4 bordas (512×512 cheio) e a folha centralizada
dentro de uma "zona seguro" de ~80% (aprox. 102,102 até 410,410) — assim o
Android não corta a folha ao aplicar sua própria máscara de forma.

**`apple-touch-icon` incluso.** iOS não lê `manifest.json` para o ícone da
tela inicial — precisa do próprio `<link rel="apple-touch-icon">` em
`index.html`. Sem isso, "ícones reais" ficaria incompleto num dos dois
sistemas operacionais móveis relevantes.

**Prompt de instalação: mesmo padrão do botão de notificações em
`AppShell.tsx`.** Novo `frontend/src/lib/install-prompt.ts`, symétrico a
`lib/push.ts`: captura o evento `beforeinstallprompt` assim que o
navegador dispara (o navegador decide sozinho a elegibilidade — não há
gatilho manual possível), guarda numa variável de módulo (o evento pode
disparar antes do React montar, então o listener é registrado no
carregamento do módulo, não dentro de um `useEffect`), e expõe uma API de
assinatura (`assinarDisponibilidade`) para o componente reagir sempre que
montar, mesmo que o evento já tenha disparado antes. `AppShell` ganha um
botão "Instalar app" ao lado do de notificações, visível só quando o
evento foi capturado; ao clicar, chama `.prompt()` e trata o resultado.
Ouve também `appinstalled` para esconder o botão se o app já foi instalado
por outro caminho (ex.: menu do navegador).

**Sem suporte a navegadores que não disparam o evento (ex.: Safari/iOS).**
É uma sugestão opcional do navegador, não uma funcionalidade que se possa
forçar — nesses navegadores o botão simplesmente nunca aparece. Não é uma
lacuna a tratar nesta fatia.

**Mesma stack e convenções das fatias anteriores**: Vitest + React
Testing Library, `npx tsc -b` obrigatório em toda revisão de task.
`sw.ts` continua sem teste unitário (convenção já registrada na fatia
3c) — esta fatia não toca `sw.ts`.

## Estrutura de arquivos

```
frontend/
├── src-assets/
│   └── logo-fonte.svg          — NOVO: SVG fonte único, não servido diretamente
├── pwa-assets.config.ts        — NOVO: config do @vite-pwa/assets-generator
├── package.json                 — MODIFICADO: + devDependency @vite-pwa/assets-generator, + script gerar-icones
├── public/
│   ├── favicon.svg              — MODIFICADO: mesma marca (broto verde/branco)
│   ├── icon-192.png             — MODIFICADO: gerado da fonte
│   ├── icon-512.png             — MODIFICADO: gerado da fonte
│   ├── icon-192-maskable.png    — NOVO: gerado da fonte
│   ├── icon-512-maskable.png    — NOVO: gerado da fonte
│   └── apple-touch-icon.png     — NOVO: gerado da fonte
├── index.html                    — MODIFICADO: + <link rel="apple-touch-icon">
├── public/manifest.json          — MODIFICADO: + entradas maskable
└── src/
    ├── lib/
    │   └── install-prompt.ts     — NOVO: captura beforeinstallprompt, API de assinatura
    └── layout/
        └── AppShell.tsx           — MODIFICADO: + botão "Instalar app"
```

## A marca (SVG fonte)

Viewbox `0 0 512 512`. Fundo: quadrado cheio (0,0 a 512,512) preenchido
`#166534` (mesma cor de `theme_color`), sem cantos arredondados
desenhados no SVG — o arredondamento fica a cargo do sistema operacional
ao aplicar sua própria máscara de ícone (comportamento padrão esperado
tanto em Android quanto no favicon do navegador). Folha: uma silhueta
simples em formato de amêndoa/gota (duas curvas bézier se encontrando em
dois pontos, como uma folha estilizada), branca, centralizada, com uma
nervura central (linha curva na cor de fundo, desenhada por cima) —
desenho deliberadamente simples para continuar legível em tamanhos
pequenos (favicon de aba, 16×16/32×32).

## `pwa-assets.config.ts`

```ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: minimal2023Preset,
  images: ['src-assets/logo-fonte.svg'],
})
```

`minimal2023Preset` gera exatamente os artefatos que este design precisa
(ícone padrão 192/512, maskable 192/512, apple touch icon) sem gerar
splash screens do iOS (fora de escopo — não pedido). Rodado manualmente
via `npx vite-pwa-assets-generator`, novo script `"gerar-icones"` em
`package.json` documentando o comando para reprodutibilidade futura. Saída
mapeada para os nomes de arquivo já usados em `public/` (mesmos nomes do
estado atual + os dois maskable novos + apple-touch-icon), sem introduzir
um novo padrão de nomenclatura de ícones que o resto do app não usa.

## `manifest.json`

```json
{
  "name": "LagoAgro",
  "short_name": "LagoAgro",
  "description": "Gestão agrícola para pequeno produtor",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#166534",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## `index.html`

Adiciona uma linha ao `<head>`, sem alterar as existentes:

```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

## `frontend/src/lib/install-prompt.ts`

```ts
type ResultadoEscolha = 'accepted' | 'dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: ResultadoEscolha }>
}

let eventoCapturado: BeforeInstallPromptEvent | null = null
let ouvintes: Array<() => void> = []

function notificarOuvintes() {
  ouvintes.forEach((callback) => callback())
}

window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault()
  eventoCapturado = evento as BeforeInstallPromptEvent
  notificarOuvintes()
})

window.addEventListener('appinstalled', () => {
  eventoCapturado = null
  notificarOuvintes()
})

export function promptDisponivel(): boolean {
  return eventoCapturado !== null
}

export function assinarDisponibilidade(callback: () => void): () => void {
  ouvintes.push(callback)
  return () => {
    ouvintes = ouvintes.filter((item) => item !== callback)
  }
}

export async function solicitarInstalacao(): Promise<ResultadoEscolha | 'indisponivel'> {
  if (!eventoCapturado) return 'indisponivel'
  const evento = eventoCapturado
  eventoCapturado = null
  notificarOuvintes()
  await evento.prompt()
  const escolha = await evento.userChoice
  return escolha.outcome
}
```

Os listeners de `window` são registrados no escopo do módulo (fora de
qualquer função) — de propósito, para capturar o evento mesmo se ele
disparar antes do primeiro `import` deste módulo por um componente React
ainda não ter montado. `promptDisponivel()`/`assinarDisponibilidade()`
dão ao componente uma forma de ler o estado atual e reagir a mudanças
futuras sem precisar corrida de montagem.

## `frontend/src/layout/AppShell.tsx`

Novo estado local (`'indisponivel' | 'disponivel' | 'instalando' |
'aceito'`), inicializado a partir de `promptDisponivel()` e mantido em
sincronia via `assinarDisponibilidade` num `useEffect` (assina no mount,
desinscreve no unmount). Botão "Instalar app" some do header — não
aparece — nos estados `'indisponivel'` e `'aceito'`. Ao clicar, chama
`solicitarInstalacao()`:
- `'accepted'` → estado `'aceito'`, botão desaparece e não volta (o
  evento capturado já foi consumido por `solicitarInstalacao` e o
  navegador não dispara `beforeinstallprompt` de novo nesta instalação).
- `'dismissed'` → o evento também já foi consumido (mesmo comportamento
  do navegador: um `BeforeInstallPromptEvent` só pode ser usado uma vez).
  `promptDisponivel()` volta a `false`, a assinatura notifica, o
  componente volta para `'indisponivel'` e o botão desaparece — sem
  mensagem de erro, já que dispensar não é uma falha, é uma escolha
  válida do usuário.
- evento `appinstalled` disparando a qualquer momento (ex.: usuário
  instalou pelo menu do navegador, não pelo botão) também esconde o
  botão, via o mesmo mecanismo de assinatura.

## Testes

- **`lib/install-prompt.ts`**: dispara `beforeinstallprompt` sintético no
  `window` (via `dispatchEvent` com um objeto mockando `prompt`/
  `userChoice`) e confirma `promptDisponivel()` vira `true`;
  `solicitarInstalacao()` resolve `'accepted'`/`'dismissed'` conforme o
  mock; dispara `appinstalled` e confirma `promptDisponivel()` volta a
  `false`; `assinarDisponibilidade` chama o callback nos dois eventos e o
  retorno (função de cancelamento) para de chamar depois de invocado.
- **`AppShell.test.tsx`**: botão não aparece por padrão (sem evento
  capturado); aparece depois de simular `beforeinstallprompt`; clique com
  mock resolvendo `'accepted'` esconde o botão; clique com mock
  resolvendo `'dismissed'` também esconde o botão (sem mensagem de erro);
  disparar `appinstalled` diretamente (sem passar pelo clique) também
  esconde o botão.
- **Ícones/manifest**: sem teste automatizado — são artefatos binários e
  configuração estática, verificados por inspeção visual (abrir o app,
  conferir o favicon da aba e o manifest via devtools) durante a revisão
  da task, não por asserção de código.

## Fora de escopo

- Shell offline / fallback de navegação no service worker — RNF02 define
  o app como sempre-online.
- Splash screens do iOS — não pedido, `minimal2023Preset` não gera.
- Desinstalar/desativar o prompt manualmente (ex.: "não perguntar de
  novo") — não existe hoje um mecanismo do navegador para isso além do
  próprio `dismissed`/`appinstalled`; não há o que implementar.
- Task #9 (Deploy): chaves VAPID reais, cron externo, CORS de produção —
  inteiramente fora desta fatia, como já registrado nos designs
  anteriores.
