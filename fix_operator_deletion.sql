-- ⚠️ SCRIPT PARA HABILITAR EL BORRADO DE OPERADORES SIN PERDER EL HISTORIAL ⚠️
-- Ejecuta este script en el Editor SQL de Supabase para corregir el error de FK.

-- 1. Tabla de Unidades: Permite que la unidad quede como "Sin Operador" al borrar a la persona.
ALTER TABLE units 
DROP CONSTRAINT IF EXISTS units_current_operator_id_fkey,
ADD CONSTRAINT units_current_operator_id_fkey 
FOREIGN KEY (current_operator_id) REFERENCES operators(id) ON DELETE SET NULL;

-- 2. Historial de Asignaciones: Mantiene el registro del viaje aunque el operador ya no exista.
ALTER TABLE assignments_history 
DROP CONSTRAINT IF EXISTS assignments_history_previous_operator_id_fkey,
ADD CONSTRAINT assignments_history_previous_operator_id_fkey 
FOREIGN KEY (previous_operator_id) REFERENCES operators(id) ON DELETE SET NULL;

ALTER TABLE assignments_history 
DROP CONSTRAINT IF EXISTS assignments_history_new_operator_id_fkey,
ADD CONSTRAINT assignments_history_new_operator_id_fkey 
FOREIGN KEY (new_operator_id) REFERENCES operators(id) ON DELETE SET NULL;

-- 3. Incidencias Automáticas: Protege el registro de infracciones para auditoría.
ALTER TABLE incidents 
DROP CONSTRAINT IF EXISTS incidents_operator_id_fkey,
ADD CONSTRAINT incidents_operator_id_fkey 
FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL;

-- 4. Bitácora de Cámaras: Mantiene los registros de comportamiento.
ALTER TABLE camera_logs 
DROP CONSTRAINT IF EXISTS camera_logs_operator_id_fkey,
ADD CONSTRAINT camera_logs_operator_id_fkey 
FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL;

-- 5. Gastos: Mantiene el registro contable de las rutas.
ALTER TABLE expenses 
DROP CONSTRAINT IF EXISTS expenses_operator_id_fkey,
ADD CONSTRAINT expenses_operator_id_fkey 
FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL;

-- 6. Observaciones (RH): Mantiene las notas administrativas.
ALTER TABLE observations 
DROP CONSTRAINT IF EXISTS observations_operator_id_fkey,
ADD CONSTRAINT observations_operator_id_fkey 
FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL;
