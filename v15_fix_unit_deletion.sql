-- v15_fix_unit_deletion.sql
-- Run this script in the Supabase SQL Editor to allow deleting units without breaking references.

-- 1. Historial de Asignaciones: Mantiene el registro del viaje pero desvincula la unidad borrada.
ALTER TABLE public.assignments_history 
DROP CONSTRAINT IF EXISTS assignments_history_unit_id_fkey,
ADD CONSTRAINT assignments_history_unit_id_fkey 
FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;

-- 2. Gastos: Mantiene el registro contable de gastos de viaje y desvincula la unidad.
ALTER TABLE public.expenses 
DROP CONSTRAINT IF EXISTS expenses_unit_id_fkey,
ADD CONSTRAINT expenses_unit_id_fkey 
FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;

-- 3. Bitácora de Cámaras: Mantiene los reportes de comportamiento sin unidad.
ALTER TABLE public.camera_logs 
DROP CONSTRAINT IF EXISTS camera_logs_unit_id_fkey,
ADD CONSTRAINT camera_logs_unit_id_fkey 
FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;

-- 4. Infracciones/Incidencias: Mantiene el historial de incidentes de seguridad vial.
ALTER TABLE public.incidents 
DROP CONSTRAINT IF EXISTS incidents_unit_id_fkey,
ADD CONSTRAINT incidents_unit_id_fkey 
FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;

-- 5. Cargas de Combustible: Conserva los registros de combustible/costos.
ALTER TABLE public.cargas_combustible 
DROP CONSTRAINT IF EXISTS cargas_combustible_unidad_id_fkey,
ADD CONSTRAINT cargas_combustible_unidad_id_fkey 
FOREIGN KEY (unidad_id) REFERENCES public.units(id) ON DELETE SET NULL;
