ALTER TABLE leads
ADD COLUMN confirmation_email_sent INTEGER NOT NULL DEFAULT 0;

ALTER TABLE leads
ADD COLUMN confirmation_email_sent_at TEXT NOT NULL DEFAULT '';

ALTER TABLE leads
ADD COLUMN confirmation_email_provider TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_leads_confirmation_email_sent
ON leads(confirmation_email_sent);
