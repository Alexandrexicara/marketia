# MarketIA — preparação de implantação

## Estado atual
A interface React/Vite e a API Express estão no repositório. A implantação ainda depende da configuração das contas e dos serviços Netlify, Render e Neon. Não coloque segredos neste repositório.

## Netlify (frontend)
- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_URL=https://URL-DO-SERVICO-RENDER`

## Render (API atual em Express)
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`
- Environment: `DATABASE_URL`, `DATABASE_SSL=true`, `ALLOWED_ORIGINS=https://DOMINIO-DO-FRONTEND`

## Neon
1. Crie um banco PostgreSQL para o MarketIA.
2. Execute `database/schema.sql` no SQL Editor.
3. Configure a connection string em `DATABASE_URL` no Render.
4. Nunca publique a connection string no GitHub nem a envie em mensagens públicas.

## Validação após publicar
- Abra `/api/health` e confirme `ok: true` e `database: connected`.
- Confirme que o domínio Netlify está listado em `ALLOWED_ORIGINS`.
- Só então testar cadastro, autenticação e operações com dados reais.

## Evolução para NestJS
O backend versionado atualmente é Express. Se o serviço NestJS informado for o backend definitivo, faremos a migração de forma controlada, preservando contratos e rotas. Não configure dois backends concorrentes apontando para o mesmo tráfego sem definir antes qual será o principal.
