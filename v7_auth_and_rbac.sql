-- v7_auth_and_rbac.sql

-- 1. Create app_users Table (Centralized Auth)
CREATE TABLE IF NOT EXISTS app_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, -- Note: For production use Supabase Auth to hash passwords
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Temporary public policies for ease of migration (Adjust for prod)
CREATE POLICY "Lectura Publica App Users" ON app_users FOR
SELECT USING (true);

CREATE POLICY "Escritura Publica App Users" ON app_users FOR ALL USING (true);

-- 2. Insert Base Users (including Luis Hernandez requirement)
INSERT INTO
    app_users (email, password, name, role)
VALUES (
        'eduardo.garduno@alexatransportes.com.mx',
        'admin',
        'Eduardo Garduño (Admin)',
        'admin'
    ),
    (
        'rh@alexatransportes.com.mx',
        'rh',
        'Recursos Humanos',
        'rh'
    ),
    (
        'luis.hernandez@alexatransportes.com.mx',
        'Fer_03070409',
        'Luis Hernandez (Mantenimiento)',
        'mantenimiento'
    ) ON CONFLICT (email) DO NOTHING;