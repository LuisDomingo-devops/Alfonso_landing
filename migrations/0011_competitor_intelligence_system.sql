-- Migración para el Sistema de Reverse Engineering de Campañas de Competencia e Inteligencia de Marketing

-- 1. Añadir campos adicionales a rrss_competitors
ALTER TABLE rrss_competitors ADD COLUMN type TEXT;
ALTER TABLE rrss_competitors ADD COLUMN target_audience TEXT;
ALTER TABLE rrss_competitors ADD COLUMN product TEXT;
ALTER TABLE rrss_competitors ADD COLUMN price TEXT;
ALTER TABLE rrss_competitors ADD COLUMN web_url TEXT;
ALTER TABLE rrss_competitors ADD COLUMN linkedin_url TEXT;
ALTER TABLE rrss_competitors ADD COLUMN instagram_url TEXT;
ALTER TABLE rrss_competitors ADD COLUMN tiktok_url TEXT;
ALTER TABLE rrss_competitors ADD COLUMN youtube_url TEXT;
ALTER TABLE rrss_competitors ADD COLUMN ads_url TEXT;

-- Campos de la Ficha de Posicionamiento de competidores
ALTER TABLE rrss_competitors ADD COLUMN positioning_we_are TEXT;
ALTER TABLE rrss_competitors ADD COLUMN positioning_help_who TEXT;
ALTER TABLE rrss_competitors ADD COLUMN positioning_get_what TEXT;
ALTER TABLE rrss_competitors ADD COLUMN positioning_by_how TEXT;
ALTER TABLE rrss_competitors ADD COLUMN positioning_differentiator TEXT;
ALTER TABLE rrss_competitors ADD COLUMN positioning_problem TEXT;
ALTER TABLE rrss_competitors ADD COLUMN positioning_promise TEXT;
ALTER TABLE rrss_competitors ADD COLUMN positioning_objection TEXT;

-- Actualizar competidores iniciales con tipos y metadatos por defecto
UPDATE rrss_competitors SET type = 'directo', target_audience = 'Pymes y Autónomos', product = 'SaaS contabilidad fiscal', price = '€€', web_url = 'https://declarando.es', linkedin_url = 'https://linkedin.com/company/declarando', ads_url = 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&query=declarando' WHERE name = 'Declarando';
UPDATE rrss_competitors SET type = 'directo', target_audience = 'Pymes, Autónomos y Gestores', product = 'ERP contable y facturación', price = '€€', web_url = 'https://holded.com', linkedin_url = 'https://linkedin.com/company/holded', ads_url = 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&query=holded' WHERE name = 'Holded';

-- 2. Tabla para el Competitive Swipe File (Anuncios/Posts de competidores)
CREATE TABLE IF NOT EXISTS rrss_swipe_file (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competitor_id INTEGER,
    platform TEXT NOT NULL,
    date_observed TEXT,
    url TEXT,
    type TEXT NOT NULL, -- 'ad' (anuncio) o 'organic' (orgánico)
    file_name TEXT,
    notes TEXT,
    campaign_name TEXT,
    audience TEXT,
    problem TEXT,
    desire TEXT,
    hook TEXT,
    promise TEXT,
    mechanism TEXT,
    proof TEXT,
    offer TEXT,
    cta TEXT,
    landing TEXT,
    tone TEXT,
    objection TEXT,
    funnel_stage TEXT, -- 'TOFU', 'MOFU', 'BOFU'
    psychology_flow TEXT, -- 'PROBLEMA -> AGITACIÓN -> NUEVO MECANISMO -> SOLUCIÓN -> PRUEBA -> OFERTA -> CTA'
    hook_class TEXT, -- 'problema', 'resultado', 'curiosidad', 'contrarian', 'educacion', 'caso_real', 'prueba_social', 'demostracion', 'comparacion', 'miedo_riesgo', 'urgencia'
    scoring_repetition INTEGER DEFAULT 0,
    scoring_persistence INTEGER DEFAULT 0,
    scoring_differentiation INTEGER DEFAULT 0,
    scoring_relevance INTEGER DEFAULT 0,
    scoring_applicability INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (competitor_id) REFERENCES rrss_competitors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rrss_swipe_file_competitor ON rrss_swipe_file(competitor_id);
CREATE INDEX IF NOT EXISTS idx_rrss_swipe_file_platform ON rrss_swipe_file(platform);

-- 3. Tabla para el Registro de Hipótesis de Marketing
CREATE TABLE IF NOT EXISTS rrss_hypotheses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    observation TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    test TEXT NOT NULL,
    control TEXT NOT NULL,
    metric TEXT NOT NULL,
    expected_result TEXT NOT NULL,
    scoring_repetition INTEGER DEFAULT 0,
    scoring_persistence INTEGER DEFAULT 0,
    scoring_differentiation INTEGER DEFAULT 0,
    scoring_relevance INTEGER DEFAULT 0,
    scoring_applicability INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'validated', 'rejected'
    created_at INTEGER NOT NULL
);

-- 4. Tabla para los Briefings Creativos de Campañas Propias (Creative Briefs)
CREATE TABLE IF NOT EXISTS rrss_campaign_briefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hypothesis_id INTEGER,
    name TEXT NOT NULL,
    goal TEXT NOT NULL,
    audience TEXT NOT NULL,
    problem TEXT NOT NULL,
    desire TEXT NOT NULL,
    insight TEXT,
    angle TEXT NOT NULL,
    hook TEXT NOT NULL,
    promise TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    proof TEXT,
    offer TEXT,
    cta TEXT NOT NULL,
    format TEXT,
    landing TEXT,
    primary_kpi TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (hypothesis_id) REFERENCES rrss_hypotheses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rrss_campaign_briefs_hypothesis ON rrss_campaign_briefs(hypothesis_id);
