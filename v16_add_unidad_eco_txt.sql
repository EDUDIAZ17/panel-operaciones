-- v16_add_unidad_eco_txt.sql
-- Run this script in the Supabase SQL Editor to add text columns for unit numbers.

-- 1. Add columns
ALTER TABLE public.assignments_history ADD COLUMN IF NOT EXISTS unidad_eco_txt TEXT;
ALTER TABLE public.cargas_combustible ADD COLUMN IF NOT EXISTS unidad_eco_txt TEXT;
ALTER TABLE public.camera_logs ADD COLUMN IF NOT EXISTS unidad_eco_txt TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS unidad_eco_txt TEXT;

-- 2. Populate columns for existing data joining with units table
UPDATE public.assignments_history h 
SET unidad_eco_txt = u.economic_number 
FROM public.units u 
WHERE h.unit_id = u.id;

UPDATE public.cargas_combustible c 
SET unidad_eco_txt = u.economic_number 
FROM public.units u 
WHERE c.unidad_id = u.id;

UPDATE public.camera_logs l 
SET unidad_eco_txt = u.economic_number 
FROM public.units u 
WHERE l.unit_id = u.id;

UPDATE public.incidents i 
SET unidad_eco_txt = u.economic_number 
FROM public.units u 
WHERE i.unit_id = u.id;
