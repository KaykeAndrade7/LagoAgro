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
