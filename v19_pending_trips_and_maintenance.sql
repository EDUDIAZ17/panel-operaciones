-- v19_pending_trips_and_maintenance.sql
-- 1. Create pending_trips table
CREATE TABLE IF NOT EXISTS public.pending_trips (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    client text NOT NULL,
    origin text NOT NULL,
    destination text NOT NULL,
    status text DEFAULT 'Pendiente', -- 'Pendiente', 'Asignado'
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for pending_trips
ALTER TABLE public.pending_trips ENABLE ROW LEVEL SECURITY;

-- Create public access policies for pending_trips
DROP POLICY IF EXISTS "Public Access Pending Trips" ON public.pending_trips;
CREATE POLICY "Public Access Pending Trips" ON public.pending_trips FOR ALL USING (true);

-- 2. Create maintenance_logs table
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
    type text NOT NULL, -- 'Preventivo', 'Rescate Carretero', 'Correctivo'
    status text NOT NULL DEFAULT 'Programado', -- 'Programado', 'En Taller', 'Resuelto'
    scheduled_date timestamp WITH time zone,
    description text,
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for maintenance_logs
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Create public access policies for maintenance_logs
DROP POLICY IF EXISTS "Public Access Maintenance Logs" ON public.maintenance_logs;
CREATE POLICY "Public Access Maintenance Logs" ON public.maintenance_logs FOR ALL USING (true);
