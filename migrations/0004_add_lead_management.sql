ALTER TABLE leads
ADD COLUMN status TEXT NOT NULL DEFAULT 'new';

ALTER TABLE leads
ADD COLUMN notes TEXT NOT NULL DEFAULT '';

ALTER TABLE leads
ADD COLUMN contacted_at TEXT;

ALTER TABLE leads
ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_leads_status
ON leads(status);

CREATE INDEX IF NOT EXISTS idx_leads_updated_at
ON leads(updated_at);