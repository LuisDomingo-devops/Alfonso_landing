-- Migración para soportar la planificación temporal de publicaciones de redes sociales
ALTER TABLE rrss_publications ADD COLUMN scheduled_at INTEGER;
