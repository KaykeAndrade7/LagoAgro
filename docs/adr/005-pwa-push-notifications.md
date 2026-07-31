# ADR 005 — Frontend como PWA para suportar push notifications

## Status
Aceito

## Contexto
RF11 exige notificar o usuário no dia de uma tarefa (prioridade: aplicação de
defensivo). As opções avaliadas foram e-mail, WhatsApp Business API e push
notification via navegador:

- **E-mail**: gratuito, mas depende do usuário checar e-mail com frequência —
  baixa aderência ao hábito real do usuário-alvo.
- **WhatsApp Business API**: canal mais familiar ao usuário, porém exige
  provedor pago (Twilio, Meta Cloud API com custo por mensagem) — incompatível
  com RNF04 (custo zero).
- **Push notification via navegador (Web Push)**: gratuito, funciona com o
  app instalado como PWA na tela inicial do celular, sem exigir loja de
  aplicativos (Google Play/App Store).

## Decisão
O frontend React será estruturado como **PWA** (manifest.json + service
worker), usando a Web Push API para notificações. O service worker roda em
segundo plano e recebe a notificação mesmo com o navegador fechado, desde que
o usuário tenha instalado o app na tela inicial e concedido permissão de
notificação.

O backend Django dispara o push através de uma biblioteca compatível com Web
Push (ex.: `django-webpush` ou envio direto via VAPID), acionado por uma
tarefa agendada (ver ADR 006) que roda diariamente e verifica quais tarefas
vencem naquele dia.

## Consequências
- Positivo: custo zero, sem dependência de loja de aplicativos.
- Positivo: mesmo código do frontend serve como app "instalável" no celular,
  reforçando a experiência mobile-first (RNF06).
- Negativo: push no iOS/Safari tem suporte mais recente e limitado
  comparado ao Android/Chrome. **Confirmado com o usuário final: dispositivo é
  Android**, portanto esse risco não se aplica ao público-alvo atual (RF11 tem
  suporte pleno via Web Push no Chrome/Android). Caso o produto seja liberado
  para outros agricultores no futuro (ver ADR 002), revisar compatibilidade
  com iOS antes de assumir push como canal universal.
- Negativo: exige que o usuário mantenha o app instalado e permissão de
  notificação concedida — sem isso, o Requisito RF11 não se cumpre; a UI
  precisa deixar isso claro na primeira execução.

## Adendo — PWA vs. app nativo (Android)

Alternativa considerada e descartada: aplicativo nativo Android (Kotlin/Java)
ou via camada híbrida (React Native), publicado como APK/Play Store.

**Por que não:**
- Exigiria stack tecnológica adicional (Kotlin, ou React Native como camada
  extra), sem retorno técnico proporcional dado o escopo do produto.
- Processo de build, assinatura de APK e revisão da Google Play Store
  adicionam fricção e tempo de manutenção que não se justificam para um único
  usuário inicial (RNF01) e público-alvo que não requer recursos nativos
  profundos do aparelho (câmera, sensores, background jobs pesados).
- Custo de manutenção contínua por uma única pessoa é maior que o do PWA, que
  reaproveita 100% do código do frontend web já planejado (ADR 004).

**O que se perde**, conscientemente: familiaridade cultural de "baixar um app
da loja" — mitigado pela simplicidade de instalação do PWA (adicionar à tela
inicial em poucos toques) e pelo fato de o usuário-alvo ser Android/Chrome,
onde o suporte a PWA é maduro.

Essa decisão foi tomada avaliando explicitamente o trade-off entre as duas
abordagens, e não por padrão — caso o produto evolua para múltiplos usuários
com necessidades de hardware nativo, este ADR deve ser revisitado.
