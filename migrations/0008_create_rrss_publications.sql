-- Migración para crear la sección privada de RRSS

-- Tabla para almacenar las publicaciones generadas
CREATE TABLE IF NOT EXISTS rrss_publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    topic TEXT NOT NULL,
    tone TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at INTEGER NOT NULL,
    updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_rrss_publications_platform ON rrss_publications(platform);

-- Tabla para almacenar las sesiones activas de RRSS
CREATE TABLE IF NOT EXISTS rrss_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rrss_sessions_expires_at ON rrss_sessions(expires_at);
