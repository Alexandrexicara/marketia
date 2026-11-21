-- MarketIA one-time access payments (R$ 2.000,00).
CREATE TABLE IF NOT EXISTS marketia_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  method VARCHAR(20) NOT NULL CHECK (method IN ('sumup','pix')),
  amount_cents INTEGER NOT NULL DEFAULT 200000 CHECK (amount_cents = 200000),
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','manual_review','rejected','failed','cancelled')),
  checkout_reference UUID UNIQUE,
  sumup_checkout_id VARCHAR(120) UNIQUE,
  hosted_checkout_url TEXT,
  proof_note TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marketia_payments_user_created ON marketia_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketia_payments_status_created ON marketia_payments(status, created_at DESC);
