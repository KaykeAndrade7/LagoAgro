# Frontend: polimento PWA — ícones reais + prompt de instalação (Task #8, fatia 5/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a última fatia do Task #8 — substituir os três ícones placeholder (fundo verde sólido + favicon roxo/azul genérico) por uma marca real gerada de uma única fonte SVG, e adicionar o fluxo de prompt de instalação (`beforeinstallprompt`/`appinstalled`) no `AppShell`. Sem shell offline (RNF02 define o app como sempre-online).

**Architecture:** Uma fonte SVG única (`frontend/public/logo-fonte.svg`) processada pelo `@vite-pwa/assets-generator` (novo devDependency, CLI `pwa-assets-generator`) para gerar os PNGs reais em `public/`; `manifest.json` e `index.html` atualizados para apontar pros arquivos gerados; um novo módulo `frontend/src/lib/install-prompt.ts` com listeners registrados em module-scope (o evento `beforeinstallprompt` pode disparar antes do React montar) expondo uma API de assinatura (`assinarDisponibilidade`) consumida por um novo botão "Instalar app" no `AppShell`, no mesmo padrão do botão de push já existente.

**Tech Stack:** React 19 + TypeScript, Vite + `vite-plugin-pwa` (já configurado, sem mudança), `@vite-pwa/assets-generator` (novo devDependency, gera os PNGs — não roda em runtime), Vitest + React Testing Library, `npx tsc -b` obrigatório.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-08-03-frontend-pwa-polish-design.md`. **Três correções em relação à spec, confirmadas nesta investigação e aplicadas neste plano:**
  1. O binário do CLI é `pwa-assets-generator` (não `vite-pwa-assets-generator` como a prosa da spec menciona — confirmado via `npm view @vite-pwa/assets-generator bin`).
  2. Os nomes de arquivo gerados pelo `minimal2023Preset` são os nomes reais e fixos da própria ferramenta (confirmado lendo `dist/index.mjs` do pacote publicado, função `defaultAssetName`): `pwa-192x192.png`, `pwa-512x512.png` (`transparent`, sizes `[64, 192, 512]` + favicon.ico em 48px — o de 64px e o `favicon.ico` não são usados aqui, ver Task 1), `maskable-icon-512x512.png` (`maskable`, size `[512]` — **não existe uma variante maskable de 192**, o preset só gera 512; um único tamanho maskable é suficiente, o navegador redimensiona), `apple-touch-icon-180x180.png` (`apple`, size `[180]`). O plano usa esses nomes reais em vez dos nomes inventados na spec (`icon-192.png`, `icon-192-maskable.png` etc.) — mudança de nome de arquivo, não de decisão de produto.
  3. **A ferramenta escreve os PNGs gerados na mesma pasta da imagem fonte** (confirmado lendo `dist/cli.mjs`: `generateAssets(instruction, override, dirname(instruction.image), ...)` — o diretório de saída é literalmente `dirname` do arquivo de entrada, sem opção de config pra desacoplar os dois). A spec original colocava a fonte em `frontend/src-assets/` (fora de `public/`, "por não ser um artefato servido") — com esse comportamento real, isso geraria os PNGs dentro de `src-assets/`, exigindo um passo manual extra de mover pra `public/` toda vez que os ícones forem regenerados. Correção aplicada neste plano: a fonte vai direto em `frontend/public/logo-fonte.svg`. Ficar em `public/` e nunca ser referenciada por nenhum HTML/CSS é inofensivo (mesma situação de um asset estático não usado) e é o padrão idiomático real de uso dessa ferramenta.
- `frontend/public/favicon.svg` continua sendo o favicon referenciado em `index.html` (`<link rel="icon" type="image/svg+xml" href="/favicon.svg">`, inalterado) — como a marca já é um SVG, o conteúdo de `favicon.svg` é substituído diretamente pela mesma arte, sem passar pelo gerador de PNG. O `favicon.ico` gerado pela ferramenta fica sem uso (não é referenciado em lugar nenhum) — apagado ao final da Task 1 pra não deixar lixo em `public/`.
- `frontend/public/icon-192.png` e `frontend/public/icon-512.png` (placeholders verdes atuais) ficam órfãos assim que `manifest.json` passa a apontar pros novos nomes gerados — apagados na Task 1.
- `@vite-pwa/assets-generator` é `devDependency` (só roda em build-time/manual, nunca em runtime do app).
- `BeforeInstallPromptEvent` não é um tipo DOM padrão do TypeScript — precisa ser declarado localmente em `install-prompt.ts` (`type BeforeInstallPromptEvent = Event & {...}`), igual ao que já acontece com `PushSubscriptionInput` em `lib/push.ts` pra não colidir com tipos globais.
- Um `BeforeInstallPromptEvent` só pode ser usado uma vez, seja `accepted` ou `dismissed` — os dois resultados consomem o evento e escondem o botão; `'dismissed'` não é tratado como erro (usuário só recusou).
- `verbatimModuleSyntax: true` — usar `import type { ... }` pra imports somente-de-tipo.
- Testes frontend via `npx vitest run` a partir de `frontend/`; `npx tsc -b` limpo é obrigatório em toda task antes de dar por concluída.
- `sw.ts` não é tocado nesta fatia (o prompt de instalação é 100% de página, não passa pelo service worker).

---

### Task 1: Marca real — SVG fonte, geração de ícones, manifest e index.html

**Files:**
- Create: `frontend/public/logo-fonte.svg`
- Create: `frontend/pwa-assets.config.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/public/favicon.svg`
- Modify: `frontend/public/manifest.json`
- Modify: `frontend/index.html`
- Generated by CLI (não escritos à mão): `frontend/public/pwa-192x192.png`, `frontend/public/pwa-512x512.png`, `frontend/public/maskable-icon-512x512.png`, `frontend/public/apple-touch-icon-180x180.png`
- Delete: `frontend/public/icon-192.png`, `frontend/public/icon-512.png` (placeholders órfãos)

**Interfaces:**
- Nenhuma — task só produz assets estáticos referenciados por `manifest.json`/`index.html`, nenhum código consome isso via import. Sem teste automatizado (verificação visual + `tsc -b`, mesma convenção documentada pra `sw.ts` desde a fatia 3c).

- [ ] **Step 1: Criar a fonte SVG da marca**

Criar `frontend/public/logo-fonte.svg` (fica em `public/` — não em uma pasta de "fontes" separada — porque o gerador escreve os PNGs na mesma pasta da imagem de entrada; ver Global Constraints, item 3):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#166534"/>
  <path d="M256,120 C340,160 350,300 256,392 C162,300 172,160 256,120 Z" fill="#ffffff"/>
  <path d="M256,150 Q280,256 256,362" fill="none" stroke="#166534" stroke-width="10" stroke-linecap="round"/>
</svg>
```

