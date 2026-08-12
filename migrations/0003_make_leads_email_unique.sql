DROP INDEX IF EXISTS idx_leads_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_unique
ON leads(email);