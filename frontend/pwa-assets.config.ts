// Nota: este arquivo gera os icones do PWA a partir de public/logo-fonte.svg.
// public/favicon.svg e uma copia manual do mesmo logo (o gerador nao mexe nele) —
// se a marca mudar, atualize os dois arquivos juntos.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo-fonte.svg'],
})
