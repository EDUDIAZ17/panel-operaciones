-- ⚠️ SQL SCRIPT PARA BITACORA DE CAMARAS, INCIDENCIAS, Y CATALOGOS ⚠️

-- 1. CATALOGOS DINÁMICOS (CLIENTES, ORIGENES/DESTINOS, ESTATUS)
CREATE TABLE IF NOT EXISTS clients (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text UNIQUE NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text UNIQUE NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS unit_statuses (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text UNIQUE NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar valores iniciales de catálogos basados en la imagen y el estado actual
INSERT INTO clients (name) VALUES 
('GLOVIS'), ('SAAG'), ('CHANGAN'), ('AUTOFIN'), ('TSC LOGISTICS'), 
('FX TRANSPORT'), ('BYD'), ('SIN ASIGNACION'), ('MULTIMODAL'),
('TRANSVISION'), ('VICTORYAUTO'), ('GCM'), ('MOSA'), ('PAASA'), 
('PET FOOD'), ('MARAVILLA'), ('TEPA'), ('PC BILOGISC'), ('MALTA'),
('SERV.INTERNO'), ('CARROLL'), ('SMYRISE') ON CONFLICT (name) DO NOTHING;

INSERT INTO locations (name) VALUES 
('TLAJOMULCO'), ('PESQUERIA'), ('L.CARDENAS'), ('IRAPUATO'), 
('VERACRUZ'), ('TOLUCA'), ('TLAHUAC'), ('TLALNEPANTLA'), ('GUADALAJARA'),
('PATIO COCHINITOS'), ('SILAO'), ('NUTEC'), ('PUEBLA'), ('PENDIENTE'), ('CDMX'),
('MONTERREY'), ('QUERETARO'), ('TIJUANA'), ('LEON'), ('SAN LUIS POTOSI') ON CONFLICT (name) DO NOTHING;

INSERT INTO unit_statuses (name) VALUES 
('Vacia'), ('Cargada'), ('En Taller'), ('Sin Operador'), 
('Transito Vacio'), ('Transito Carga') ON CONFLICT (name) DO NOTHING;


-- 2. BITACORA DE CAMARAS
CREATE TABLE IF NOT EXISTS camera_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    unit_id uuid REFERENCES units(id) ON DELETE CASCADE,
    operator_id uuid REFERENCES operators(id) ON DELETE CASCADE,
    is_moving boolean DEFAULT false,
    has_seatbelt boolean DEFAULT true,
    using_cellphone boolean DEFAULT false,
    camera_covered boolean DEFAULT false,
    photo_url text,
    created_by text NOT NULL, -- Nombre de la persona de torre de control que registró
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. INCIDENCIAS AUTOMATICAS
CREATE TABLE IF NOT EXISTS incidents (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    unit_id uuid REFERENCES units(id) ON DELETE CASCADE,
    operator_id uuid REFERENCES operators(id) ON DELETE CASCADE,
    source_log_id uuid REFERENCES camera_logs(id) ON DELETE SET NULL, -- Referencia a la bitácora si fue autogenerado
    incident_type text NOT NULL, -- Ej: 'Celular', 'Cámara tapada', 'Sin cinturón'
    severity_value integer DEFAULT 1, -- Para el semáforo (ej: sumar puntos)
    location_speed text, -- Velocidad al momento capturada por Samsara
    location_url text, -- Link de Google Maps al momento capturado por Samsara
    resolved boolean DEFAULT false,
    resolved_by text,
    resolved_at timestamp WITH time zone,
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. AJUSTES DEL SISTEMA (EJ: PARAMETROS SEMAFORO)
CREATE TABLE IF NOT EXISTS system_settings (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    setting_key text UNIQUE NOT NULL,
    setting_value jsonb NOT NULL,
    updated_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar parámetros por default del semáforo
INSERT INTO system_settings (setting_key, setting_value) VALUES 
('traffic_light_thresholds', '{"yellow": 2, "red": 3}') ON CONFLICT (setting_key) DO NOTHING;

-- 5. POLITICAS RLS (PUBLIC ACCESS PARA RAPIDA IMPLEMENTACION)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access clients" ON clients FOR ALL USING (true);
CREATE POLICY "Public Access locations" ON locations FOR ALL USING (true);
CREATE POLICY "Public Access unit_statuses" ON unit_statuses FOR ALL USING (true);
CREATE POLICY "Public Access camera_logs" ON camera_logs FOR ALL USING (true);
CREATE POLICY "Public Access incidents" ON incidents FOR ALL USING (true);
CREATE POLICY "Public Access system_settings" ON system_settings FOR ALL USING (true);
