-- Migración 0012: Añadir columnas de scraping restantes a rrss_competitors

ALTER TABLE rrss_competitors ADD COLUMN services_offered TEXT;
ALTER TABLE rrss_competitors ADD COLUMN linkedin_likes INTEGER;
ALTER TABLE rrss_competitors ADD COLUMN twitter_likes INTEGER;
ALTER TABLE rrss_competitors ADD COLUMN instagram_likes INTEGER;
ALTER TABLE rrss_competitors ADD COLUMN tiktok_followers INTEGER;
ALTER TABLE rrss_competitors ADD COLUMN tiktok_posts INTEGER;
ALTER TABLE rrss_competitors ADD COLUMN tiktok_likes INTEGER;
ALTER TABLE rrss_competitors ADD COLUMN youtube_followers INTEGER;
ALTER TABLE rrss_competitors ADD COLUMN youtube_posts INTEGER;
ALTER TABLE rrss_competitors ADD COLUMN youtube_likes INTEGER;
