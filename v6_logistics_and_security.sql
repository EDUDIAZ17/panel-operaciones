-- v6_logistics_and_security.sql

-- 1. Create Destinations Table (Catálogo dinámico de destinatarios)
CREATE TABLE IF NOT EXISTS destinations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en destinations
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura públicas (para facilidad de consulta en la app)
CREATE POLICY "Lectura Publica Destinations" ON destinations FOR
SELECT USING (true);

CREATE POLICY "Escritura Publica Destinations" ON destinations FOR ALL USING (true);
-- ⚠️ Para producción ajusta a solo Autenticados

-- Insertar algunos destinatarios de ejemplo (opcional)
INSERT INTO
    destinations (name)
VALUES ('Hyundai'),
    ('BYD'),
    ('Nissan'),
    ('Volkswagen'),
    ('Changan') ON CONFLICT (name) DO NOTHING;

-- 2. Create Clients Table (Catálogo dinámico de clientes, en lugar de texto libre)
CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura Publica Clients" ON clients FOR
SELECT USING (true);

CREATE POLICY "Escritura Publica Clients" ON clients FOR ALL USING (true);

-- Insertar clientes previos más comunes
INSERT INTO
    clients (name)
VALUES ('GLOVIS'),
    ('CHANGAN'),
    ('BYD') ON CONFLICT (name) DO NOTHING;

-- 3. Modify `units` table to include detailed trip tracking dates
-- The JSON column `details` is currently handling a lot of this, but storing
-- these as native columns makes them easy to query and edit independently.
ALTER TABLE units
ADD COLUMN IF NOT EXISTS trip_load_arrival_date DATE;

ALTER TABLE units
ADD COLUMN IF NOT EXISTS trip_load_arrival_time TIME;

ALTER TABLE units ADD COLUMN IF NOT EXISTS trip_load_end_date DATE;

ALTER TABLE units ADD COLUMN IF NOT EXISTS trip_load_end_time TIME;

ALTER TABLE units
ADD COLUMN IF NOT EXISTS trip_unload_arrival_date DATE;

ALTER TABLE units
ADD COLUMN IF NOT EXISTS trip_unload_arrival_time TIME;

ALTER TABLE units ADD COLUMN IF NOT EXISTS trip_unload_end_date DATE;

ALTER TABLE units ADD COLUMN IF NOT EXISTS trip_unload_end_time TIME;

ALTER TABLE units
ADD COLUMN IF NOT EXISTS trip_route_start_date DATE;

ALTER TABLE units
ADD COLUMN IF NOT EXISTS trip_route_start_time TIME;

ALTER TABLE units ADD COLUMN IF NOT EXISTS trip_route_end_date DATE;

ALTER TABLE units ADD COLUMN IF NOT EXISTS trip_route_end_time TIME;