Folha branca estilizada com nervura central sobre fundo verde do tema (`#166534`). As pontas da folha ficam a ~136px do centro (256,256) — dentro do raio de zona segura (~204.8px, 80% de um canvas de 512px) exigido por ícones maskable, então nenhum recorte de máscara circular/squircle do Android corta a arte.

- [ ] **Step 2: Instalar o gerador de ícones**

Rodar: `cd frontend && npm install -D @vite-pwa/assets-generator@^1.0.2`

Confirma em `frontend/package.json` que `@vite-pwa/assets-generator` foi adicionado em `devDependencies`.

- [ ] **Step 3: Configurar o gerador**

Criar `frontend/pwa-assets.config.ts`:

```ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo-fonte.svg'],
})
```

Em `frontend/package.json`, adicionar o script (mantendo os demais scripts existentes intactos):

```json
"gerar-icones": "pwa-assets-generator"
```

- [ ] **Step 4: Gerar os PNGs**

Rodar: `cd frontend && npm run gerar-icones`

Confirma que os seguintes arquivos foram criados em `frontend/public/`: `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `favicon.ico`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`.

- [ ] **Step 5: Remover os arquivos gerados que não são usados**

Rodar: `cd frontend && rm public/pwa-64x64.png public/favicon.ico`

(`favicon.svg` continua sendo o favicon de fato usado — ver Step 6. O ícone de 64px do preset não é referenciado em nenhum manifest/link.)

