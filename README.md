# MarketIA — Marketing Inteligente Universal

Plataforma multiempresa para presença digital, SEO, conteúdo, campanhas, CRM e automações.

## Estrutura inicial
- `frontend/`: aplicação React + Vite.
- `backend/`: API Node.js + Express.
- `database/schema.sql`: estrutura inicial PostgreSQL multi-tenant.

## Desenvolvimento
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

Configure `DATABASE_URL` no ambiente do backend para habilitar PostgreSQL. Nunca coloque credenciais no frontend ou no GitHub.

## Princípios
- Multi-tenant: dados de cada empresa isolados por tenant_id.
- Integrações externas sempre por APIs oficiais e consentimento do titular.
- Publicação e campanhas pagas exigem conexão e autorização explícita do cliente.
- SEO não garante indexação nem posição específica nos buscadores.
- Recursos de IA devem funcionar por adaptadores, sem acoplar o produto a um único fornecedor.

## Roadmap
1. Fundação visual e API.
2. Autenticação e isolamento multiempresa.
3. Cadastro de empresas, serviços e produtos; páginas públicas por slug.
4. SEO técnico, sitemap e dados estruturados.
5. CRM e captação consentida de leads.
6. Conteúdo e publicação orgânica.
7. Conectores de anúncios e métricas.
8. Servidor MCP para uso autorizado via ChatGPT.

As integrações com Google Ads, Meta Ads, WhatsApp e modelos de IA serão habilitadas em etapas, após configuração das credenciais e permissões necessárias.