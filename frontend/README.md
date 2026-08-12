# LagoAgro — Frontend

PWA em React + Vite + TypeScript + TailwindCSS pro sistema de gestão
agrícola LagoAgro. Consome a API Django REST em `/api`, proxied em dev pro
backend rodando em `:8000`.

## Como rodar

Pré-requisito: o backend Django precisa estar rodando em `localhost:8000`
pra que o proxy de `/api` funcione (ver `lagoagro/README.md` ou o
`AGENTS.md` na raiz do repositório pra subir o backend).

```bash
npm install
npm run dev
```

## Testes

```bash
npm test
```

## Build de produção

```bash
npm run build
```

## Lint

```bash
npm run lint
```

Consulte `docs/` na raiz do repositório para requisitos (`docs/requirements.md`)
e decisões de arquitetura (`docs/adr/`).
