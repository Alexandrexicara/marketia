-- MarketIA migration 002: CRM, analytics, SEO and marketing workspace
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS keywords TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS canonical_url TEXT;
CREATE TABLE IF NOT EXISTS page_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('page_view','lead_submit','click_whatsapp','click_website')),source VARCHAR(80),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_page_events_business_date ON page_events(business_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_events_tenant_date ON page_events(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS marketing_drafts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,channel VARCHAR(40) NOT NULL DEFAULT 'social',objective VARCHAR(60) NOT NULL DEFAULT 'engagement',topic VARCHAR(180) NOT NULL,tone VARCHAR(40) NOT NULL DEFAULT 'professional',content TEXT NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_marketing_drafts_business ON marketing_drafts(business_id,created_at DESC);
CREATE TABLE IF NOT EXISTS campaigns (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,name VARCHAR(180) NOT NULL,channel VARCHAR(40) NOT NULL DEFAULT 'organic',objective VARCHAR(60) NOT NULL DEFAULT 'awareness',budget NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (budget >= 0),status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','paused','completed')),starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_campaigns_business ON campaigns(business_id,created_at DESC);
