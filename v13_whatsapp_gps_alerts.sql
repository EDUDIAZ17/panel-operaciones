-- v13_whatsapp_gps_alerts.sql
-- Run this script in the Supabase SQL Editor to create the alerts table

CREATE TABLE IF NOT EXISTS public.whatsapp_gps_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
    destination_name TEXT NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    radius_km NUMERIC DEFAULT 15.0,
    atc_message TEXT,
    quality_message TEXT,
    recipients JSONB DEFAULT '[]'::jsonb, -- Store list of {name, phone} objects
    status TEXT DEFAULT 'Programada', -- 'Programada', 'Disparada', 'Enviada', 'Cancelada'
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.whatsapp_gps_alerts ENABLE ROW LEVEL SECURITY;

-- Create public access policies (matches other tables in the project for development)
CREATE POLICY "Public Access Whatsapp GPS Alerts" ON public.whatsapp_gps_alerts 
    FOR ALL USING (true);
