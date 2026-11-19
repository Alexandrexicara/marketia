-- MarketIA: schema inicial multi-tenant para PostgreSQL / Neon.
-- Execute após criar o banco. Não armazene tokens de integração em texto puro.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  plan VARCHAR(30) NOT NULL DEFAULT 'free',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT,
  display_name VARCHAR(160),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','editor','analyst')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  segment VARCHAR(100),
  description TEXT,
  website TEXT,
  public_email VARCHAR(254),
  public_phone VARCHAR(40),
  city VARCHAR(100),
  state VARCHAR(100),
  seo_title VARCHAR(70),
  seo_description VARCHAR(180),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('product','service')),
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description TEXT,
  price NUMERIC(12,2),
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  image_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, slug)
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(160),
  email VARCHAR(254),
  phone VARCHAR(40),
  message TEXT,
  source VARCHAR(80),
  consent_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_tenant ON businesses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offerings_tenant_business ON offerings(tenant_id, business_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created ON leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_published_slug ON businesses(slug) WHERE status = 'published';
