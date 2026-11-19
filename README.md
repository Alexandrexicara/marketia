# MarketIA — Marketing Inteligente Universal

Plataforma SaaS multiempresa para presença digital, gestão comercial, CRM, conteúdo, campanhas e métricas.

**Produção**
- Frontend: https://marketdigitalia.netlify.app
- API: https://marketia-54ra.onrender.com
- Saúde da API: https://marketia-54ra.onrender.com/api/health
- Sitemap público: https://marketia-54ra.onrender.com/sitemap.xml
- Repositório: https://github.com/Alexandrexicara/marketia

## Funcionalidades disponíveis

- Cadastro e login de usuários com hash de senha e JWT.
- Workspaces e associação de usuários a empresas (multi-tenant).
- Cadastro e publicação de páginas comerciais por slug.
- Cadastro, publicação e remoção de produtos e serviços.
- Formulário público de contato com consentimento e entrada no CRM.
- CRM com status: novo, contatado, qualificado, convertido e perdido.
- Rascunhos de conteúdo para Instagram, Facebook, WhatsApp, LinkedIn e blog.
- Planejamento de campanhas orgânicas e rascunhos para Google Ads/Meta Ads.
- Métricas de visualizações de páginas e contatos.
- Campos SEO, URL canônica, sitemap XML, robots.txt e JSON-LD LocalBusiness.
- Isolamento dos dados por tenant nas rotas autenticadas.

## Limites atuais importantes

- O gerador de conteúdo atual usa modelos editáveis; **não é um modelo de IA generativa**. Para IA real, configure um provedor e uma chave de API no backend.
- Campanhas são apenas planejadas e salvas como rascunho. Não existe publicação automática nem cobrança de mídia.
- Google Ads, Meta Ads, WhatsApp e publicação social ainda exigem conectores oficiais, credenciais e autorização expressa do titular da conta.
- Métricas começam a contar eventos a partir da versão que contém o rastreamento.
- SEO técnico facilita a leitura pelos buscadores, mas não garante indexação nem posição.

## Estrutura do repositório

- `frontend/`: React 19 + Vite.
- `backend/`: Node.js + Express + PostgreSQL.
- `database/schema.sql`: schema completo para novas instalações.
- `database/migrations/`: migrações incrementais.
- `docs/`: documentação operacional.

## Desenvolvimento local

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

## Variáveis de ambiente

Backend (`backend/.env` ou Render):
- `DATABASE_URL`: conexão PostgreSQL/Neon.
- `JWT_SECRET`: segredo forte para assinatura dos tokens.
- `ALLOWED_ORIGINS`: origens separadas por vírgula, incluindo o domínio Netlify.
- `PUBLIC_SITE_URL`: domínio público do frontend.
- `API_PUBLIC_URL`: domínio público da API.
- `DATABASE_SSL`: use `false` somente em ambientes locais que não usam TLS.

Frontend:
- A URL da API está definida em `frontend/src/Dashboard.jsx` e `frontend/src/PublicBusiness.jsx`. Para mudar ambiente, altere o endereço-base da API nesses arquivos ou extraia-o para uma variável Vite.

**Nunca** publique segredos no frontend ou no GitHub.

## Banco de dados

A produção utiliza PostgreSQL no Neon. O schema completo está em `database/schema.sql`. Para atualizar uma instalação existente, aplique as migrações em ordem:
1. `database/migrations/002_marketia_growth.sql`

A migração 002 adiciona eventos de página, rascunhos de conteúdo, campanhas e campos complementares de CRM/SEO.

## Rotas principais da API

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/me`
- `GET/POST /api/businesses`, `PATCH /api/businesses/:id`
- `GET/POST /api/businesses/:id/offerings`
- `PATCH/DELETE /api/businesses/:id/offerings/:offeringId`
- `GET /api/leads`, `PATCH /api/leads/:id`
- `GET /api/analytics/overview`
- `GET/POST /api/campaigns`, `PATCH /api/campaigns/:id`
- `GET /api/content/drafts`, `POST /api/content/generate`, `PATCH /api/content/drafts/:id`
- `GET /api/public/business/:slug`
- `POST /api/public/business/:slug/leads`
- `POST /api/public/business/:slug/events`
- `GET /sitemap.xml`, `GET /robots.txt`

Rotas privadas exigem `Authorization: Bearer <token>`. Dados de cada empresa são filtrados pela associação do usuário ao tenant.

## Deploy

- Netlify publica o diretório `frontend` com `npm run build`.
- Render executa o backend pelo Dockerfile da raiz.
- O Render precisa de `DATABASE_URL`, `JWT_SECRET` e `ALLOWED_ORIGINS` configurados.
- Alterações no GitHub disparam os deploys automáticos quando a integração está habilitada.

## Princípios de segurança e produto

- Senhas são armazenadas com hash bcrypt.
- Consultas autenticadas validam a associação ao tenant.
- Formulários públicos de contato exigem consentimento.
- Campanhas pagas nunca são ativadas sem integração e autorização explícitas.
- Integrações externas devem usar APIs oficiais e credenciais armazenadas somente no backend.
- Aplicar rate limiting, política de retenção e revisão de privacidade antes de escalar tráfego público.


## Entrada pública e acesso

- `/` apresenta a landing page pública do MarketIA, com recursos e explicação do fluxo.
- `/cadastro` abre a criação de conta.
- `/entrar` abre o login.
- `/app` direciona para o painel autenticado.
- `/empresa/:slug` continua reservado às páginas públicas dos negócios cadastrados.

O checkout de pagamento ainda não está integrado; não existe cobrança automática ou bloqueio por pagamento nesta versão.
