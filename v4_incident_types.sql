-- Script para agregar la tabla de tipos de incidencias dinámicas
CREATE TABLE IF NOT EXISTS incident_types (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text UNIQUE NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar algunas opciones por defecto
INSERT INTO
    incident_types (name)
VALUES ('Exceso de velocidad'),
    ('Uso de celular'),
    ('Cámara tapada'),
    ('No lleva cinturón'),
    ('Freno brusco'),
    ('Desvío de ruta') ON CONFLICT (name) DO NOTHING;

-- Habilitar RLS y acceso público
ALTER TABLE incident_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access incident_types" ON incident_types FOR ALL USING (true);