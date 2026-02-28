-- ⚠️ SQL SCRIPT PARA PERMITIR ESTATUS DINÁMICOS ⚠️
-- Actualmente la columna `status` en la tabla `units` es de tipo ENUM.
-- Esto significa que rechaza cualquier estatus nuevo agregado desde el panel.
-- Este script convierte esa columna a texto libre para aceptar los nuevos valores.

ALTER TABLE units ALTER COLUMN status DROP DEFAULT;

ALTER TABLE units ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE units ALTER COLUMN status SET DEFAULT 'Sin Operador';