-- Crear tabla para la monitorización de competidores
CREATE TABLE rrss_competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rss_blog_url TEXT,
    rss_social_url TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- Competidores iniciales monitorizados
INSERT INTO rrss_competitors (name, rss_blog_url, rss_social_url) VALUES 
('Declarando', 'https://declarando.es/blog/feed/', 'https://nitter.net/Declarando_es/rss'),
('Holded', 'https://www.holded.com/es/blog/feed/', '');
