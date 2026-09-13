-- Migration: Create guide_interactions table for Alfonso Virtual Sales Clerk
CREATE TABLE IF NOT EXISTS guide_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    assistant_response TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT '',
    lead_email TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_session ON guide_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_guide_created ON guide_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_guide_lead_email ON guide_interactions(lead_email);
