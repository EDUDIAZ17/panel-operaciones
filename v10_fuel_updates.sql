-- =============================================================
-- v10_fuel_updates.sql — Actualizaciones Módulo de Combustible
-- ALEXA Transportes
-- =============================================================

-- 1. Añadir columna para evidencia fotográfica
ALTER TABLE cargas_combustible 
ADD COLUMN IF NOT EXISTS evidencia_url TEXT;

-- 2. Configurar permisos para subir fotos (Row-Level Security en Storage)
-- Esto soluciona el error "new row violates row-level security policy"
-- al subir la foto de la evidencia.

-- Permitir a cualquier usuario subir archivos al bucket "evidencias"
CREATE POLICY "Permitir subida de evidencias" 
ON storage.objects FOR INSERT 
TO public
WITH CHECK (bucket_id = 'evidencias');

-- Permitir lectura publica de los archivos en el bucket "evidencias"
CREATE POLICY "Permitir lectura de evidencias" 
ON storage.objects FOR SELECT 
TO public
USING (bucket_id = 'evidencias');

-- Permitir actualizar archivos en el bucket "evidencias"
CREATE POLICY "Permitir actualizacion de evidencias"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'evidencias');

-- IMPORTANTE:
-- Debes asegurarte de que ya creaste el bucket llamado "evidencias"
-- y que sea Público (Public) en el panel de Storage antes de correr esto.