- [ ] **Step 6: Substituir `favicon.svg` pela mesma marca**

Sobrescrever `frontend/public/favicon.svg` com o mesmo conteúdo do Step 1:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#166534"/>
  <path d="M256,120 C340,160 350,300 256,392 C162,300 172,160 256,120 Z" fill="#ffffff"/>
  <path d="M256,150 Q280,256 256,362" fill="none" stroke="#166534" stroke-width="10" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 7: Remover os placeholders antigos**

Rodar: `cd frontend && rm public/icon-192.png public/icon-512.png`

- [ ] **Step 8: Atualizar `manifest.json`**

Substituir o conteúdo de `frontend/public/manifest.json`:

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
    { "src": "/pwa-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/pwa-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 9: Adicionar `apple-touch-icon` no `index.html`**

Em `frontend/index.html`, adicionar esta linha logo depois do `<link rel="icon" ...>` existente:

```html
<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 10: Verificação visual**

Rodar: `cd frontend && npm run dev`, abrir `http://localhost:5173` no navegador, inspecionar a aba (favicon deve ser a folha branca sobre verde, não mais o logo roxo/azul antigo). Confirmar via devtools → Application → Manifest que os 3 ícones carregam sem 404.

- [ ] **Step 11: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

- [ ] **Step 12: Commit**

```bash
git add frontend/public/logo-fonte.svg frontend/pwa-assets.config.ts frontend/package.json frontend/package-lock.json frontend/public/favicon.svg frontend/public/manifest.json frontend/index.html frontend/public/pwa-192x192.png frontend/public/pwa-512x512.png frontend/public/maskable-icon-512x512.png frontend/public/apple-touch-icon-180x180.png
git add -u frontend/public/icon-192.png frontend/public/icon-512.png
git commit -m "feat(frontend): substituir icones placeholder por marca real gerada"
```

---

### Task 2: `lib/install-prompt.ts` — captura e assinatura do evento de instalação

**Files:**
- Create: `frontend/src/lib/install-prompt.ts`
- Create: `frontend/src/lib/install-prompt.test.ts`

**Interfaces:**
- Produces: `promptDisponivel(): boolean`, `assinarDisponibilidade(callback: () => void): () => void`, `solicitarInstalacao(): Promise<'accepted' | 'dismissed' | 'indisponivel'>`. Task 3 (`AppShell.tsx`) consome as três.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/lib/install-prompt.test.ts`. Como os listeners são registrados em module-scope no `import` do módulo (não dentro de uma função), cada teste dispara eventos sintéticos no `window` e observa o efeito via as funções exportadas:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { promptDisponivel, assinarDisponibilidade, solicitarInstalacao } from './install-prompt'

function criarEventoBeforeInstallPrompt(userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>) {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  evento.prompt = vi.fn().mockResolvedValue(undefined)
  evento.userChoice = userChoice
  return evento
}

describe('install-prompt', () => {
  beforeEach(() => {
    // garante estado limpo entre testes: se um teste anterior deixou o evento
    // capturado, um 'appinstalled' sintético zera o estado do módulo
    window.dispatchEvent(new Event('appinstalled'))
  })

  it('promptDisponivel comeca falso', () => {
    expect(promptDisponivel()).toBe(false)
  })

  it('promptDisponivel vira true depois de beforeinstallprompt', () => {
    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'accepted' })))

    expect(promptDisponivel()).toBe(true)
  })

  it('assinarDisponibilidade notifica quando beforeinstallprompt dispara', () => {
    const callback = vi.fn()
    assinarDisponibilidade(callback)

    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'accepted' })))

    expect(callback).toHaveBeenCalled()
  })

  it('a funcao de cancelamento de assinarDisponibilidade para de notificar', () => {
    const callback = vi.fn()
    const cancelar = assinarDisponibilidade(callback)
    cancelar()

    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'accepted' })))

    expect(callback).not.toHaveBeenCalled()
  })

  it('solicitarInstalacao retorna "indisponivel" quando nao ha evento capturado', async () => {
    const resultado = await solicitarInstalacao()

    expect(resultado).toBe('indisponivel')
  })

  it('solicitarInstalacao chama prompt() e resolve com o outcome, consumindo o evento', async () => {
    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'accepted' })))

    const resultado = await solicitarInstalacao()

    expect(resultado).toBe('accepted')
    expect(promptDisponivel()).toBe(false)
  })

  it('outcome "dismissed" tambem consome o evento', async () => {
    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'dismissed' })))

    const resultado = await solicitarInstalacao()

    expect(resultado).toBe('dismissed')
    expect(promptDisponivel()).toBe(false)
  })

  it('appinstalled zera o estado mesmo sem solicitarInstalacao ter sido chamado', () => {
    window.dispatchEvent(criarEventoBeforeInstallPrompt(Promise.resolve({ outcome: 'accepted' })))
    expect(promptDisponivel()).toBe(true)

    window.dispatchEvent(new Event('appinstalled'))

    expect(promptDisponivel()).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste pra confirmar que falha**

Run: `cd frontend && npx vitest run src/lib/install-prompt.test.ts`
Expected: FAIL — `Failed to resolve import "./install-prompt"`.

- [ ] **Step 3: Escrever a implementação**

Criar `frontend/src/lib/install-prompt.ts`:

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

- [ ] **Step 4: Rodar o teste pra confirmar que passa**

Run: `cd frontend && npx vitest run src/lib/install-prompt.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/install-prompt.ts frontend/src/lib/install-prompt.test.ts
git commit -m "feat(frontend): adicionar captura do evento beforeinstallprompt"
```

---

### Task 3: `AppShell.tsx` — botão "Instalar app"

**Files:**
- Modify: `frontend/src/layout/AppShell.tsx`
- Modify: `frontend/src/layout/AppShell.test.tsx`

**Interfaces:**
- Consumes: `promptDisponivel`, `assinarDisponibilidade`, `solicitarInstalacao` de `../lib/install-prompt` (Task 2).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao topo de `frontend/src/layout/AppShell.test.tsx` (junto aos imports/mocks existentes):

```tsx
import * as installPromptLib from '../lib/install-prompt'

vi.mock('../lib/install-prompt')
```

E, dentro do `beforeEach` já existente (depois do `vi.mocked(authContext.useAuth).mockReturnValue(...)`), adicionar o default de "sem prompt disponível" pra não quebrar os testes de push já existentes:

```tsx
    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(false)
    vi.mocked(installPromptLib.assinarDisponibilidade).mockReturnValue(() => {})
```

Adicionar estes casos de teste ao final do `describe('AppShell', ...)`:

```tsx
  it('nao mostra o botao de instalar quando nao ha prompt disponivel', () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)

    renderComProviders()

    expect(screen.queryByText('Instalar app')).not.toBeInTheDocument()
  })

  it('mostra o botao de instalar quando o evento beforeinstallprompt ja disparou antes da montagem', () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(true)

    renderComProviders()

    expect(screen.getByText('Instalar app')).toBeInTheDocument()
  })

  it('assina disponibilidade ao montar e cancela ao desmontar', () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
    const cancelar = vi.fn()
    vi.mocked(installPromptLib.assinarDisponibilidade).mockReturnValue(cancelar)

    const { unmount } = renderComProviders()
    expect(installPromptLib.assinarDisponibilidade).toHaveBeenCalledTimes(1)

    unmount()
    expect(cancelar).toHaveBeenCalledTimes(1)
  })

  it('clique com outcome "accepted" esconde o botao', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(true)
    vi.mocked(installPromptLib.solicitarInstalacao).mockResolvedValue('accepted')

    renderComProviders()
    await userEvent.click(screen.getByText('Instalar app'))

    expect(screen.queryByText('Instalar app')).not.toBeInTheDocument()
  })

  it('clique com outcome "dismissed" tambem esconde o botao, sem mensagem de erro', async () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(true)
    vi.mocked(installPromptLib.solicitarInstalacao).mockResolvedValue('dismissed')

    renderComProviders()
    await userEvent.click(screen.getByText('Instalar app'))

    expect(screen.queryByText('Instalar app')).not.toBeInTheDocument()
    expect(screen.queryByText(/não foi possível instalar/i)).not.toBeInTheDocument()
  })

  it('appinstalled disparado via assinatura esconde o botao', () => {
    vi.mocked(pushLib.suportaPush).mockReturnValue(false)
    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(true)
    let notificar: () => void = () => {}
    vi.mocked(installPromptLib.assinarDisponibilidade).mockImplementation((callback) => {
      notificar = callback
      return () => {}
    })

    renderComProviders()
    expect(screen.getByText('Instalar app')).toBeInTheDocument()

    vi.mocked(installPromptLib.promptDisponivel).mockReturnValue(false)
    notificar()

    expect(screen.queryByText('Instalar app')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar os testes pra confirmar que falham**

Run: `cd frontend && npx vitest run src/layout/AppShell.test.tsx`
Expected: FAIL — nenhum elemento com texto "Instalar app" existe ainda; `vi.mock('../lib/install-prompt')` falha por o módulo não existir com esse shape (mas ele já existe da Task 2 — a falha aqui é comportamental, não de import).

- [ ] **Step 3: Escrever a implementação**

Substituir o conteúdo completo de `frontend/src/layout/AppShell.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { suportaPush, ativarNotificacoes } from '../lib/push'
import { promptDisponivel, assinarDisponibilidade, solicitarInstalacao } from '../lib/install-prompt'

type EstadoNotificacoes = 'idle' | 'carregando' | 'ativado' | 'negado' | 'indisponivel' | 'erro'

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth()
  const [estadoNotificacoes, setEstadoNotificacoes] = useState<EstadoNotificacoes>('idle')
  const [instalacaoDisponivel, setInstalacaoDisponivel] = useState(promptDisponivel())

  useEffect(() => {
    return assinarDisponibilidade(() => setInstalacaoDisponivel(promptDisponivel()))
  }, [])

  async function aoClicarAtivarNotificacoes() {
    setEstadoNotificacoes('carregando')
    try {
      const resultado = await ativarNotificacoes()
      setEstadoNotificacoes(resultado)
    } catch {
      setEstadoNotificacoes('erro')
    }
  }

  async function aoClicarInstalar() {
    await solicitarInstalacao()
    setInstalacaoDisponivel(false)
  }

  return (
    <div>
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-4">
          <span className="font-bold">LagoAgro</span>
          <nav className="flex gap-3 text-sm">
            <Link to="/">Painel</Link>
            <Link to="/propriedades">Propriedades</Link>
            <Link to="/culturas">Culturas</Link>
            <Link to="/plantios">Plantios</Link>
            <Link to="/insumos">Insumos</Link>
            <Link to="/aplicacoes">Aplicações</Link>
            <Link to="/tarefas">Tarefas</Link>
            <Link to="/colheitas">Colheitas</Link>
            <Link to="/trabalhadores">Trabalhadores</Link>
            <Link to="/financeiro">Financeiro</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {instalacaoDisponivel && <button onClick={aoClicarInstalar}>Instalar app</button>}
          {suportaPush() && estadoNotificacoes !== 'ativado' && (
            <button onClick={aoClicarAtivarNotificacoes} disabled={estadoNotificacoes === 'carregando'}>
              {estadoNotificacoes === 'carregando' ? 'Ativando...' : 'Ativar notificações'}
            </button>
          )}
          {estadoNotificacoes === 'ativado' && <span>Notificações ativadas</span>}
          {estadoNotificacoes === 'negado' && (
            <span className="text-red-600">Permissão negada — ative nas configurações do navegador.</span>
          )}
          {estadoNotificacoes === 'indisponivel' && (
            <span className="text-red-600">Notificações indisponíveis neste ambiente.</span>
          )}
          {estadoNotificacoes === 'erro' && (
            <span className="text-red-600">Não foi possível ativar notificações agora.</span>
          )}
          <button onClick={() => logout()}>Sair</button>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
```

Nota: o clique esconde o botão diretamente (`setInstalacaoDisponivel(false)` após o `await`), sem depender da assinatura pra refletir o resultado. É proposital: `solicitarInstalacao()` consome o evento em todo caminho que importa (`'accepted'` e `'dismissed'`, os únicos resultados possíveis quando o botão estava mesmo visível — `'indisponivel'` só ocorre se não havia evento capturado, o que não deveria acontecer com o botão renderizado, mas esconder o botão nesse caso também é seguro), então esconder incondicionalmente no próprio clique é correto e não exige que o teste replique a notificação interna do módulo mockado. A assinatura via `assinarDisponibilidade` continua sendo o único mecanismo pros outros dois casos: o evento já ter disparado antes da montagem, e `appinstalled` disparando enquanto o botão está visível sem o usuário ter clicado.

- [ ] **Step 4: Rodar os testes pra confirmar que passam**

Run: `cd frontend && npx vitest run src/layout/AppShell.test.tsx`
Expected: PASS (todos os testes existentes de push + os 6 novos de instalação).

- [ ] **Step 5: Rodar `routes.test.tsx` pra confirmar que a integração completa continua passando**

Run: `cd frontend && npx vitest run src/routes.test.tsx`
Expected: PASS, inalterado. `routes.test.tsx` roda o `AppShell` real (não mockado) contra jsdom, que nunca dispara `beforeinstallprompt` — `promptDisponivel()` real retorna `false` e o botão nunca aparece nesses testes.

- [ ] **Step 6: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

- [ ] **Step 7: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: todos os arquivos de teste passam (última task do plano — nada deve ficar quebrado).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/layout/AppShell.tsx frontend/src/layout/AppShell.test.tsx
git commit -m "feat(frontend): adicionar botao de instalar app no AppShell"
```

---

## Post-plan: whole-branch review

Depois das 3 tasks commitadas, rodar a revisão final de whole-branch (per `superpowers:subagent-driven-development`) cobrindo o diff completo contra `master`, com atenção especial a:

- Nenhuma referência residual a `icon-192.png`/`icon-512.png`/aos nomes de arquivo inventados na spec original (`icon-192-maskable.png` etc.) em qualquer lugar do frontend.
- O ícone/favicon realmente carrega no navegador (verificação visual, não só `tsc -b` — ver Task 1 Step 10).
- `instalacaoDisponivel` nunca fica dessincronizado do estado real de `promptDisponivel()` — em particular depois de `'dismissed'`, o botão precisa mesmo sumir (evento é de uso único).
- O botão de instalar nunca aparece em navegadores que nunca disparam `beforeinstallprompt` (Safari/iOS) — comportamento esperado, não uma lacuna.
- `git status` limpo em `frontend/public/` — nenhum PNG intermediário/órfão gerado pela ferramenta (`pwa-64x64.png`, `favicon.ico`) sobrou versionado.
