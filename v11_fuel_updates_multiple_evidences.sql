-- =============================================================
-- v11_fuel_updates_multiple_evidences.sql 
-- =============================================================

-- Añadir 2 columnas adicionales para soportar hasta 3 evidencias
ALTER TABLE cargas_combustible 
ADD COLUMN IF NOT EXISTS evidencia_url_2 TEXT,
ADD COLUMN IF NOT EXISTS evidencia_url_3 TEXT;
