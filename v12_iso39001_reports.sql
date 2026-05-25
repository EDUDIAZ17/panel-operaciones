-- v12_iso39001_reports.sql
-- Migración para crear la tabla de reportes de Seguridad Vial ISO 39001

CREATE TABLE IF NOT EXISTS public.iso39001_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_name TEXT NOT NULL,
    auditor TEXT NOT NULL,
    audit_date DATE NOT NULL,
    total_score INTEGER NOT NULL,
    compliance_percentage NUMERIC(5,2) NOT NULL,
    maturity_level TEXT NOT NULL,
    answers JSONB NOT NULL,
    risk_matrix JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.iso39001_reports ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso para permitir lectura e inserción pública
CREATE POLICY "Permitir lectura de reportes ISO 39001" ON public.iso39001_reports
    FOR SELECT USING (true);

CREATE POLICY "Permitir insercion de reportes ISO 39001" ON public.iso39001_reports
    FOR INSERT WITH CHECK (true);
