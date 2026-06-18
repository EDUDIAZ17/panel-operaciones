-- v17_telemetry_audits.sql
-- Run this script in the Supabase SQL Editor to create the telemetry audits table

CREATE TABLE IF NOT EXISTS public.telemetry_audits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by TEXT,
    summary JSONB NOT NULL,
    speeding_events JSONB NOT NULL,
    safety_events JSONB NOT NULL,
    average_speeds JSONB NOT NULL,
    notes TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.telemetry_audits ENABLE ROW LEVEL SECURITY;

-- Create public access policies
DROP POLICY IF EXISTS "Public Access Telemetry Audits" ON public.telemetry_audits;
CREATE POLICY "Public Access Telemetry Audits" ON public.telemetry_audits 
    FOR ALL USING (true);
