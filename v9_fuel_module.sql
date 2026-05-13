-- =============================================================
-- v9_fuel_module.sql — Módulo de Combustible
-- ALEXA Transportes | AUTOTRANSPORTES Y LOGISTICA ESPECIALIZADA
-- =============================================================

-- 1. Agregar capacidad de tanque a la tabla de unidades
ALTER TABLE units ADD COLUMN IF NOT EXISTS capacidad_tanque_litros DECIMAL(10,2) DEFAULT 0;

-- 2. Sembrar capacidades — Flota Madrinas (ATM) = 900 L
UPDATE units SET capacidad_tanque_litros = 900
WHERE economic_number IN (
    'ATM01','ATM02','ATM03','ATM04','ATM05','ATM06',
    'ATM08','ATM09','ATM10','ATM11','ATM12','ATM13',
    'ATM14','ATM15','ATM16','ATM17','ATM18','ATM19',
    'ATM20','ATM21','ATM22','ATM23','ATM24','ATM25',
    'ATM26','ATM27'
);

-- 3. Sembrar capacidades — Flota Pipas (AT) = 1500 L
UPDATE units SET capacidad_tanque_litros = 1500
WHERE economic_number IN ('AT08','AT16','AT22','AT25','AT26','AT28','AT29');

-- 4. Crear tabla de cargas de combustible
CREATE TABLE IF NOT EXISTS cargas_combustible (
    id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    unidad_id             UUID REFERENCES units(id) ON DELETE SET NULL,
    operador_id           UUID REFERENCES operators(id) ON DELETE SET NULL,
    remolque              TEXT,
    fecha_carga           TIMESTAMP WITH TIME ZONE NOT NULL,
    precio_litro          DECIMAL(10,4) NOT NULL,
    combustible_actual    DECIMAL(10,3) NOT NULL,
    capacidad_maxima      DECIMAL(10,3) NOT NULL,
    litros_autorizar      DECIMAL(10,3),
    litros_bomba          DECIMAL(10,3),
    litros_boson          DECIMAL(10,3),
    diferencia_litros     DECIMAL(10,3),
    porcentaje_diferencia DECIMAL(10,4),
    semaforo              TEXT CHECK (semaforo IN ('verde', 'amarillo', 'rojo')),
    monto_cobro           DECIMAL(12,2) DEFAULT 0,
    ubicacion_url         TEXT,
    notas                 TEXT,
    elaboro               TEXT,
    status                TEXT DEFAULT 'pendiente_carga'
                              CHECK (status IN ('pendiente_carga', 'completado', 'vencido')),
    creado_en             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Habilitar RLS (igual que las demás tablas)
ALTER TABLE cargas_combustible ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for cargas_combustible" ON cargas_combustible;
CREATE POLICY "Allow all for cargas_combustible" ON cargas_combustible
    FOR ALL USING (true) WITH CHECK (true);

-- 6. Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_cargas_status      ON cargas_combustible(status);
CREATE INDEX IF NOT EXISTS idx_cargas_unidad      ON cargas_combustible(unidad_id);
CREATE INDEX IF NOT EXISTS idx_cargas_operador    ON cargas_combustible(operador_id);
CREATE INDEX IF NOT EXISTS idx_cargas_fecha       ON cargas_combustible(fecha_carga DESC);
CREATE INDEX IF NOT EXISTS idx_cargas_semaforo    ON cargas_combustible(semaforo);
