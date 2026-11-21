CREATE TABLE IF NOT EXISTS business_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image','video')),
  object_key TEXT NOT NULL UNIQUE,
  file_name VARCHAR(180) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  public_url TEXT NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_media_business ON business_media(business_id,created_at);
