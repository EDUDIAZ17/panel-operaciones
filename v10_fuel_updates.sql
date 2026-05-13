-- =============================================================
-- v10_fuel_updates.sql — Actualizaciones Módulo de Combustible
-- ALEXA Transportes
-- =============================================================

-- 1. Añadir columna para evidencia fotográfica
ALTER TABLE cargas_combustible 
ADD COLUMN IF NOT EXISTS evidencia_url TEXT;

-- IMPORTANTE:
-- Asegúrate de ir a Storage en Supabase y crear un nuevo "Bucket"
-- llamado "evidencias" y hacerlo "Public".
